import { SecurityEvent } from './security-event.model.js';
import { logger } from '../config/logger.js';

/**
 * Records an authentication/account security event.
 *
 * This deliberately never throws: a logging failure must never break
 * the authentication flow it is trying to observe. Failures are
 * logged at `error` level instead.
 *
 * @param {{
 *   userId?: string|null,
 *   type: string,
 *   ipAddress?: string|null,
 *   userAgent?: string|null,
 *   metadata?: Record<string, unknown>,
 * }} event
 */
export const recordSecurityEvent = async ({
  userId = null,
  type,
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) => {
  try {
    await SecurityEvent.create({
      userId,
      type,
      ipAddress,
      userAgent,
      metadata,
    });
  } catch (error) {
    logger.error(
      { err: error, type, userId },
      'Failed to record security event.',
    );
  }
};

/**
 * Lists recent security events for a given user, most recent first.
 *
 * @param {string} userId
 * @param {{ page?: number, limit?: number }} options
 */
export const listSecurityEventsForUser = async (
  userId,
  { page = 1, limit = 20 } = {},
) => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);

  const [items, total] = await Promise.all([
    SecurityEvent.find({ userId })
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SecurityEvent.countDocuments({ userId }),
  ]);

  return { items, total, page: safePage, limit: safeLimit };
};

/**
 * FET-20 prerequisite backend — admin cross-user security/
 * authentication event feed (master prompt: "Security events",
 * "Authentication events"). `listSecurityEventsForUser` above stays
 * as-is for any self-service caller; this is the admin-tier sibling
 * used by `modules/security-admin`, gated at the route layer on
 * `AUDIT_READ` (never exposed without a permission check — see that
 * module's route file).
 *
 * @param {{
 *   userId?: string|null,
 *   type?: string|null,
 *   ipAddress?: string|null,
 *   from?: string|null,
 *   to?: string|null,
 *   page?: number,
 *   limit?: number,
 * }} filters
 */
export const listSecurityEventsAdmin = async ({
  userId = null,
  type = null,
  ipAddress = null,
  from = null,
  to = null,
  page = 1,
  limit = 20,
} = {}) => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);

  const match = {};

  if (userId) match.userId = userId;
  if (type) match.type = type;
  if (ipAddress) match.ipAddress = ipAddress;

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    SecurityEvent.find(match)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('userId', 'name email username role isProtected')
      .lean(),
    SecurityEvent.countDocuments(match),
  ]);

  return { items, total, page: safePage, limit: safeLimit };
};

export default {
  recordSecurityEvent,
  listSecurityEventsForUser,
  listSecurityEventsAdmin,
};
