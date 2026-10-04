import mongoose from 'mongoose';

/**
 * BET-12.24 — File Access Audit.
 *
 * Deliberately its own collection (`report_access_logs`), separate
 * from `sensitive_record_access_logs` (BET-07) and from the general
 * audit trail still reserved for `audit/audit.model.js` (BET-17) —
 * same "narrow, purpose-built log" pattern `SecurityEvent` (BET-03)
 * and `SensitiveRecordAccessLog` (BET-07) already established. Every
 * report action is logged here regardless of sensitivity; a
 * *sensitive* report's access additionally goes through BET-07's
 * `enforceSensitiveRecordAccess` (which writes its own entry to
 * `sensitive_record_access_logs`) — so a sensitive report ends up
 * covered by both logs, deliberately, per master prompt §BET-12.23's
 * extra protection for reproductive/sexual-health reports.
 */
export const REPORT_ACCESS_ACTIONS = Object.freeze([
  'UPLOAD',
  'VIEW',
  'DOWNLOAD',
  'OCR_INITIATED',
  'OCR_COMPLETED',
  'OCR_FAILED',
  'MANUAL_ENTRY',
  'PARAMETER_REVIEWED',
  'RESULT_VERIFIED',
  'RESULT_FINALIZED',
  'RESULT_AMENDED',
  'REPORT_CANCELLED',
  'REPORT_REJECTED',
  'DUPLICATE_REVIEWED',
  'INTAKE_REVIEW',
  'REPORT_SHARE',
]);

const reportAccessLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },

    report: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalReport', default: null, index: true },
    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', default: null, index: true },

    action: { type: String, enum: REPORT_ACCESS_ACTIONS, required: true },
    outcome: { type: String, enum: ['ALLOWED', 'DENIED'], required: true },
    denialReason: { type: String, default: null },

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

reportAccessLogSchema.index({ report: 1, createdAt: -1 });
reportAccessLogSchema.index({ patientProfile: 1, createdAt: -1 });
reportAccessLogSchema.index({ actor: 1, createdAt: -1 });

export const ReportAccessLog = mongoose.model(
  'ReportAccessLog',
  reportAccessLogSchema,
  'report_access_logs',
);
