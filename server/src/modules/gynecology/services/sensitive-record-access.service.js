import { SensitiveRecordAccessLog } from '../models/sensitive-record-access-log.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-07 — "provider-based access" + access tracking.
 *
 * Holding `SENSITIVE_RECORDS_READ`/`SENSITIVE_RECORDS_WRITE`
 * (`security/permissions.js`, checked by the `authorize()` middleware
 * at the route layer) is necessary but not sufficient for a
 * `DOCTOR` — they must also be the patient's assigned
 * `primaryCareProvider` (`PatientProfile`, BET-06). This is a
 * deliberate design decision, not an inferred requirement: the
 * roadmap lists "Provider-based access" as its own bullet, separate
 * from "Role-based access", and there is no consultation/encounter
 * data yet (BET-09) to key the restriction off instead, so
 * `primaryCareProvider` is the most defensible signal available
 * right now for "is this doctor actually this patient's provider".
 *
 * `SOFTWARE_OWNER`/`SUPER_ADMIN`/`DIRECTOR` are exempt from the
 * provider check — they already sit above ordinary clinical staff in
 * `ROLE_HIERARCHY` and hold full administrative authority over
 * clinical records by design (see `rolePermissions` in
 * `security/permissions.js`, where all three already receive
 * `SENSITIVE_RECORDS_READ`/`WRITE` unconditionally).
 *
 * A `PATIENT` may always *read* (never write) their own record — the
 * same self-access shape BET-06 established for `GET /patients/me`.
 * Clinical fields here (STI history, screenings, procedures) are
 * clinician-authored; allowing patient self-write is a deliberate
 * scope decision left for a future task, not an oversight.
 */

const ADMIN_TIER_ROLES = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR];

export const assertSensitiveRecordAccess = (actor, patientProfile, { write = false } = {}) => {
  if (!actor || !patientProfile) {
    return { allowed: false, reason: 'MISSING_CONTEXT' };
  }

  if (ADMIN_TIER_ROLES.includes(actor.role)) {
    return { allowed: true, reason: null };
  }

  if (actor.role === ROLES.DOCTOR) {
    const providerId =
      patientProfile.primaryCareProvider?._id ?? patientProfile.primaryCareProvider;

    if (providerId && String(providerId) === String(actor._id)) {
      return { allowed: true, reason: null };
    }

    return { allowed: false, reason: 'NOT_ASSIGNED_PROVIDER' };
  }

  if (!write && actor.role === ROLES.PATIENT) {
    const ownerId = patientProfile.user?._id ?? patientProfile.user;

    if (ownerId && String(ownerId) === String(actor._id)) {
      return { allowed: true, reason: null };
    }

    return { allowed: false, reason: 'NOT_OWNER' };
  }

  return { allowed: false, reason: 'ROLE_NOT_PERMITTED' };
};

/**
 * Never let a logging failure block or mask the actual request
 * outcome — mirrors `recordSecurityEvent`'s fail-safe pattern
 * (`auth/security-event.service.js`, BET-03): log the failure
 * locally and move on.
 */
export const logSensitiveRecordAccess = async ({
  actor,
  patientProfile,
  action,
  outcome,
  denialReason = null,
  resource = 'gynecology_record',
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await SensitiveRecordAccessLog.create({
      actor: actor?._id ?? null,
      actorRole: actor?.role ?? null,
      patientProfile: patientProfile?._id ?? null,
      action,
      resource,
      outcome,
      denialReason,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    logger.error(
      { err: error, action, resource },
      'Failed to write sensitive-record access log.',
    );
  }
};

/**
 * Combines the access check with mandatory audit logging (both
 * ALLOWED and DENIED outcomes are logged) and throws a 403 on
 * denial. Every controller path that touches a `GynecologyRecord`
 * goes through this rather than calling `assertSensitiveRecordAccess`
 * directly, so access tracking can never be accidentally skipped.
 */
export const enforceSensitiveRecordAccess = async ({
  actor,
  patientProfile,
  write = false,
  action,
  resource = 'gynecology_record',
  requestMeta = {},
}) => {
  const { allowed, reason } = assertSensitiveRecordAccess(actor, patientProfile, { write });

  await logSensitiveRecordAccess({
    actor,
    patientProfile,
    action,
    resource,
    outcome: allowed ? 'ALLOWED' : 'DENIED',
    denialReason: reason,
    ...requestMeta,
  });

  if (!allowed) {
    throw new AppError(
      "You do not have access to this patient's sensitive clinical record.",
      403,
      { code: 'SENSITIVE_RECORD_ACCESS_DENIED' },
    );
  }
};
