import { Conversation } from '../models/conversation.model.js';
import { MessagingAccessLog } from '../models/messaging-access-log.model.js';
import { User } from '../../../users/user.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-13 — Chat Privacy (master prompt §30).
 *
 * Two-layer shape, same as `sensitive-record-access.service.js`
 * (BET-07) and `report-access.service.js` (BET-12):
 *   1. Route-level RBAC (`MESSAGING_READ`/`WRITE`, `authorize()`) —
 *      necessary but not sufficient.
 *   2. Service-level resource check, here: the caller must be one of
 *      the conversation's exactly-two fixed participants
 *      (`patient`/`doctor`), or hold admin-tier role for
 *      support/oversight access (logged either way).
 *
 * A non-participant, non-admin-tier caller gets a 404 (never 403) —
 * a conversation id must not be usable to enumerate whether a given
 * patient/doctor pair has an existing conversation at all (master
 * prompt §30/§80, same convention as `assertCanAccessAppointment`
 * and `assertCanAccessAsSelf`).
 */

const ADMIN_TIER_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
];

export const isAdminTier = (role) => ADMIN_TIER_ROLES.includes(role);

export const isParticipant = (conversation, userId) => {
  if (!conversation || !userId) return false;
  const patientId = conversation.patient?._id ?? conversation.patient;
  const doctorId = conversation.doctor?._id ?? conversation.doctor;
  const id = String(userId);
  return String(patientId) === id || String(doctorId) === id;
};

/**
 * Never let a logging failure block or mask the actual request
 * outcome — same fail-safe pattern as `recordSecurityEvent` (BET-03)
 * and `logSensitiveRecordAccess` (BET-07).
 */
export const logMessagingAccess = async ({
  actor,
  conversationId,
  action,
  outcome,
  denialReason = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await MessagingAccessLog.create({
      actor: actor?._id ?? null,
      actorRole: actor?.role ?? null,
      conversation: conversationId ?? null,
      action,
      outcome,
      denialReason,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    logger.error(
      { err: error, action },
      'Failed to write messaging access log.',
    );
  }
};

/**
 * REST-layer check. Only logs when an admin-tier caller is
 * accessing (or is denied access to) a conversation they are not a
 * participant in — see `messaging-access-log.model.js` for why
 * ordinary participant access is not logged here.
 */
export const assertIsConversationParticipant = async ({
  actor,
  conversation,
  write = false,
  requestMeta = {},
}) => {
  if (isParticipant(conversation, actor._id)) {
    return;
  }

  if (isAdminTier(actor.role)) {
    await logMessagingAccess({
      actor,
      conversationId: conversation._id,
      action: write ? 'WRITE' : 'VIEW',
      outcome: 'ALLOWED',
      ...requestMeta,
    });
    return;
  }

  await logMessagingAccess({
    actor,
    conversationId: conversation._id,
    action: write ? 'WRITE' : 'VIEW',
    outcome: 'DENIED',
    denialReason: 'NOT_PARTICIPANT',
    ...requestMeta,
  });

  throw new AppError('Conversation not found.', 404, {
    code: 'CONVERSATION_NOT_FOUND',
  });
};

/**
 * Socket-layer membership check (BET-13, consumed by
 * `socket/index.js`'s `conversation:join` handler). Deliberately a
 * separate, narrower entry point rather than reusing
 * `assertIsConversationParticipant` directly: the socket layer only
 * has a bare `userId` off the authenticated handshake, not a full
 * `req.user` actor object, and a socket-room join is a read-only
 * membership check, never a write — so this resolves the user's
 * current role itself (for the same admin-tier exemption) and always
 * treats the action as `VIEW`.
 *
 * Signature intentionally matches exactly what `socket/index.js`
 * already calls: `assertIsConversationParticipantById(conversationId, userId)`.
 */
export const assertIsConversationParticipantById = async (
  conversationId,
  userId,
) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new AppError('Conversation not found.', 404, {
      code: 'CONVERSATION_NOT_FOUND',
    });
  }

  if (isParticipant(conversation, userId)) {
    return conversation;
  }

  const user = await User.findById(userId).select('role');

  if (user && isAdminTier(user.role)) {
    await logMessagingAccess({
      actor: { _id: userId, role: user.role },
      conversationId: conversation._id,
      action: 'VIEW',
      outcome: 'ALLOWED',
    });
    return conversation;
  }

  await logMessagingAccess({
    actor: { _id: userId, role: user?.role ?? null },
    conversationId: conversation._id,
    action: 'VIEW',
    outcome: 'DENIED',
    denialReason: 'NOT_PARTICIPANT',
  });

  throw new AppError('Conversation not found.', 404, {
    code: 'CONVERSATION_NOT_FOUND',
  });
};
