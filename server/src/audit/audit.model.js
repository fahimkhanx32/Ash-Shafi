import mongoose from 'mongoose';

/**
 * BET-17 — general resource-level audit trail.
 *
 * This is the wide-scoped audit log the master prompt (§45) and the
 * BET-17 roadmap describe — distinct from, and additive to, the
 * narrower purpose-built logs earlier tasks already created for
 * their own domains:
 *   - `auth/security-event.model.js` (BET-03) — authentication/
 *     account-security events. This checkpoint does NOT duplicate
 *     those events into this collection; `auditService.recordEvent`
 *     is not called from `auth/auth.service.js`. Anyone querying
 *     "authentication audit" should read `security_events`.
 *   - `modules/gynecology/models/sensitive-record-access-log.model.js`
 *     (BET-07) and `modules/reports/models/report-access-log.model.js`
 *     (BET-12) — sensitive-record / medical-file access tracking.
 *     Not duplicated here either, for the same reason BET-07's own
 *     model docstring gives: a focused, purpose-built log is easier
 *     to reason about and query than one giant collection trying to
 *     serve every consumer.
 *
 * `audit_logs` is instead the home for the categories those
 * domain-specific logs don't already cover: general user actions,
 * administrative (RBAC/staff/account-lifecycle) actions, clinical
 * record access, record creation, record modification, record
 * deletion, data exports, and file access for every module that
 * doesn't have its own dedicated access log (patients, encounters,
 * prescriptions, investigations, appointments, staff, billing,
 * payments, messaging). Obstetrics reuses gynecology's log; medical
 * reports have their own (`report_access_logs`, BET-12), which
 * already covers that module's full VIEW/UPLOAD/DOWNLOAD/modify/
 * cancel/reject lifecycle — not duplicated here.
 *
 * `security_events` (BET-03, authentication) remains the source for
 * "authentication audit" per checkpoint 1's roadmap wording; it is
 * not mirrored into this collection either.
 *
 * As of the checkpoint-1 second half, this collection writes every
 * category below except `SECURITY_EVENT` (which stays in
 * `security_events`, per the note above): `USER_ACTION`,
 * `ADMINISTRATIVE_ACTION`, `CLINICAL_ACCESS`, `RECORD_CREATE`,
 * `RECORD_MODIFY`, `RECORD_DELETE`, `DATA_EXPORT`, `FILE_ACCESS`.
 */

export const AUDIT_CATEGORIES = Object.freeze({
  USER_ACTION: 'USER_ACTION',
  ADMINISTRATIVE_ACTION: 'ADMINISTRATIVE_ACTION',
  CLINICAL_ACCESS: 'CLINICAL_ACCESS',
  RECORD_CREATE: 'RECORD_CREATE',
  RECORD_MODIFY: 'RECORD_MODIFY',
  RECORD_DELETE: 'RECORD_DELETE',
  DATA_EXPORT: 'DATA_EXPORT',
  FILE_ACCESS: 'FILE_ACCESS',
  SECURITY_EVENT: 'SECURITY_EVENT',
});

export const AUDIT_OUTCOMES = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  DENIED: 'DENIED',
});

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    actorRole: {
      type: String,
      default: null,
    },

    category: {
      type: String,
      enum: Object.values(AUDIT_CATEGORIES),
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },

    resourceType: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      default: null,
      index: true,
    },

    // Optional before/after snapshot for a RECORD_MODIFY entry. Left
    // unset by every write in this checkpoint (controllers pass the
    // resource id/type, not a full diff) — available for a future
    // pass that wants field-level change tracking without a schema
    // migration.
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },

    outcome: {
      type: String,
      enum: Object.values(AUDIT_OUTCOMES),
      required: true,
      default: AUDIT_OUTCOMES.SUCCESS,
      index: true,
    },

    reason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    ipAddress: {
      type: String,
      default: null,
      maxlength: 100,
    },

    userAgent: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    // Free-form, small, non-sensitive context (e.g. { role: 'DOCTOR' }
    // for a role change). Never used to carry medical record contents
    // — see master prompt §57.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ patientId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
