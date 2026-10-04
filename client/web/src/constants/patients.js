/**
 * FET-06 — mirrors the fixed enums in
 * `server/src/modules/patients/models/patient-profile.model.js` exactly,
 * for populating <select> options and formatting labels only. The
 * backend's Mongoose `enum` validators remain the real source of truth
 * (same posture as `constants/staff.js`/`constants/roles.js`) — a stale
 * value here would just mean a dropdown offers something the server then
 * rejects, not a security gap.
 */
export const PATIENT_GENDERS = Object.freeze(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);

// Alias used by PrescriptionWorkspacePage and other prescription components
export const BLOOD_GROUPS = Object.freeze([
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN',
]);

export const PATIENT_BLOOD_GROUPS = Object.freeze([
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'UNKNOWN',
]);

export const PATIENT_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE', 'DECEASED']);

export const PREFERRED_LANGUAGES = Object.freeze(['en', 'bn', 'hi', 'ur']);

export const PREFERRED_COMMUNICATION_METHODS = Object.freeze([
  'EMAIL',
  'SMS',
  'PHONE',
  'WHATSAPP',
]);

const LABELS = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  UNKNOWN: 'Unknown',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DECEASED: 'Deceased',
  en: 'English',
  bn: 'Bangla',
  hi: 'Hindi',
  ur: 'Urdu',
  EMAIL: 'Email',
  SMS: 'SMS',
  PHONE: 'Phone call',
  WHATSAPP: 'WhatsApp',
};

// FET-17 — which i18n key group a given raw enum value resolves under.
// `PATIENT_GENDERS`/`PATIENT_STATUSES`/`PREFERRED_COMMUNICATION_METHODS`
// values are unique across all three groups today, so a single lookup by
// value (not by which array it came from) is unambiguous; blood groups and
// preferred languages get their own groups since e.g. `en`/`bn` overlap
// with nothing else here but `preferredLanguage` mirrors `settings.language.*`.
const KEY_GROUP = {
  MALE: 'gender', FEMALE: 'gender', OTHER: 'gender', PREFER_NOT_TO_SAY: 'gender',
  'A+': 'bloodGroup', 'A-': 'bloodGroup', 'B+': 'bloodGroup', 'B-': 'bloodGroup',
  'AB+': 'bloodGroup', 'AB-': 'bloodGroup', 'O+': 'bloodGroup', 'O-': 'bloodGroup', UNKNOWN: 'bloodGroup',
  ACTIVE: 'status', INACTIVE: 'status', DECEASED: 'status',
  en: 'language', bn: 'language', hi: 'language', ur: 'language',
  EMAIL: 'communicationMethod', SMS: 'communicationMethod', PHONE: 'communicationMethod', WHATSAPP: 'communicationMethod',
};

/**
 * FET-17 — real-translation-aware label lookup. Pass the `t` from
 * `useTranslation()` to get a localized label; omitting it (or calling from
 * non-component code) falls back to the same English `LABELS` table this
 * helper always returned, so every existing call site keeps working
 * unmodified during the localization pass.
 * `preferredLanguage` deliberately resolves through `settings.language.*`
 * (not its own `patients.enum.language.*` copy) since it is the exact same
 * language-name list the language switcher already renders.
 */
export const labelFor = (value, t) => {
  const fallback = LABELS[value] || value;
  if (!t) return fallback;
  const group = KEY_GROUP[value];
  if (!group) return fallback;
  const key = group === 'language' ? `settings.language.${value}` : `patients.enum.${group}.${value}`;
  return t(key, fallback);
};

export const patientStatusVariant = (status) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INACTIVE') return 'neutral';
  if (status === 'DECEASED') return 'destructive';
  return 'neutral';
};
