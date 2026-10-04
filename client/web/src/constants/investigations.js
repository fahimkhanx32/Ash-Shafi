/**
 * FET-11 — mirrors the backend enums exactly
 * (`server/src/modules/investigations/models/investigation.model.js`)
 * so the UI never offers or invents a value the backend doesn't
 * accept. Same convention `constants/prescriptions.js` (FET-10)
 * already established.
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

export const INVESTIGATION_CATEGORIES = Object.freeze([
  'HEMATOLOGY',
  'BLOOD_CHEMISTRY',
  'URINE',
  'HORMONE',
  'MICROBIOLOGY',
  'PATHOLOGY',
  'BIOPSY',
  'CERVICAL_SCREENING',
  'IMAGING_ULTRASOUND',
  'IMAGING_XRAY',
  'IMAGING_CT',
  'IMAGING_MRI',
  'IMAGING_MAMMOGRAPHY',
  'PREGNANCY_TEST',
  'OBSTETRIC',
  'GYNECOLOGICAL',
  'STI_STD',
  'OTHER',
]);

// Mirrors `SENSITIVE_INVESTIGATION_CATEGORIES` on the backend — UX
// only (e.g. showing a privacy notice); the real gate is the
// server-computed `isSensitive` field returned on every investigation.
export const SENSITIVE_INVESTIGATION_CATEGORIES = Object.freeze([
  'CERVICAL_SCREENING',
  'PREGNANCY_TEST',
  'OBSTETRIC',
  'GYNECOLOGICAL',
  'STI_STD',
]);

const titleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// FET-17 — same optional-`t`-with-English-fallback pattern
// `constants/billing.js` / `constants/prescriptions.js` use.
const tOr = (t, key, fallback) => (typeof t === 'function' ? t(key, fallback) : fallback);

const CATEGORY_FALLBACKS = {
  IMAGING_ULTRASOUND: 'Ultrasound',
  IMAGING_XRAY: 'X-Ray',
  IMAGING_CT: 'CT scan',
  IMAGING_MRI: 'MRI',
  IMAGING_MAMMOGRAPHY: 'Mammography',
  STI_STD: 'STI / STD',
};

const STATUS_FALLBACKS = {
  ORDERED: 'Ordered',
  SCHEDULED: 'Scheduled',
  SAMPLE_COLLECTED: 'Sample collected',
  RESULT_PENDING: 'Result pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

// FET-17 — `categoryOptions`/`priorityOptions` (not `category`/
// `priority`) deliberately: `clinical.investigation.category` and
// `clinical.investigation.priority` are already real i18n keys for
// this module's plain field labels (see `InvestigationsTab.jsx`,
// `OrderInvestigationDialog.jsx`, `InvestigationDetailDialog.jsx`),
// so nesting the enum values one level under the same key here would
// collide with those leaf strings in the resource JSON.
export const investigationCategoryLabel = (value, t) =>
  tOr(t, `clinical.investigation.categoryOptions.${value}`, CATEGORY_FALLBACKS[value] || titleCase(value));
export const investigationStatusLabel = (value, t) =>
  tOr(t, `clinical.investigation.status.${value}`, STATUS_FALLBACKS[value] || titleCase(value));
export const investigationPriorityLabel = (value, t) =>
  tOr(t, `clinical.investigation.priorityOptions.${value}`, titleCase(value));

export const investigationStatusVariant = (status) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'destructive';
  if (status === 'RESULT_PENDING' || status === 'SAMPLE_COLLECTED') return 'info';
  if (status === 'SCHEDULED') return 'warning';
  return 'neutral';
};

export const investigationPriorityVariant = (priority) => {
  if (priority === 'STAT') return 'destructive';
  if (priority === 'URGENT') return 'warning';
  return 'neutral';
};
