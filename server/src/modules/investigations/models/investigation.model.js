import mongoose from 'mongoose';

/**
 * BET-12.1 — Investigation Domain, BET-12.2 — Investigation Lifecycle.
 *
 * An `Investigation` is the *order* — "do a CBC", "do a pelvic
 * ultrasound" — deliberately separate from `MedicalReport`
 * (`../../reports/models/medical-report.model.js`), which is the
 * actual uploaded result document. This mirrors the
 * `Appointment`/`QueueEntry` split BET-10 already established: one
 * domain concept owns the "what was ordered and where is it in its
 * own lifecycle" state machine, a different collection owns the
 * artifact that eventually satisfies it. One investigation may
 * accumulate more than one `MedicalReport` over time (master prompt
 * §BET-12.3 — "multiple reports/results for the same patient and
 * investigation over time"), e.g. a repeat test after an unreadable
 * first upload.
 *
 * `status` here intentionally stays coarser than the roadmap's full
 * "Ordered → ... → Finalized" chain (BET-12.2) — the fine-grained
 * upload/OCR/extraction/verification states in that chain describe a
 * single *report's* journey, which is where they actually live
 * (`MedicalReport.status`). `Investigation.status` tracks the
 * ordering-side lifecycle only, and is advanced to `COMPLETED`
 * by `modules/reports` (via `markInvestigationCompleted`) the moment
 * any of its reports reaches `FINALIZED` — a one-way callback, same
 * pattern `modules/queue` uses to update `Appointment` (never a
 * cross-module direct write to the other collection's fields).
 */
export const INVESTIGATION_STATUSES = Object.freeze([
  'ORDERED',
  'SCHEDULED',
  'SAMPLE_COLLECTED',
  'RESULT_PENDING',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
]);

export const INVESTIGATION_PRIORITIES = Object.freeze(['ROUTINE', 'URGENT', 'STAT']);

/**
 * Deliberately a flat category list rather than a nested taxonomy —
 * matches the flat enum style already used across this project
 * (`Medicine.dosageForm`, `Prescription.frequency`, etc.) and covers
 * every category the master prompt §25/§BET-12.1 names. `OTHER`
 * exists so a category not yet enumerated doesn't block ordering.
 */
export const INVESTIGATION_CATEGORIES = Object.freeze([
  'HEMATOLOGY', // CBC and related blood counts
  'BLOOD_CHEMISTRY',
  'URINE',
  'HORMONE',
  'MICROBIOLOGY',
  'PATHOLOGY',
  'BIOPSY',
  'CERVICAL_SCREENING', // Pap smear and related
  'IMAGING_ULTRASOUND',
  'IMAGING_XRAY',
  'IMAGING_CT',
  'IMAGING_MRI',
  'IMAGING_MAMMOGRAPHY',
  'PREGNANCY_TEST',
  'OBSTETRIC', // antenatal/fetal-monitoring investigations
  'GYNECOLOGICAL',
  'STI_STD',
  'OTHER',
]);

/**
 * Master prompt §16/§BET-12.23 — reproductive/sexual-health/pregnancy
 * investigations get the extra `SENSITIVE_RECORDS_*` gate on top of
 * `INVESTIGATIONS_*`/`REPORTS_*`, reusing BET-07's
 * `enforceSensitiveRecordAccess` (see
 * `modules/reports/services/report-access.service.js`). This is a
 * fixed, server-side classification — never client-supplied — so a
 * caller cannot order a pregnancy test and mark it non-sensitive to
 * dodge the extra gate.
 */
export const SENSITIVE_INVESTIGATION_CATEGORIES = Object.freeze([
  'CERVICAL_SCREENING',
  'PREGNANCY_TEST',
  'OBSTETRIC',
  'GYNECOLOGICAL',
  'STI_STD',
]);

export const isSensitiveInvestigationCategory = (category) =>
  SENSITIVE_INVESTIGATION_CATEGORIES.includes(category);

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 60 },
    fromStatus: { type: String, enum: [...INVESTIGATION_STATUSES, null], default: null },
    toStatus: { type: String, enum: INVESTIGATION_STATUSES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const investigationSchema = new mongoose.Schema(
  {
    // Human-friendly reference, same generator pattern as
    // `Appointment.appointmentReference` (BET-10).
    investigationReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Optional links — an investigation can be ordered mid-consultation
    // (Encounter) or tied to a specific visit (Appointment). Both
    // forward-referenced the same way `encounter.model.js` already
    // reserved `relatedInvestigations` for this module.
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter', default: null },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

    category: { type: String, enum: INVESTIGATION_CATEGORIES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 }, // e.g. "Complete Blood Count", "Pelvic Ultrasound"

    // Server-computed from `category` at creation time — never
    // client-supplied (master prompt §80). See `isSensitiveInvestigationCategory`.
    isSensitive: { type: Boolean, default: false, index: true },

    priority: { type: String, enum: INVESTIGATION_PRIORITIES, default: 'ROUTINE' },
    status: { type: String, enum: INVESTIGATION_STATUSES, default: 'ORDERED', index: true },

    clinicalIndication: { type: String, trim: true, maxlength: 500, default: '' },
    clinicalNotes: { type: String, trim: true, maxlength: 1000, default: '' },

    orderedDate: { type: Date, default: Date.now, index: true },
    scheduledDate: { type: Date, default: null },
    performedDate: { type: Date, default: null },

    cancellationReason: { type: String, trim: true, maxlength: 500, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },

    // Set by `modules/reports` the moment a linked report reaches
    // `FINALIZED` — this module never reads `MedicalReport` directly.
    completedAt: { type: Date, default: null },
    primaryReport: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalReport', default: null },

    history: { type: [historyEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

investigationSchema.index({ patientProfile: 1, orderedDate: -1 });
investigationSchema.index({ patient: 1, orderedDate: -1 });
investigationSchema.index({ orderedBy: 1, orderedDate: -1 });
investigationSchema.index({ status: 1, orderedDate: -1 });
investigationSchema.index({ category: 1 });

export const Investigation = mongoose.model('Investigation', investigationSchema, 'investigations');
