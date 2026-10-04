/**
 * FET-10 — mirrors the backend enums exactly (copied from
 * `server/src/modules/medicines/models/medicine.model.js` and
 * `server/src/modules/prescriptions/models/prescription.model.js`) so
 * the UI never offers or invents a value the backend doesn't accept.
 */
export const DOSAGE_FORMS = Object.freeze([
  'TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'IV_INFUSION',
  'CREAM', 'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'SUPPOSITORY', 'PESSARY', 'PATCH', 'OTHER',
]);

export const ROUTES = Object.freeze([
  'ORAL', 'TOPICAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS',
  'VAGINAL', 'RECTAL', 'INHALATION', 'OPHTHALMIC', 'NASAL', 'OTHER',
]);

export const VERIFICATION_STATUSES = Object.freeze(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']);

export const FREQUENCIES = Object.freeze([
  'ONCE_DAILY', 'TWICE_DAILY', 'THREE_TIMES_DAILY', 'FOUR_TIMES_DAILY',
  'EVERY_OTHER_DAY', 'WEEKLY', 'AS_NEEDED', 'OTHER',
]);

export const DURATION_UNITS = Object.freeze(['DAYS', 'WEEKS', 'MONTHS', 'ONGOING']);

export const PRESCRIPTION_STATUSES = Object.freeze(['DRAFT', 'FINALIZED', 'SUPERSEDED']);

const titleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// FET-17 — same optional-`t`-with-English-fallback pattern
// `constants/billing.js`'s label helpers use: a call site that
// passes `t` gets the translated string (`clinical.medicine.*` /
// `clinical.prescription.*` keys); a call site that doesn't (or a
// key that's momentarily missing) still gets the exact original
// English label via `titleCase`/the literal fallback, so nothing
// regresses for a caller not yet updated.
const tOr = (t, key, fallback) => (typeof t === 'function' ? t(key, fallback) : fallback);

export const dosageFormLabel = (value, t) =>
  tOr(t, `clinical.medicine.dosageForm.${value}`, value === 'IV_INFUSION' ? 'IV infusion' : titleCase(value));

export const routeLabel = (value, t) => tOr(t, `clinical.medicine.route.${value}`, titleCase(value));

const FREQUENCY_FALLBACKS = {
  ONCE_DAILY: 'Once daily',
  TWICE_DAILY: 'Twice daily',
  THREE_TIMES_DAILY: 'Three times daily',
  FOUR_TIMES_DAILY: 'Four times daily',
  EVERY_OTHER_DAY: 'Every other day',
  WEEKLY: 'Weekly',
  AS_NEEDED: 'As needed',
  OTHER: 'As directed',
};
// FET-17 — `frequencyOptions`, not `frequency`: `clinical.prescription
// .frequency` is already the plain field-label key
// (`PrescriptionItemsEditor.jsx`'s "Frequency" label), so the enum
// values live one level under a differently-named key to avoid
// colliding with that leaf string in the resource JSON.
export const frequencyLabel = (value, t) =>
  tOr(t, `clinical.prescription.frequencyOptions.${value}`, FREQUENCY_FALLBACKS[value] || titleCase(value));

const DURATION_UNIT_FALLBACKS = {
  DAYS: 'day(s)',
  WEEKS: 'week(s)',
  MONTHS: 'month(s)',
  ONGOING: 'Ongoing',
};
export const durationUnitLabel = (value, t) =>
  tOr(t, `clinical.prescription.durationUnit.${value}`, DURATION_UNIT_FALLBACKS[value] || titleCase(value));

const VERIFICATION_STATUS_FALLBACKS = {
  UNVERIFIED: 'Unverified',
  VERIFIED: 'Verified',
  NEEDS_REVIEW: 'Needs review',
};
export const verificationStatusLabel = (value, t) =>
  tOr(t, `clinical.medicine.verificationStatus.${value}`, VERIFICATION_STATUS_FALLBACKS[value] || titleCase(value));

const PRESCRIPTION_STATUS_FALLBACKS = {
  DRAFT: 'Draft',
  FINALIZED: 'Finalized',
  SUPERSEDED: 'Superseded',
};
export const prescriptionStatusLabel = (value, t) =>
  tOr(t, `clinical.prescription.status.${value}`, PRESCRIPTION_STATUS_FALLBACKS[value] || titleCase(value));

export const verificationStatusVariant = (status) => {
  if (status === 'VERIFIED') return 'success';
  if (status === 'NEEDS_REVIEW') return 'warning';
  return 'neutral';
};

export const prescriptionStatusVariant = (status) => {
  if (status === 'FINALIZED') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'SUPERSEDED') return 'neutral';
  return 'neutral';
};

// One blank line item — shape matches `prescriptionItemSchema` on the
// backend exactly (`medicineRef` stays null for a freehand item never
// picked from the `Medicine` catalog, which the backend allows).
export const emptyPrescriptionItem = () => ({
  medicineRef: null,
  genericName: '',
  brandName: '',
  strength: '',
  dosageForm: '',
  route: '',
  frequency: 'ONCE_DAILY',
  timing: '',
  durationValue: '',
  durationUnit: 'DAYS',
  quantity: '',
  instructions: '',
  notes: '',
});

// Shape matches `prescriptionLabTestSchema` on the backend exactly
// (`feeRef` stays null for a freehand test never picked from the
// `Fee` catalog, which the backend allows — same allowance
// `emptyPrescriptionItem` above gives medicines).
export const emptyLabTestItem = () => ({
  feeRef: null,
  testName: '',
  category: '',
  cost: '',
  currency: 'BDT',
  notes: '',
});

// Server-computed and server-validated (`min(0)`) — this is purely a
// display total for the doctor while building the form / the patient
// while reading it, never sent back to the backend as its own field.
export const labTestsTotalCost = (labTests) =>
  (labTests || []).reduce((sum, test) => sum + (Number(test.cost) || 0), 0);
