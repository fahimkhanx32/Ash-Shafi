import mongoose from 'mongoose';

import {
  VideoSession,
  VIDEO_PARTICIPANT_ROLES,
  ACTIVE_VIDEO_SESSION_STATUSES,
  TERMINAL_VIDEO_SESSION_STATUSES,
} from '../models/video-session.model.js';
import { Appointment } from '../../appointments/models/appointment.model.js';
import * as appointmentService from '../../appointments/services/appointment.service.js';
import { getVideoProvider } from './providers/index.js';
import { assertCanAccessSession, isSessionParticipant, isAdminTier, logVideoAudit } from './video-access.service.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import { NOTIFICATION_TYPES } from '../../notifications/models/notification.model.js';
import { getIo } from '../../../socket/index.js';
import { generateOpaqueToken, hashToken } from '../../../security/tokens.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';
import env from '../../../config/env.js';

/**
 * BET-14.2 — BET-14.9 — Video Consultation.
 *
 * State machine (enforced here, never trusted from the client — same
 * convention as `appointment.service.js`/`queue.service.js`):
 *
 *   CREATED --(1st participant joins)--> WAITING
 *   WAITING --(2nd participant joins)--> ACTIVE
 *   ACTIVE/WAITING --(a participant leaves)--> recomputed from the
 *     currently-connected count (never below CREATED, never itself a
 *     terminal state — a call can legitimately go quiet and resume)
 *   any non-terminal --(doctor/admin-tier explicitly ends it)--> ENDED
 *   any non-terminal --(underlying appointment becomes
 *     CANCELLED/RESCHEDULED/NO_SHOW)--> CANCELLED (lazy, on next read)
 *   CREATED/WAITING --(`expiresAt` passes without reaching ACTIVE)-->
 *     EXPIRED (lazy, on next read — this project has no job runner
 *     yet, `jobs/` is empty, reserved for a later BET, so expiry is
 *     computed on demand exactly like `availability.service.js`
 *     (BET-10) already does for appointment slots)
 *
 * `maxDurationMinutes` is informational only, surfaced to the client
 * for UI display — this task does not forcibly disconnect an ACTIVE
 * call at that mark (documented limitation, see `env.js`'s
 * `VIDEO_MAX_SESSION_DURATION_MINUTES` comment; a hard server-side
 * cutoff would need its own explicit task/decision, master prompt
 * §98).
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findSessionOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid video session id.', 400, { code: 'INVALID_ID' });
  }
  const session = await VideoSession.findById(id);
  if (!session) {
    throw new AppError('Video session not found.', 404, { code: 'VIDEO_SESSION_NOT_FOUND' });
  }
  return session;
};

const pushHistory = (session, { action, toStatus, actor = null, reason = '' }) => {
  session.history.push({
    action,
    fromStatus: session.status,
    toStatus,
    actor: actor?._id ?? null,
    reason,
  });
  session.status = toStatus;
};

const requestMetaFrom = (options = {}) => ({
  ipAddress: options.ipAddress ?? null,
  userAgent: options.userAgent ?? null,
});

/**
 * Re-checks the two conditions that can retire a session without any
 * explicit action by either participant (appointment cancellation,
 * waiting-room timeout). Mutates and saves `session` in place when a
 * transition fires. Safe to call on every read — a no-op once the
 * session is already terminal.
 */
const refreshLazyStatus = async (session, { actor = null, requestMeta = {} } = {}) => {
  if (TERMINAL_VIDEO_SESSION_STATUSES.includes(session.status)) {
    return session;
  }

  const appointment = await Appointment.findById(session.appointment).select('status');

  if (appointment && ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'].includes(appointment.status)) {
    pushHistory(session, {
      action: 'APPOINTMENT_NO_LONGER_ACTIVE',
      toStatus: 'CANCELLED',
      actor,
      reason: `Underlying appointment is ${appointment.status}.`,
    });
    await session.save();
    await logVideoAudit({
      session,
      actor,
      action: 'SESSION_CANCELLED',
      outcome: 'INFO',
      ...requestMeta,
    });
    return session;
  }

  if (session.status !== 'ACTIVE' && Date.now() > session.expiresAt.getTime()) {
    pushHistory(session, {
      action: 'WAITING_ROOM_TIMEOUT',
      toStatus: 'EXPIRED',
      actor,
      reason: 'No one joined before the waiting-room window elapsed.',
    });
    await session.save();
    await logVideoAudit({
      session,
      actor,
      action: 'SESSION_EXPIRED',
      outcome: 'INFO',
      ...requestMeta,
    });
    return session;
  }

  return session;
};

/**
 * Derives `status` purely from how many of the two expected
 * participant roles are *currently* connected (`joinedAt` set,
 * `leftAt` null) — never from history. Never used to reach a
 * terminal state; a caller in ACTIVE/WAITING/CREATED after this call
 * simply reflects live presence.
 */
const connectedParticipantCount = (session) =>
  session.participants.filter((p) => p.joinedAt && !p.leftAt).length;

const recomputeLiveStatus = (session, { action, actor }) => {
  if (TERMINAL_VIDEO_SESSION_STATUSES.includes(session.status)) {
    return;
  }

  const connected = connectedParticipantCount(session);
  const nextStatus = connected >= 2 ? 'ACTIVE' : connected === 1 ? 'WAITING' : 'CREATED';

  if (nextStatus === session.status) {
    return;
  }

  pushHistory(session, { action, toStatus: nextStatus, actor });

  if (nextStatus === 'ACTIVE' && !session.startedAt) {
    session.startedAt = new Date();
  }
};

/**
 * Opaque, unguessable room name — never the appointment id or the
 * session's own `_id` (master prompt §80, documented on the model
 * itself). `vr_` prefix is purely cosmetic/debuggable, carries no
 * meaning.
 */
const generateRoomId = () => `vr_${generateOpaqueToken(16)}`;

/**
 * BET-14.2 — Secure video-session creation, get-or-create shape (an
 * appointment has at most one `VideoSession`, ever — the model's
 * unique index is the real guard; this function is idempotent on top
 * of it).
 *
 * `getAppointmentById` already enforces that a `PATIENT` actor may
 * only touch their own appointment (404, not 403, on a mismatch) —
 * this function adds nothing beyond that for ownership, but does add
 * the video-specific business rules the appointment layer knows
 * nothing about.
 */
export const getOrCreateSessionForAppointment = async (appointmentId, actor, options = {}) => {
  const appointment = await appointmentService.getAppointmentById(appointmentId, actor);

  if (appointment.consultationMode !== 'ONLINE') {
    throw new AppError('This appointment is not an online consultation.', 409, {
      code: 'NOT_AN_ONLINE_APPOINTMENT',
    });
  }

  if (['CANCELLED', 'RESCHEDULED', 'NO_SHOW'].includes(appointment.status)) {
    throw new AppError(`A video session cannot be created for a ${appointment.status.toLowerCase()} appointment.`, 409, {
      code: 'APPOINTMENT_NOT_ACTIVE',
    });
  }

  const existing = await VideoSession.findOne({ appointment: appointment._id });
  if (existing) {
    return refreshLazyStatus(existing, { actor });
  }

  const provider = getVideoProvider();
  const roomId = generateRoomId();
  const waitingRoomMinutes = env.video.waitingRoomTimeoutMinutes;
  const expiresAt = new Date(appointment.scheduledStart.getTime() + waitingRoomMinutes * 60000);

  let session;
  try {
    session = await VideoSession.create({
      appointment: appointment._id,
      patientProfile: appointment.patientProfile,
      patient: appointment.patient,
      doctor: appointment.doctor,
      provider: provider.name,
      roomId,
      status: 'CREATED',
      scheduledStart: appointment.scheduledStart,
      expiresAt,
      maxDurationMinutes: env.video.maxSessionDurationMinutes,
      createdBy: actor._id,
      history: [
        {
          action: 'SESSION_CREATED',
          fromStatus: null,
          toStatus: 'CREATED',
          actor: actor._id,
        },
      ],
    });
  } catch (error) {
    if (error?.code === 11000) {
      // Lost a create race — someone else's request created it first.
      const raced = await VideoSession.findOne({ appointment: appointment._id });
      if (raced) return raced;
    }
    throw error;
  }

  // Best-effort provider room preparation. `native` never needs
  // external setup (see `native-webrtc.provider.js`); a future hosted
  // provider might, which is why this is awaited but never allowed to
  // block the session document from existing — `isConfigured()` was
  // already checked by `getVideoProvider()` above.
  try {
    provider.createRoom({ roomId, sessionId: String(session._id), appointmentId: String(appointment._id) });
  } catch (error) {
    logger.warn({ err: error, sessionId: String(session._id) }, 'Video provider room preparation failed.');
  }

  appointment.videoSession = session._id;
  await appointment.save();

  await logVideoAudit({
    session,
    appointmentId: appointment._id,
    actor,
    action: 'SESSION_CREATED',
    outcome: 'INFO',
    ...requestMetaFrom(options),
  });

  // Notify both participants — content stays generic per master
  // prompt §85 ("Your video consultation is ready", never anything
  // clinical), sent to whichever party did not just trigger creation
  // as well as the one who did, so either side can discover it from
  // their notification center regardless of who books/opens it first.
  await Promise.all(
    [appointment.patient, appointment.doctor].map((recipientId) =>
      createNotification({
        recipientId,
        type: NOTIFICATION_TYPES.VIDEO_CONSULTATION_READY,
        title: 'Video consultation ready',
        body: 'Your video consultation room has been prepared and is ready to join at the scheduled time.',
        relatedResource: { type: 'VideoSession', id: String(session._id) },
      }).catch((error) =>
        logger.warn({ err: error, recipientId: String(recipientId) }, 'Failed to send video-ready notification.'),
      ),
    ),
  );

  logger.info(
    { event: 'video_session_created', sessionId: String(session._id), appointmentId: String(appointment._id) },
    'Video session created.',
  );

  return session;
};

export const getSessionById = async (id, actor, options = {}) => {
  const session = await findSessionOrThrow(id);
  await assertCanAccessSession(session, actor, { requestMeta: requestMetaFrom(options) });
  return refreshLazyStatus(session, { actor, requestMeta: requestMetaFrom(options) });
};

/**
 * BET-14.9 — Consent Management (master prompt §96). Only the
 * session's own patient may record their consent — a doctor's
 * participation is itself the clinical/professional consent
 * equivalent and is never captured through this endpoint (see the
 * model's docstring). Re-callable (idempotent) so a patient can
 * revisit the consent screen without erroring.
 */
export const recordPatientConsent = async (id, actor, options = {}) => {
  const session = await findSessionOrThrow(id);

  if (String(session.patient) !== String(actor._id)) {
    throw new AppError('Video session not found.', 404, { code: 'VIDEO_SESSION_NOT_FOUND' });
  }

  if (TERMINAL_VIDEO_SESSION_STATUSES.includes(session.status)) {
    throw new AppError(`This session is ${session.status.toLowerCase()} and can no longer accept consent.`, 409, {
      code: 'SESSION_NOT_JOINABLE',
    });
  }

  session.consent.patientConsented = true;
  session.consent.consentedAt = new Date();
  await session.save();

  await logVideoAudit({
    session,
    actor,
    action: 'CONSENT_RECORDED',
    outcome: 'INFO',
    ...requestMetaFrom(options),
  });

  return session;
};

const findOrCreateParticipantEntry = (session, actor) => {
  const role = actor.role === ROLES.PATIENT ? 'PATIENT' : 'DOCTOR';

  let entry = session.participants.find((p) => String(p.user) === String(actor._id));
  if (entry) return entry;

  entry = session.participants.create({ user: actor._id, role });
  session.participants.push(entry);
  return entry;
};

/**
 * BET-14.5 — Video Security & Access Control, BET-14.3 — Meeting
 * Lifecycle. Only the session's genuine `patient`/`doctor` may join —
 * deliberately stricter than `assertCanAccessSession` (which also
 * lets an admin-tier role *view* session metadata for support
 * purposes); actually joining the media call as a non-clinical
 * bystander is a privacy concern this task does not open, so
 * admin-tier is not exempted here.
 *
 * Issues a fresh, single-use join credential on every call (master
 * prompt BET-14.5.2) — only its SHA-256 hash is ever persisted
 * (`security/tokens.js#hashToken`, the same convention as password-
 * reset/email-verification tokens). The socket layer
 * (`socket/index.js`'s `video:join` handler) must present the
 * returned plaintext token before the signaling room is joined —
 * deliberate defense-in-depth on top of the socket already being
 * authenticated with the same JWT the REST API uses.
 */
export const joinSession = async (id, actor, options = {}) => {
  const session = await findSessionOrThrow(id);
  const requestMeta = requestMetaFrom(options);

  if (!isSessionParticipant(session, actor._id)) {
    await logVideoAudit({
      session,
      actor,
      action: 'JOIN_DENIED',
      outcome: 'DENIED',
      denialReason: 'NOT_PARTICIPANT',
      ...requestMeta,
    });
    throw new AppError('Video session not found.', 404, { code: 'VIDEO_SESSION_NOT_FOUND' });
  }

  await refreshLazyStatus(session, { actor, requestMeta });

  if (TERMINAL_VIDEO_SESSION_STATUSES.includes(session.status)) {
    await logVideoAudit({
      session,
      actor,
      action: 'JOIN_DENIED',
      outcome: 'DENIED',
      denialReason: `SESSION_${session.status}`,
      ...requestMeta,
    });
    throw new AppError(`This session is ${session.status.toLowerCase()} and can no longer be joined.`, 409, {
      code: 'SESSION_NOT_JOINABLE',
    });
  }

  const earliestJoin = new Date(
    session.scheduledStart.getTime() - env.video.earlyJoinMinutes * 60000,
  );
  if (Date.now() < earliestJoin.getTime()) {
    await logVideoAudit({
      session,
      actor,
      action: 'JOIN_DENIED',
      outcome: 'DENIED',
      denialReason: 'TOO_EARLY',
      ...requestMeta,
    });
    throw new AppError('This consultation is not open for joining yet.', 403, {
      code: 'TOO_EARLY_TO_JOIN',
      details: { earliestJoin },
    });
  }

  if (actor.role === ROLES.PATIENT && !session.consent.patientConsented) {
    await logVideoAudit({
      session,
      actor,
      action: 'JOIN_DENIED',
      outcome: 'DENIED',
      denialReason: 'CONSENT_REQUIRED',
      ...requestMeta,
    });
    throw new AppError('Patient consent is required before joining a video consultation.', 409, {
      code: 'CONSENT_REQUIRED',
    });
  }

  const entry = findOrCreateParticipantEntry(session, actor);

  const plaintextToken = generateOpaqueToken(24);
  entry.joinedAt = new Date();
  entry.leftAt = null;
  entry.joinCredential = {
    tokenHash: hashToken(plaintextToken),
    expiresAt: new Date(Date.now() + env.video.joinTokenTtlMinutes * 60000),
    usedAt: null,
  };
  entry.lastIpAddress = requestMeta.ipAddress;
  entry.lastUserAgent = requestMeta.userAgent;

  const wasActive = session.status === 'ACTIVE';
  recomputeLiveStatus(session, { action: 'PARTICIPANT_JOINED', actor });
  await session.save();

  await logVideoAudit({
    session,
    actor,
    action: 'PARTICIPANT_JOINED',
    outcome: 'ALLOWED',
    ...requestMeta,
  });

  if (!wasActive && session.status === 'ACTIVE') {
    await logVideoAudit({ session, actor, action: 'SESSION_STARTED', outcome: 'INFO', ...requestMeta });

    const otherPartyId = String(actor._id) === String(session.patient) ? session.doctor : session.patient;
    await createNotification({
      recipientId: otherPartyId,
      type: NOTIFICATION_TYPES.VIDEO_CONSULTATION_STARTED,
      title: 'Video consultation started',
      body: 'Your video consultation is now in progress.',
      relatedResource: { type: 'VideoSession', id: String(session._id) },
    }).catch((error) =>
      logger.warn({ err: error, recipientId: String(otherPartyId) }, 'Failed to send video-started notification.'),
    );
  }

  return {
    session,
    joinToken: plaintextToken,
    roomId: session.roomId,
    iceServers: env.video.iceServers,
  };
};

export const leaveSession = async (id, actor, options = {}) => {
  const session = await findSessionOrThrow(id);
  const requestMeta = requestMetaFrom(options);

  if (!isSessionParticipant(session, actor._id)) {
    throw new AppError('Video session not found.', 404, { code: 'VIDEO_SESSION_NOT_FOUND' });
  }

  const entry = session.participants.find((p) => String(p.user) === String(actor._id));

  if (entry && entry.joinedAt && !entry.leftAt) {
    entry.leftAt = new Date();
    recomputeLiveStatus(session, { action: 'PARTICIPANT_LEFT', actor });
    await session.save();

    await logVideoAudit({
      session,
      actor,
      action: 'PARTICIPANT_LEFT',
      outcome: 'INFO',
      ...requestMeta,
    });
  }

  return session;
};

/**
 * BET-14.3 — Meeting Lifecycle, "end-call handling". Only the
 * session's doctor or an admin-tier role may formally end a
 * consultation (matches the model's own docstring) — a patient may
 * `leaveSession` (which does not retire the session; the doctor can
 * still be joined, or the patient can rejoin), but only the clinical/
 * oversight side can close it out for good.
 */
export const endSession = async (id, actor, { reason = '' } = {}, options = {}) => {
  const session = await findSessionOrThrow(id);
  const requestMeta = requestMetaFrom(options);

  const isDoctor = String(session.doctor) === String(actor._id);
  const actorIsAdminTier = isAdminTier(actor.role);

  if (!isDoctor && !actorIsAdminTier) {
    await logVideoAudit({
      session,
      actor,
      action: 'ACCESS_DENIED',
      outcome: 'DENIED',
      denialReason: 'NOT_AUTHORIZED_TO_END',
      ...requestMeta,
    });
    throw new AppError('Only the consulting doctor or an administrator can end this session.', 403, {
      code: 'NOT_AUTHORIZED_TO_END',
    });
  }

  if (TERMINAL_VIDEO_SESSION_STATUSES.includes(session.status)) {
    throw new AppError(`This session is already ${session.status.toLowerCase()}.`, 409, {
      code: 'SESSION_ALREADY_TERMINAL',
    });
  }

  for (const participant of session.participants) {
    if (participant.joinedAt && !participant.leftAt) {
      participant.leftAt = new Date();
    }
  }

  pushHistory(session, { action: 'SESSION_ENDED', toStatus: 'ENDED', actor, reason });
  session.endedAt = new Date();
  session.endedBy = actor._id;
  session.endReason = reason || '';
  await session.save();

  await logVideoAudit({
    session,
    actor,
    action: 'SESSION_ENDED',
    outcome: 'INFO',
    ...requestMeta,
  });

  try {
    const io = getIo();
    if (io) {
      io.to(`video:${session.roomId}`).emit('video:ended', {
        sessionId: String(session._id),
        endedBy: String(actor._id),
        reason: session.endReason,
      });
    }
  } catch (error) {
    logger.warn({ err: error, sessionId: String(session._id) }, 'Failed to push video:ended socket event.');
  }

  await Promise.all(
    [session.patient, session.doctor].map((recipientId) =>
      createNotification({
        recipientId,
        type: NOTIFICATION_TYPES.VIDEO_CONSULTATION_ENDED,
        title: 'Video consultation ended',
        body: 'Your video consultation has ended.',
        relatedResource: { type: 'VideoSession', id: String(session._id) },
      }).catch((error) =>
        logger.warn({ err: error, recipientId: String(recipientId) }, 'Failed to send video-ended notification.'),
      ),
    ),
  );

  logger.info({ event: 'video_session_ended', sessionId: String(id), actor: String(actor._id) }, 'Video session ended.');

  return session;
};

// Exported purely for unit testing (see `tests/unit/bet14-video-session-state.test.js`)
// — both are pure functions with no DB access, the same "test the
// pure logic directly" approach `report-access.service.js` (BET-12)
// established for `assertCanAccessAsSelf`/`isAdminTier`.
export { connectedParticipantCount, recomputeLiveStatus };

export { VIDEO_PARTICIPANT_ROLES, ACTIVE_VIDEO_SESSION_STATUSES, TERMINAL_VIDEO_SESSION_STATUSES };
