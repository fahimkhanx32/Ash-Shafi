import { AuditLog } from '../../../audit/audit.model.js';
import { SecurityEvent } from '../../../auth/security-event.model.js';
import { Notification } from '../../notifications/models/notification.model.js';
import { User } from '../../../users/user.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { verifyPassword } from '../../../security/password.js';
import env from '../../../config/env.js';
import {
  getResolvedRetentionPolicy,
  getPurgeEligibleKeys,
} from '../policy/retention-policy.js';

/**
 * BET-17 Checkpoint 4 — Retention policies, permanent deletion,
 * controlled deletion & data-ownership/lifecycle rules (master
 * prompt §38, §83, §84).
 *
 * This is deliberately the ONLY place in the codebase that performs
 * a generic, retention-window-driven physical `deleteMany`. It only
 * ever acts on the categories `retention-policy.js` marks
 * `PURGE_ELIGIBLE` (currently: the audit trail past its configured
 * legal-style retention window, and read notifications past their
 * configured retention window) — every other category in the policy
 * catalog is `NEVER_DELETE`/`SOFT_DELETE_ONLY`/`AUTO_TTL` and this
 * service will reject a request naming one of them rather than
 * silently no-op or (worse) delete it, so a caller can never widen
 * the blast radius by passing an unexpected category string.
 *
 * "Controlled deletion" (master prompt §10-style privileged-
 * operation discipline, reused here for a different but similarly
 * irreversible action) means every purge call requires, together:
 *   - the caller's own current password (re-verified here, the same
 *     "prove you are who you say you are" bar
 *     `account-deletion.service.js#requestAccountDeletion` already
 *     set for another irreversible account-security action)
 *   - an explicit `confirm: true` flag (never inferred/defaulted)
 *   - a written `reason` (>= 10 characters)
 *   - `SYSTEM_ADMIN` permission, which today only SOFTWARE_OWNER and
 *     SUPER_ADMIN hold (see `security/permissions.js`)
 * and is unconditionally recorded via the caller's own
 * `recordAdministrativeAction` call (`DATA_RETENTION_PURGE_EXECUTED`
 * / `DATA_RETENTION_PURGE_DENIED`) — this service never writes the
 * audit entry itself, matching the established pattern where the
 * controller (which has the request context) owns that call.
 *
 * A real, working task scheduler (node-cron or similar) is not
 * present anywhere in this project yet — `jobs/` is empty scaffolding
 * and no such dependency is installed. Automating this on a schedule
 * is therefore explicitly BET-18's concern (Backup, Recovery & Data
 * Protection also needs the same scheduler infrastructure), not
 * this checkpoint's. This is an explicit, manually-triggered,
 * privileged operation — never an invisible background job — which
 * is also exactly what master prompt §10 asks for from any
 * irreversible privileged action.
 */

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// One handler pair per PURGE_ELIGIBLE category. Deliberately a fixed,
// hand-written map (not derived generically from the policy catalog)
// so adding a new purge-eligible category always requires a
// deliberate code change here, not just a data-catalog edit.
const PREVIEW_HANDLERS = {
  AUDIT_TRAIL: async () => {
    const cutoff = daysAgo(env.audit.retentionDays);
    const [auditLogs, securityEvents] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $lt: cutoff } }),
      SecurityEvent.countDocuments({ createdAt: { $lt: cutoff } }),
    ]);
    return { audit_logs: auditLogs, security_events: securityEvents };
  },
  IN_APP_NOTIFICATIONS: async () => {
    const cutoff = daysAgo(env.dataLifecycle.notificationRetentionDays);
    const count = await Notification.countDocuments({
      readAt: { $ne: null, $lt: cutoff },
    });
    return { notifications: count };
  },
};

const PURGE_HANDLERS = {
  AUDIT_TRAIL: async () => {
    const cutoff = daysAgo(env.audit.retentionDays);
    const [auditLogs, securityEvents] = await Promise.all([
      AuditLog.deleteMany({ createdAt: { $lt: cutoff } }),
      SecurityEvent.deleteMany({ createdAt: { $lt: cutoff } }),
    ]);
    return {
      audit_logs: auditLogs.deletedCount,
      security_events: securityEvents.deletedCount,
    };
  },
  IN_APP_NOTIFICATIONS: async () => {
    const cutoff = daysAgo(env.dataLifecycle.notificationRetentionDays);
    const result = await Notification.deleteMany({
      readAt: { $ne: null, $lt: cutoff },
    });
    return { notifications: result.deletedCount };
  },
};

/**
 * The full data-ownership/lifecycle catalog (master prompt §38's
 * "configurable retention policy" requirement) — every collection in
 * the system, its owning module, and how it may ever be disposed of.
 */
export const getRetentionPolicy = () => getResolvedRetentionPolicy();

const splitByEligibility = (requested) => {
  const eligible = getPurgeEligibleKeys();

  if (!requested || requested.length === 0) {
    return { targets: eligible, rejected: [] };
  }

  const targets = requested.filter((key) => eligible.includes(key));
  const rejected = requested.filter((key) => !eligible.includes(key));

  return { targets, rejected };
};

/**
 * Dry-run — counts what a purge would delete, without deleting
 * anything. Any requested category that is not `PURGE_ELIGIBLE` is
 * reported back under `rejected` rather than silently ignored, so a
 * caller always sees why a category didn't run.
 */
export const previewExpiredData = async ({ categories } = {}) => {
  const { targets, rejected } = splitByEligibility(categories);

  const counts = {};

  for (const key of targets) {
    counts[key] = await PREVIEW_HANDLERS[key]();
  }

  return { targets, rejected, counts };
};

/**
 * The actual controlled, permanent-deletion operation. See the
 * module docstring above for the full confirmation contract.
 */
export const purgeExpiredData = async ({
  categories,
  reason,
  confirm,
  password,
  actorId,
}) => {
  if (confirm !== true) {
    throw new AppError(
      'Explicit confirmation is required to permanently delete data ("confirm": true).',
      400,
      { code: 'PURGE_CONFIRMATION_REQUIRED' },
    );
  }

  if (!reason || reason.trim().length < 10) {
    throw new AppError(
      'A reason of at least 10 characters is required to permanently delete data.',
      400,
      { code: 'PURGE_REASON_REQUIRED' },
    );
  }

  const actor = await User.findById(actorId).select('+passwordHash');

  if (!actor) {
    throw new AppError('Acting user account not found.', 404, {
      code: 'USER_NOT_FOUND',
    });
  }

  const passwordValid = await verifyPassword(actor.passwordHash, password);

  if (!passwordValid) {
    throw new AppError('Current password is incorrect.', 401, {
      code: 'INVALID_CURRENT_PASSWORD',
    });
  }

  const { targets, rejected } = splitByEligibility(categories);

  if (targets.length === 0) {
    throw new AppError(
      'No requested category is eligible for permanent deletion.',
      400,
      { code: 'NO_PURGE_ELIGIBLE_CATEGORY', details: { rejected } },
    );
  }

  const results = {};

  for (const key of targets) {
    results[key] = await PURGE_HANDLERS[key]();
  }

  logger.warn(
    {
      event: 'data_retention_purge_executed',
      actorId: String(actorId),
      targets,
      rejected,
      results,
      reason,
    },
    'Controlled data-retention purge executed.',
  );

  return { targets, rejected, results };
};
