import mongoose from 'mongoose';

/**
 * BET-12.3/12.21 — `MedicalReport` is the actual uploaded result
 * document — deliberately separate from `Investigation`
 * (`../../investigations/models/investigation.model.js`), which is
 * the *order*. One `Investigation` may accumulate more than one
 * `MedicalReport` over time (repeat test after an unreadable first
 * upload, follow-up imaging, etc.) — see `Investigation`'s own
 * docstring for the full split rationale.
 *
 * `status` here implements the full BET-12.2 lifecycle for a single
 * report's journey (upload → OCR → extraction → review → doctor
 * verification → finalized), which is deliberately *not* tracked on
 * `Investigation.status` (that field only tracks the coarser
 * ordering-side lifecycle).
 */
export const REPORT_STATUSES = Object.freeze([
  'UPLOADED',
  'PROCESSING',
  'EXTRACTED',
  'NEEDS_REVIEW',
  'EXTRACTION_FAILED',
  'VERIFIED',
  'FINALIZED',
  'AMENDED',
  'REJECTED',
  'CANCELLED',
]);

/**
 * BET-12.22 — different report structures get different sections.
 * `reportType` is set explicitly by the uploader (from the parent
 * `Investigation.category`, or chosen directly for a standalone
 * upload) — never inferred from file content, since a mis-inferred
 * type would silently steer the extraction parser down the wrong
 * path.
 */
export const REPORT_TYPES = Object.freeze([
  'LABORATORY',
  'IMAGING',
  'ULTRASOUND',
  'PATHOLOGY',
  'PAP_SMEAR',
  'GENERAL_DOCUMENT',
]);

/**
 * Where a report came from. `STAFF_UPLOAD` is every pre-existing
 * report (the default, so legacy documents need no migration).
 * `PATIENT_SUBMITTED` / `STAFF_ON_BEHALF` come through the intake
 * endpoint and start life as an unverified submission awaiting a
 * doctor's intake review — see `../services/report-intake.service.js`.
 */
// Fine-grained document kind chosen in the UI. `reportType` stays the coarse
// category that drives sensitivity/OCR-parsing/filters; every sub-type maps to
// exactly one `reportType` (see DOCUMENT_SUBTYPE_TO_REPORT_TYPE).
export const DOCUMENT_SUBTYPE_TO_REPORT_TYPE = Object.freeze({
  BLOOD_TEST: 'LABORATORY',
  BIOCHEMISTRY: 'LABORATORY',
  HORMONAL_TEST: 'LABORATORY',
  URINE_TEST: 'LABORATORY',
  STOOL_TEST: 'LABORATORY',
  MICROBIOLOGY: 'LABORATORY',
  XRAY: 'IMAGING',
  CT_SCAN: 'IMAGING',
  MRI: 'IMAGING',
  RADIOLOGY: 'IMAGING',
  ECG: 'IMAGING',
  ULTRASOUND: 'ULTRASOUND',
  PATHOLOGY: 'PATHOLOGY',
  HISTOPATHOLOGY: 'PATHOLOGY',
  PAP_SMEAR: 'PAP_SMEAR',
  PRESCRIPTION_DOCUMENT: 'GENERAL_DOCUMENT',
  DISCHARGE_SUMMARY: 'GENERAL_DOCUMENT',
  REFERRAL_DOCUMENT: 'GENERAL_DOCUMENT',
  OTHER: 'GENERAL_DOCUMENT',
});

export const DOCUMENT_SUBTYPES = Object.freeze(Object.keys(DOCUMENT_SUBTYPE_TO_REPORT_TYPE));

export const REPORT_SOURCES = Object.freeze(['STAFF_UPLOAD', 'PATIENT_SUBMITTED', 'STAFF_ON_BEHALF']);

export const INTAKE_STATUSES = Object.freeze(['PENDING_REVIEW', 'ACCEPTED', 'REJECTED']);

export const EXTRACTION_SOURCES = Object.freeze(['OCR', 'PDF_TEXT_LAYER', 'SPREADSHEET', 'MANUAL']);

export const CONFIDENCE_LEVELS = Object.freeze(['HIGH', 'MEDIUM', 'LOW', 'UNCERTAIN']);

export const ABNORMAL_FLAGS = Object.freeze([
  'NORMAL',
  'LOW',
  'HIGH',
  'CRITICAL_LOW',
  'CRITICAL_HIGH',
  'ABNORMAL',
  'UNKNOWN',
]);

/**
 * BET-12.14/12.15 — per-parameter verification state. A parameter
 * starts `PENDING` the moment it exists (whether from OCR extraction
 * or manual entry) and must be explicitly moved by a doctor before a
 * report can be verified — see `ALLOWED_REPORT_TRANSITIONS.NEEDS_REVIEW`
 * in `../services/report.service.js`, which refuses `VERIFIED` while
 * any parameter is still `PENDING`.
 */
export const PARAMETER_VERIFICATION_STATUSES = Object.freeze([
  'PENDING',
  'CONFIRMED',
  'CORRECTED',
  'REJECTED',
]);

/**
 * BET-12.10/12.12/12.15 — one structured test result. `extraction` is
 * an immutable snapshot of exactly what OCR/parsing first produced
 * (or null fields if the parameter was entered manually) — the
 * "Original OCR: Hemoglobin = 11.2" half of the master prompt's
 * worked example. The top-level `value`/`unit`/`referenceRange`/
 * `abnormalFlag` fields are the *current, authoritative* values,
 * which start out equal to the extraction but can be corrected by a
 * doctor (`verification.correctedValue`/`correctionReason`) without
 * ever mutating `extraction` itself — so "OCR misread digit" style
 * corrections stay traceable to what the machine actually produced
 * (master prompt §BET-12.15/12.16: "Never silently replace the OCR
 * value").
 */
const reportParameterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 }, // e.g. "Hemoglobin"

    // Current, authoritative value — starts equal to `extraction`,
    // may be corrected by a doctor via the verification workflow.
    value: { type: String, trim: true, maxlength: 200, default: '' }, // textual, as-read (e.g. "11.2", "Positive")
    numericValue: { type: Number, default: null }, // parsed numeric form, only if genuinely numeric
    unit: { type: String, trim: true, maxlength: 40, default: null },
    referenceRange: { type: String, trim: true, maxlength: 100, default: null },

    // Server-computed only when a numeric value AND a numeric
    // reference range were both actually present in the source —
    // never guessed (master prompt §BET-12.12). 'UNKNOWN' when there
    // isn't enough information to classify.
    abnormalFlag: { type: String, enum: ABNORMAL_FLAGS, default: 'UNKNOWN' },

    specimenType: { type: String, trim: true, maxlength: 100, default: '' },

    source: { type: String, enum: EXTRACTION_SOURCES, required: true },
    confidence: { type: String, enum: CONFIDENCE_LEVELS, default: 'UNCERTAIN' },

    // Immutable snapshot of the machine-extracted (or manually
    // entered-as-first-pass) values — never overwritten by a
    // correction. Null fields for a purely MANUAL parameter that was
    // never OCR'd.
    extraction: {
      rawValue: { type: String, trim: true, maxlength: 200, default: null },
      rawUnit: { type: String, trim: true, maxlength: 40, default: null },
      rawReferenceRange: { type: String, trim: true, maxlength: 100, default: null },
      confidence: { type: String, enum: [...CONFIDENCE_LEVELS, null], default: null },
      sourceLine: { type: String, trim: true, maxlength: 300, default: null }, // OCR line this was parsed from, for doctor comparison
    },

    verification: {
      status: { type: String, enum: PARAMETER_VERIFICATION_STATUSES, default: 'PENDING' },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null },
      correctionReason: { type: String, trim: true, maxlength: 500, default: '' },
    },
  },
  { _id: true, timestamps: false },
);

const extractionJobSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['NOT_STARTED', 'RUNNING', 'COMPLETED', 'FAILED'],
      default: 'NOT_STARTED',
    },
    provider: { type: String, trim: true, maxlength: 40, default: null },
    providerVersion: { type: String, trim: true, maxlength: 40, default: null },
    language: { type: String, trim: true, maxlength: 40, default: null },
    extractedText: { type: String, default: '' }, // Machine Extracted — never itself "verified clinical information"
    confidence: { type: Number, min: 0, max: 1, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    error: { type: String, trim: true, maxlength: 500, default: null },
    attempts: { type: Number, default: 0 },
    unparsedLines: { type: [String], default: [] }, // lines the parser deliberately did not guess at
  },
  { _id: false },
);

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 60 },
    fromStatus: { type: String, enum: [...REPORT_STATUSES, null], default: null },
    toStatus: { type: String, enum: REPORT_STATUSES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

/**
 * BET-12.16 — an amendment is only created when correcting an
 * already-`FINALIZED` report. It snapshots the pre-change parameters/
 * interpretation in full before the change is applied, so a
 * finalized clinical result is never silently overwritten (master
 * prompt §50). Corrections made *before* finalization go through the
 * ordinary per-parameter `verification` flow above and don't need a
 * full-report snapshot — only a post-finalization change is
 * significant enough to need one.
 */
const amendmentSchema = new mongoose.Schema(
  {
    amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amendedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 500, required: true },
    previousParameters: { type: mongoose.Schema.Types.Mixed, default: [] },
    previousInterpretation: { type: String, default: '' },
  },
  { _id: true },
);

/**
 * Intake metadata. `intakeStatus` is `null` for ordinary staff uploads
 * and only ever set for PATIENT_SUBMITTED / STAFF_ON_BEHALF reports.
 * Accepting a submission does NOT verify it: verification stays on the
 * existing per-parameter + `REPORTS_VERIFY` workflow. Acceptance only
 * means "a doctor has looked at this and it belongs in the chart".
 */
const submissionSchema = new mongoose.Schema(
  {
    source: { type: String, enum: REPORT_SOURCES, default: 'STAFF_UPLOAD' },
    uploadedByRole: { type: String, trim: true, maxlength: 40, default: null },
    patientNote: { type: String, trim: true, maxlength: 500, default: '' },
    // The doctor the submitter picked (may be null when routed only to
    // the patient's assigned provider).
    targetDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Every doctor whose intake inbox this appears in: targetDoctor
    // plus the patient's primaryCareProvider at submission time.
    routedTo: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    intakeStatus: { type: String, enum: [...INTAKE_STATUSES, null], default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false },
);

const medicalReportSchema = new mongoose.Schema(
  {
    reportReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    investigation: { type: mongoose.Schema.Types.ObjectId, ref: 'Investigation', default: null, index: true },
    orderingDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    performingFacility: { type: String, trim: true, maxlength: 200, default: '' },

    reportType: { type: String, enum: REPORT_TYPES, required: true },
    documentSubType: { type: String, enum: [...DOCUMENT_SUBTYPES, null], default: null },
    title: { type: String, trim: true, maxlength: 200, required: true },
    clinicalIndication: { type: String, trim: true, maxlength: 500, default: '' },

    // Server-computed at creation from the parent Investigation's
    // `isSensitive` (or the explicit reportType for a standalone
    // upload with no investigation) — never client-supplied, same
    // pattern as `Investigation.isSensitive` (master prompt §80).
    isSensitive: { type: Boolean, default: false, index: true },

    reportDate: { type: Date, default: null }, // date printed on the report itself
    uploadDate: { type: Date, default: Date.now },

    status: { type: String, enum: REPORT_STATUSES, default: 'UPLOADED', index: true },

    // BET-12.6 — the original file is the source document and is
    // never replaced by OCR output. `storage` never contains a public
    // URL — delivery is always proxied through
    // `report.service.js#downloadReport` after an authorization
    // check (master prompt §BET-12.5/12.31).
    originalDocument: {
      storageFilename: { type: String, required: true }, // internal, non-guessable generated name (security/file-security.js)
      originalFilename: { type: String, required: true }, // sanitized, for display only
      mimeType: { type: String, required: true },
      sizeBytes: { type: Number, required: true },
      fileHash: { type: String, required: true, index: true }, // sha256, for BET-12.28 duplicate detection
      cloudinaryPublicId: { type: String, required: true },
      cloudinaryResourceType: { type: String, required: true },
      pageCount: { type: Number, default: null }, // PDF/DOCX only, from metadata extraction (BET-12.32)
      // Document-embedded title (docProps/core.xml `dc:title`) for .docx/
      // .xlsx uploads — distinct from the user-authored `title` field
      // above; this is whatever the uploaded file's own author metadata
      // says, purely descriptive, never clinically authoritative
      // (BET-12.32).
      embeddedTitle: { type: String, trim: true, maxlength: 300, default: null },
    },

    possibleDuplicateOf: { type: [mongoose.Schema.Types.ObjectId], ref: 'MedicalReport', default: [] },
    duplicateReviewed: { type: Boolean, default: false }, // an authorized user acknowledged the possible-duplicate flag

    extraction: { type: extractionJobSchema, default: () => ({}) },

    parameters: { type: [reportParameterSchema], default: [] },

    // BET-12.22 — per-report-type structured sections beyond the flat
    // lab-style `parameters[]` list. Deliberately `Mixed` rather than
    // a rigid nested schema — the exact shape genuinely differs by
    // `reportType` (imaging findings/impression vs. Pap smear
    // adequacy/interpretation vs. a general document's raw text), and
    // over-specifying it here would force every report type into the
    // laboratory shape. Populated by manual entry or the doctor
    // review workflow, never auto-guessed from OCR text.
    structuredSections: { type: mongoose.Schema.Types.Mixed, default: {} },

    // BET-12.18 — separate from `parameters`/`structuredSections`.
    // Free-text, clinician-authored only. OCR/extraction never
    // populates this field and never generates a diagnosis
    // (master prompt §BET-12.18/12.37).
    interpretation: { type: String, trim: true, maxlength: 3000, default: '' },

    verification: {
      status: {
        type: String,
        enum: ['NOT_STARTED', 'IN_REVIEW', 'VERIFIED'],
        default: 'NOT_STARTED',
      },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null },
    },

    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },

    amendments: { type: [amendmentSchema], default: [] },

    cancellationReason: { type: String, trim: true, maxlength: 500, default: '' },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: '' },

    history: { type: [historyEntrySchema], default: [] },

    submission: { type: submissionSchema, default: () => ({}) },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

medicalReportSchema.index({ patientProfile: 1, uploadDate: -1 });
medicalReportSchema.index({ patientProfile: 1, status: 1, uploadDate: -1 });
medicalReportSchema.index({ patient: 1, uploadDate: -1 });
medicalReportSchema.index({ investigation: 1, status: 1, uploadDate: -1 });
medicalReportSchema.index({ status: 1, uploadDate: -1 });
medicalReportSchema.index({ reportType: 1 });
medicalReportSchema.index({ isSensitive: 1, patientProfile: 1, uploadDate: -1 });
medicalReportSchema.index({ 'submission.routedTo': 1, 'submission.intakeStatus': 1, uploadDate: -1 });
medicalReportSchema.index({ 'submission.intakeStatus': 1, uploadDate: -1 });

export const MedicalReport = mongoose.model('MedicalReport', medicalReportSchema, 'medical_reports');
