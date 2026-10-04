/**
 * FET-11 — mirrors the backend enums exactly
 * (`server/src/modules/reports/models/medical-report.model.js`),
 * same convention as `constants/investigations.js`.
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

export const REPORT_TYPES = Object.freeze([
  'LABORATORY',
  'IMAGING',
  'ULTRASOUND',
  'PATHOLOGY',
  'PAP_SMEAR',
  'GENERAL_DOCUMENT',
]);

export const ABNORMAL_FLAGS = Object.freeze([
  'NORMAL',
  'LOW',
  'HIGH',
  'CRITICAL_LOW',
  'CRITICAL_HIGH',
  'ABNORMAL',
  'UNKNOWN',
]);

const titleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// FET-17 — same optional-`t`-with-English-fallback pattern as
// `constants/investigations.js`.
const tOr = (t, key, fallback) => (typeof t === 'function' ? t(key, fallback) : fallback);

const STATUS_FALLBACKS = {
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  EXTRACTED: 'Extracted',
  NEEDS_REVIEW: 'Needs review',
  EXTRACTION_FAILED: 'Extraction failed',
  VERIFIED: 'Verified',
  FINALIZED: 'Finalized',
  AMENDED: 'Amended',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const TYPE_FALLBACKS = {
  PAP_SMEAR: 'Pap smear',
  GENERAL_DOCUMENT: 'General document',
};

const FLAG_FALLBACKS = {
  CRITICAL_LOW: 'Critical low',
  CRITICAL_HIGH: 'Critical high',
};

export const reportStatusLabel = (value, t) =>
  tOr(t, `clinical.report.status.${value}`, STATUS_FALLBACKS[value] || titleCase(value));
// FET-17 — `typeOptions`, not `type`: `clinical.report.type` is
// already the plain field-label key (table headers/select labels
// across `ReportsTab.jsx`, `UploadReportDialog.jsx`, `ReportsPage.jsx`,
// `MyClinicalRecordsPage.jsx`), so the enum values live one level
// under a differently-named key to avoid colliding with that leaf
// string in the resource JSON.
export const reportTypeLabel = (value, t) =>
  tOr(t, `clinical.report.typeOptions.${value}`, TYPE_FALLBACKS[value] || titleCase(value));
export const abnormalFlagLabel = (value, t) =>
  tOr(t, `clinical.report.abnormalFlag.${value}`, FLAG_FALLBACKS[value] || titleCase(value));

export const reportStatusVariant = (status) => {
  if (status === 'FINALIZED' || status === 'VERIFIED') return 'success';
  if (status === 'AMENDED') return 'info';
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'EXTRACTION_FAILED') return 'destructive';
  if (status === 'NEEDS_REVIEW') return 'warning';
  return 'neutral';
};

export const abnormalFlagVariant = (flag) => {
  if (flag === 'NORMAL') return 'success';
  if (flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH') return 'destructive';
  if (flag === 'LOW' || flag === 'HIGH' || flag === 'ABNORMAL') return 'warning';
  return 'neutral';
};

// Which report type each investigation category most naturally maps
// to when pre-filling the upload dialog — a UX convenience only, the
// uploader can always change it (mirrors the model's own note that
// `reportType` is never inferred from file content).
export const REPORT_TYPE_BY_CATEGORY = {
  IMAGING_ULTRASOUND: 'ULTRASOUND',
  IMAGING_XRAY: 'IMAGING',
  IMAGING_CT: 'IMAGING',
  IMAGING_MRI: 'IMAGING',
  IMAGING_MAMMOGRAPHY: 'IMAGING',
  BIOPSY: 'PATHOLOGY',
  PATHOLOGY: 'PATHOLOGY',
  CERVICAL_SCREENING: 'PAP_SMEAR',
};

export const INTAKE_STATUSES = Object.freeze([
  'PENDING_REVIEW',
  'ACCEPTED',
  'REJECTED',
]);

const INTAKE_STATUS_FALLBACKS = {
  PENDING_REVIEW: 'Pending Review',
  ACCEPTED: 'Accepted into Chart',
  REJECTED: 'Rejected',
};

export const intakeStatusLabel = (value, t) =>
  tOr(t, `clinical.intake.status.${value}`, INTAKE_STATUS_FALLBACKS[value] || titleCase(value));

export const intakeStatusVariant = (status) => {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'REJECTED') return 'destructive';
  if (status === 'PENDING_REVIEW') return 'warning';
  return 'neutral';
};

/**
 * Flexible Document Types (Section 2 Requirement)
 * Covers lab, imaging, cardiac, pathology, reproductive, and administrative clinical documents.
 */
export const DOCUMENT_TYPE_CATALOG = Object.freeze([
  { id: 'CBC', name: 'Complete Blood Count (CBC)', category: 'LABORATORY', sub: 'Blood test' },
  { id: 'BLOOD_GLUCOSE', name: 'Blood Glucose (Fasting / Random)', category: 'LABORATORY', sub: 'Blood test' },
  { id: 'HBA1C', name: 'HbA1c (Glycated Hemoglobin)', category: 'LABORATORY', sub: 'Diabetes' },
  { id: 'LIPID_PROFILE', name: 'Lipid Profile', category: 'LABORATORY', sub: 'Cardiovascular' },
  { id: 'LFT', name: 'Liver Function Tests (LFT)', category: 'LABORATORY', sub: 'Hepatic' },
  { id: 'KFT', name: 'Kidney Function Tests (Creatinine, Urea)', category: 'LABORATORY', sub: 'Renal' },
  { id: 'URINE_TEST', name: 'Urine Routine & Microscopic', category: 'LABORATORY', sub: 'Urinalysis' },
  { id: 'BLOOD_TEST_GENERAL', name: 'Other Blood Test Report', category: 'LABORATORY', sub: 'Laboratory' },

  { id: 'XRAY_REPORT', name: 'X-Ray Report', category: 'IMAGING', sub: 'Radiology' },
  { id: 'XRAY_IMAGE', name: 'X-Ray Image / Film', category: 'IMAGING', sub: 'Radiology' },
  { id: 'ULTRASOUND_REPORT', name: 'Ultrasound (USG) Report', category: 'ULTRASOUND', sub: 'Sonography' },
  { id: 'ULTRASOUND_IMAGE', name: 'Ultrasound Image', category: 'ULTRASOUND', sub: 'Sonography' },
  { id: 'MRI_REPORT', name: 'MRI Scan Report', category: 'IMAGING', sub: 'Magnetic Resonance' },
  { id: 'CT_SCAN_REPORT', name: 'CT Scan Report', category: 'IMAGING', sub: 'Computed Tomography' },
  { id: 'ECG_REPORT', name: 'ECG Report', category: 'IMAGING', sub: 'Cardiac' },
  { id: 'ECHOCARDIOGRAM', name: 'Echocardiogram (Echo)', category: 'IMAGING', sub: 'Cardiac' },

  { id: 'PATHOLOGY_REPORT', name: 'Pathology Report', category: 'PATHOLOGY', sub: 'Pathology' },
  { id: 'HISTOPATHOLOGY', name: 'Histopathology / Biopsy', category: 'PATHOLOGY', sub: 'Pathology' },
  { id: 'PAP_SMEAR', name: 'Pap Smear Report', category: 'PAP_SMEAR', sub: 'Cytology' },

  { id: 'PREGNANCY_REPORT', name: 'Pregnancy-Related Report', category: 'ULTRASOUND', sub: 'Obstetric' },
  { id: 'HORMONAL_TEST', name: 'Hormonal Test (Thyroid, etc.)', category: 'LABORATORY', sub: 'Endocrine' },
  { id: 'FERTILITY_INVESTIGATION', name: 'Fertility Investigation', category: 'LABORATORY', sub: 'Reproductive' },

  { id: 'PRESCRIPTION_DOC', name: 'Previous Prescription Document', category: 'GENERAL_DOCUMENT', sub: 'Prescription' },
  { id: 'DISCHARGE_SUMMARY', name: 'Hospital Discharge Summary', category: 'GENERAL_DOCUMENT', sub: 'Summary' },
  { id: 'REFERRAL_DOCUMENT', name: 'Referral Document / Letter', category: 'GENERAL_DOCUMENT', sub: 'Referral' },
  { id: 'OTHER_MEDICAL_DOC', name: 'Other Medical Document', category: 'GENERAL_DOCUMENT', sub: 'General' },
]);
