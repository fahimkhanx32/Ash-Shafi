import { ReportAccessLog } from '../models/report-access-log.model.js';
import {
  enforceSensitiveRecordAccess,
  logSensitiveRecordAccess,
} from '../../gynecology/services/sensitive-record-access.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-12.5/12.19/12.20/12.24 — Medical File Privacy + File Access
 * Audit.
 *
 * Two-layer authorization, same shape BET-07 established for
 * `GynecologyRecord` and BET-12.1 reused for `Investigation`:
 *   1. Route-level RBAC (`REPORTS_READ`/`WRITE`/`VERIFY`,
 *      `authorize()` middleware) — necessary but not sufficient.
 *   2. Service-level resource check, here:
 *      - A `PATIENT` may only ever access their own reports —
 *        never the client-supplied `patientProfileId`/`patient`
 *        (master prompt §80, same as `assertCanAccessAsSelf` in
 *        `investigation.service.js`).
 *      - A sensitive report (`MedicalReport.isSensitive`) additionally
 *        requires the BET-07 provider-tier check — a `DOCTOR` must be
 *        the patient's assigned `primaryCareProvider`; admin-tier
 *        roles are exempt. Reused directly rather than forked, same
 *        decision `investigation.service.js` made.
 *
 * Every call is logged to `report_access_logs` (allowed or denied)
 * regardless of sensitivity — a sensitive report's check additionally
 * writes its own entry to `sensitive_record_access_logs` via
 * `enforceSensitiveRecordAccess`, so sensitive reports end up with
 * two independent audit trails.
 */

const ADMIN_TIER_ROLES = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR];

export const assertCanAccessAsSelf = (report, actor) => {
  if (actor.role !== ROLES.PATIENT) {
    return true;
  }
  const ownerId = report.patient?._id ?? report.patient;
  return Boolean(ownerId) && String(ownerId) === String(actor._id);
};

/**
 * Never let a logging failure block or mask the actual request
 * outcome — same fail-safe pattern as `recordSecurityEvent` (BET-03)
 * and `logSensitiveRecordAccess` (BET-07).
 */
export const logReportAccess = async ({
  actor,
  report,
  patientProfile,
  action,
  outcome,
  denialReason = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await ReportAccessLog.create({
      actor: actor?._id ?? null,
      actorRole: actor?.role ?? null,
      report: report?._id ?? null,
      patientProfile: (patientProfile?._id ?? patientProfile) || null,
      action,
      outcome,
      denialReason,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    logger.error({ err: error, action }, 'Failed to write report access log.');
  }
};

/**
 * `write`: true for any mutating action (upload/OCR/manual entry/
 * review/verify/finalize/amend/cancel/reject); false for view/download.
 * Throws a 404 (never a 403) on a `PATIENT` ownership mismatch, so a
 * report id can't be used to enumerate other patients' reports
 * (master prompt §30/§80, same convention as
 * `assertCanAccessAppointment`).
 */
export const enforceReportAccess = async ({ actor, report, write = false, action, requestMeta = {} }) => {
  if (!assertCanAccessAsSelf(report, actor)) {
    throw new AppError('Report not found.', 404, { code: 'REPORT_NOT_FOUND' });
  }

  const routedForIntakeReview =
    action === 'INTAKE_REVIEW' &&
    actor?.role === ROLES.DOCTOR &&
    (report.submission?.routedTo || []).some((d) => String(d?._id ?? d) === String(actor._id));

  if (report.isSensitive && actor?.role === ROLES.DOCTOR && (!write || routedForIntakeReview)) {
    // Product decision (2026-10): any doctor may READ any patient's
    // reports, including sensitive types (ultrasound, Pap smear), and a
    // doctor a submission was ROUTED to may accept/reject it from their
    // inbox (otherwise a picked doctor could open but never action it).
    // Every other WRITE (verify, finalize, amend, ...) keeps the
    // assigned-provider rule, as does the separate gynecology-record module. The read is still audited in
    // `sensitive_record_access_logs`.
    await logSensitiveRecordAccess({
      actor,
      patientProfile: report.patientProfile,
      action,
      resource: 'medical_report',
      outcome: 'ALLOWED',
      denialReason: null,
      ...requestMeta,
    });
  } else if (report.isSensitive) {
    // Reuses BET-07's choke point directly — also writes its own
    // entry to `sensitive_record_access_logs`.
    await enforceSensitiveRecordAccess({
      actor,
      patientProfile: report.patientProfile,
      write,
      action,
      resource: 'medical_report',
      requestMeta,
    });
  }

  await logReportAccess({
    actor,
    report,
    patientProfile: report.patientProfile,
    action,
    outcome: 'ALLOWED',
    ...requestMeta,
  });
};

export const isAdminTier = (actor) => ADMIN_TIER_ROLES.includes(actor?.role);
