import { VideoSession } from '../models/video-session.model.js';
import { VideoSessionAuditLog } from '../models/video-session-audit-log.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-14.5 — Video Security & Access Control (master prompt §32/§80).
 *
 * Same two-layer shape as every other sensitive-resource module in
 * this project (`sensitive-record-access.service.js` BET-07,
 * `report-access.service.js` BET-12, `conversation-access.service.js`
 * BET-13):
 *   1. Route-level RBAC (`APPOINTMENTS_READ`/`WRITE`, `authorize()`)
 *      — necessary but not sufficient.
 *   2. Service-level resource check, here: the caller must be the
 *      session's own `patient` or `doctor`, or hold an admin-tier
 *      role for support/oversight access (always logged).
 *
 * A non-participant, non-admin-tier caller gets a 404 (never 403) —
 * a session id must not be usable to enumerate whether a given
 * appointment has a video session at all (master prompt §80, the
 * same IDOR/BOLA-hardening convention `assertCanAccessAppointment`
 * and `assertIsConversationParticipant` already use).
 */

const ADMIN_TIER_ROLES = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR];

export const isAdminTier = (role) => ADMIN_TIER_ROLES.includes(role);

export const isSessionParticipant = (session, userId) => {
  if (!session || !userId) return false;
  const patientId = session.patient?._id ?? session.patient;
  const doctorId = session.doctor?._id ?? session.doctor;
  const id = String(userId);
  return String(patientId) === id || String(doctorId) === id;
};

/**
 * Never let a logging failure block or mask the actual request
 * outcome — same fail-safe pattern as `recordSecurityEvent` (BET-03),
 * `logSensitiveRecordAccess` (BET-07), and `logMessagingAccess`
 * (BET-13).
 */
export const logVideoAudit = async ({
  session = null,
  appointmentId = null,
  actor,
  action,
  outcome,
  denialReason = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await VideoSessionAuditLog.create({
      session: session?._id ?? session ?? null,
      appointment: appointmentId ?? session?.appointment ?? null,
      actor: actor?._id ?? null,
      actorRole: actor?.role ?? null,
      action,
      outcome,
      denialReason,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    logger.error({ err: error, action }, 'Failed to write video session audit log.');
  }
};

/**
 * REST-layer check. Throws a 404 `VIDEO_SESSION_NOT_FOUND` for a
 * non-participant, non-admin-tier caller. Logs every admin-tier
 * bypass (allowed or denied) — same "only the exception path needs
 * an audit row" reasoning `conversation-access.service.js` documents
 * for itself — but unlike messaging, BET-14.6 also wants ordinary
 * participant access logged at the *action* level (join/leave/end),
 * which the individual service functions in `video-session.service.js`
 * handle themselves via `logVideoAudit`; this function only covers
 * the identity/authorization gate itself.
 */
export const assertCanAccessSession = async (session, actor, { requestMeta = {} } = {}) => {
  if (isSessionParticipant(session, actor._id)) {
    return;
  }

  if (isAdminTier(actor.role)) {
    await logVideoAudit({
      session,
      actor,
      action: 'JOIN_ALLOWED',
      outcome: 'ALLOWED',
      ...requestMeta,
    });
    return;
  }

  await logVideoAudit({
    session,
    actor,
    action: 'ACCESS_DENIED',
    outcome: 'DENIED',
    denialReason: 'NOT_PARTICIPANT',
    ...requestMeta,
  });

  throw new AppError('Video session not found.', 404, { code: 'VIDEO_SESSION_NOT_FOUND' });
};

/**
 * Socket-layer membership check (consumed by `socket/index.js`'s
 * `video:join` handler) — mirrors
 * `assertIsConversationParticipantById` exactly. Deliberately a
 * separate, narrower entry point: the socket layer only has a bare
 * `userId` off the authenticated handshake, not a full `req.user`
 * actor object.
 */
export const assertIsSessionParticipantById = async (sessionId, userId) => {
  const session = await VideoSession.findById(sessionId);

  if (!session) {
    throw new AppError('Video session not found.', 404, { code: 'VIDEO_SESSION_NOT_FOUND' });
  }

  if (isSessionParticipant(session, userId)) {
    return session;
  }

  throw new AppError('Video session not found.', 404, { code: 'VIDEO_SESSION_NOT_FOUND' });
};

export { ADMIN_TIER_ROLES };
