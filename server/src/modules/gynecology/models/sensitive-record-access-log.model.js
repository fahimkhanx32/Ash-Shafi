import mongoose from 'mongoose';

/**
 * BET-07 — sensitive-record audit trail / access tracking.
 *
 * Deliberately a narrowly-scoped, purpose-built log — the same
 * pattern `auth/security-event.model.js` established in BET-03 —
 * rather than being folded into the general resource audit trail
 * reserved for BET-17 (`audit/audit.model.js`, still empty). Every
 * read or write attempt against a `GynecologyRecord` is logged here,
 * including denied attempts (`outcome: 'DENIED'`), so this doubles as
 * both a compliance trail ("who viewed this patient's sensitive
 * record, and when") and an unauthorized-access signal ("who kept
 * trying and being denied").
 */

export const SENSITIVE_RECORD_ACCESS_ACTIONS = Object.freeze([
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
]);

export const SENSITIVE_RECORD_ACCESS_OUTCOMES = Object.freeze([
  'ALLOWED',
  'DENIED',
]);

const sensitiveRecordAccessLogSchema = new mongoose.Schema(
  {
    // The patient whose record was accessed/attempted. Nullable only
    // in the rare case the target patient couldn't be resolved at
    // all (e.g. a malformed/nonexistent id) — logged anyway since a
    // stream of these is itself a signal worth tracking.
    patientProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      default: null,
      index: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Denormalized so this collection can be queried/reported on
    // (e.g. "show all RECEPTIONIST access attempts") without a join
    // back through `User` for every row.
    actorRole: {
      type: String,
      required: true,
    },

    action: {
      type: String,
      enum: SENSITIVE_RECORD_ACCESS_ACTIONS,
      required: true,
    },

    // What was accessed within the record, e.g. 'gynecology_record',
    // 'sti_history', 'cervical_screening' — free-form but drawn from
    // a fixed set of resource names in the service layer.
    resource: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'gynecology_record',
    },

    outcome: {
      type: String,
      enum: SENSITIVE_RECORD_ACCESS_OUTCOMES,
      required: true,
      index: true,
    },

    // Populated only when outcome is DENIED — e.g.
    // 'NOT_ASSIGNED_PROVIDER', 'NOT_OWNER', 'ROLE_NOT_PERMITTED'.
    denialReason: {
      type: String,
      default: null,
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

sensitiveRecordAccessLogSchema.index({ createdAt: -1 });
sensitiveRecordAccessLogSchema.index({ patientProfile: 1, createdAt: -1 });
sensitiveRecordAccessLogSchema.index({ actor: 1, createdAt: -1 });
sensitiveRecordAccessLogSchema.index({ outcome: 1, createdAt: -1 });

export const SensitiveRecordAccessLog = mongoose.model(
  'SensitiveRecordAccessLog',
  sensitiveRecordAccessLogSchema,
  'sensitive_record_access_logs',
);
