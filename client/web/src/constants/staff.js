/**
 * Mirrors the fixed enums in
 * `server/src/modules/staff/models/staff-profile.model.js` and
 * `server/src/users/user.model.js` exactly — for populating
 * <select> options only. The backend's Mongoose `enum` validators
 * remain the real source of truth; a stale value here would just
 * mean the dropdown offers something the server then rejects, not a
 * security gap (same posture as `constants/roles.js`).
 */
export const STAFF_DESIGNATIONS = Object.freeze([
  'DOCTOR',
  'ADMINISTRATOR',
  'NURSE',
  'MEDICAL_ASSISTANT',
  'RECEPTIONIST',
  'ACCOUNTANT',
  'PHARMACIST',
  'CONTENT_MANAGER',
  'SUPPORT_STAFF',
  'OTHER',
]);

export const STAFF_EMPLOYMENT_TYPES = Object.freeze([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'VISITING',
  'INTERN',
]);

export const STAFF_EMPLOYMENT_STATUSES = Object.freeze([
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED',
]);

export const STAFF_GENDERS = Object.freeze(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);

export const USER_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

// FET-17 gap-closure: `OTHER` (a real `STAFF_GENDERS` value) had no label
// entry, so it silently fell back to the raw string "OTHER" for gender
// display — fixed alongside adding real i18n keys below.
const LABELS = {
  DOCTOR: 'Doctor',
  ADMINISTRATOR: 'Administrator',
  NURSE: 'Nurse',
  MEDICAL_ASSISTANT: 'Medical Assistant',
  RECEPTIONIST: 'Receptionist',
  ACCOUNTANT: 'Accountant',
  PHARMACIST: 'Pharmacist',
  CONTENT_MANAGER: 'Content Manager',
  SUPPORT_STAFF: 'Support Staff',
  OTHER: 'Other',
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  VISITING: 'Visiting',
  INTERN: 'Intern',
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
  INACTIVE: 'Inactive',
  MALE: 'Male',
  FEMALE: 'Female',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  SOFTWARE_OWNER: 'Software Owner',
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR: 'Director',
  ADMIN: 'Admin',
  STAFF: 'Staff',
  PATIENT: 'Patient',
};

// FET-17 — `ACTIVE`/`INACTIVE`/`SUSPENDED` are shared, word-for-word, by
// both employment status and account status, so one `status` key group
// covers both call sites (`labelFor(profile.employmentStatus)` and
// `labelFor(user.status)`) without duplicating translations.
const KEY_GROUP = {
  DOCTOR: 'designation', ADMINISTRATOR: 'designation', NURSE: 'designation',
  MEDICAL_ASSISTANT: 'designation', RECEPTIONIST: 'designation', ACCOUNTANT: 'designation',
  PHARMACIST: 'designation', CONTENT_MANAGER: 'designation', SUPPORT_STAFF: 'designation', OTHER: 'designation',
  FULL_TIME: 'employmentType', PART_TIME: 'employmentType', CONTRACT: 'employmentType',
  VISITING: 'employmentType', INTERN: 'employmentType',
  ACTIVE: 'status', ON_LEAVE: 'status', SUSPENDED: 'status', TERMINATED: 'status', INACTIVE: 'status',
  MALE: 'gender', FEMALE: 'gender', PREFER_NOT_TO_SAY: 'gender',
  SOFTWARE_OWNER: 'role', SUPER_ADMIN: 'role', DIRECTOR: 'role', ADMIN: 'role', STAFF: 'role', PATIENT: 'role',
};

/**
 * FET-17 — real-translation-aware label lookup, same pattern as
 * `constants/patients.js#labelFor`: pass `t` from `useTranslation()` for a
 * localized label, omit it to keep the original English-only behavior.
 * `DOCTOR`/`RECEPTIONIST` are shared verbatim between the designation and
 * role enums (both mean the same job title in English and every other
 * locale here), so `KEY_GROUP` intentionally maps them once, to
 * `designation` — `staff.enum.designation.DOCTOR` also backs
 * `labelFor(user.role)` when the role is `DOCTOR`/`RECEPTIONIST`.
 */
export const labelFor = (value, t) => {
  const fallback = LABELS[value] || value;
  if (!t) return fallback;
  const group = KEY_GROUP[value];
  if (!group) return fallback;
  return t(`staff.enum.${group}.${value}`, fallback);
};
