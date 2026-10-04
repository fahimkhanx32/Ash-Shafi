import { AuditLog, AUDIT_CATEGORIES, AUDIT_OUTCOMES } from './audit.model.js';
import { logger } from '../config/logger.js';

/**
 * BET-17 checkpoint 1 — general resource-level audit trail writer.
 *
 * Same fail-safe contract every other logging facility in this
 * project already follows (`recordSecurityEvent` — BET-03,
 * `logSensitiveRecordAccess` — BET-07, `logReportAccess` — BET-12):
 * a logging failure must never throw, never block, and never change
 * the outcome of the request it is observing. Callers `await` this
 * for ordering (so a log entry for a request that failed downstream
 * still gets written before the response), not because a rejection
 * needs to be handled.
 *
 * See `audit.model.js` for which categories belong here vs. in one
 * of the existing domain-specific logs.
 */
export const recordAuditEvent = async ({
  actor = null,
  actorRole = null,
  category,
  action,
  resourceType = null,
  resourceId = null,
  patientId = null,
  outcome = AUDIT_OUTCOMES.SUCCESS,
  reason = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) => {
  try {
    await AuditLog.create({
      actor,
      actorRole,
      category,
      action,
      resourceType,
      resourceId,
      patientId,
      outcome,
      reason,
      ipAddress,
      userAgent,
      metadata,
    });
  } catch (error) {
    logger.error(
      { err: error, category, action, resourceType, resourceId },
      'Failed to record audit event.',
    );
  }
};

/**
 * Small convenience wrapper for controllers: pulls actor/ip/userAgent
 * out of an authenticated Express `req` so call sites don't repeat
 * the same three lines everywhere. Anything else is passed through.
 */
export const recordAuditEventFromRequest = async (req, fields) => {
  await recordAuditEvent({
    actor: req.user?._id ?? null,
    actorRole: req.user?.role ?? null,
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.get?.('user-agent') ?? null,
    ...fields,
  });
};

export const recordUserAction = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.USER_ACTION,
    ...fields,
  });

export const recordAdministrativeAction = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.ADMINISTRATIVE_ACTION,
    ...fields,
  });

export const recordClinicalAccess = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.CLINICAL_ACCESS,
    ...fields,
  });

export const recordCreation = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.RECORD_CREATE,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    ...fields,
  });

// --- Checkpoint 1, second half: modification / deletion / export / file access ---
// Same fail-safe contract as everything above. Modules that already
// have their own dedicated, purpose-built access log covering these
// same categories (gynecology/obstetrics via
// `sensitive-record-access-log.model.js`, medical reports via
// `report-access-log.model.js`) are deliberately NOT duplicated here
// — see `audit.model.js`'s docstring. These wrappers exist for every
// other module that has no such dedicated log.
export const recordModification = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.RECORD_MODIFY,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    ...fields,
  });

export const recordDeletion = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.RECORD_DELETE,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    ...fields,
  });

export const recordExport = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.DATA_EXPORT,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    ...fields,
  });

export const recordFileAccess = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.FILE_ACCESS,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    ...fields,
  });

// BET-20 — Secure Analytics, "Analytics authorization" /
// "Analytics audit logging". Defaults to `ADMINISTRATIVE_ACTION`
// (operational/billing analytics are an administrative/operational
// reporting concern, same category `recordAdministrativeAction`
// already covers elsewhere), but a call site can override
// `category` to `CLINICAL_ACCESS` for the clinical-statistics
// domain specifically — that domain is derived from patient
// clinical data even though it is only ever returned aggregated, so
// it belongs alongside the project's other `CLINICAL_ACCESS`
// entries rather than being indistinguishable from an operational
// dashboard view.
export const recordAnalyticsAccess = (req, fields) =>
  recordAuditEventFromRequest(req, {
    category: AUDIT_CATEGORIES.ADMINISTRATIVE_ACTION,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    ...fields,
  });

export default {
  recordAuditEvent,
  recordAuditEventFromRequest,
  recordUserAction,
  recordAdministrativeAction,
  recordClinicalAccess,
  recordCreation,
  recordModification,
  recordDeletion,
  recordExport,
  recordFileAccess,
  recordAnalyticsAccess,
};
