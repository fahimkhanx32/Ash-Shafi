import { PERMISSIONS, hasPermission } from '../../../security/permissions.js';

/**
 * BET-06 — field-level access control for the general medical
 * history embedded in `PatientProfile`.
 *
 * `PATIENTS_READ` and `MEDICAL_RECORDS_READ` are deliberately
 * separate permissions in `security/permissions.js` (the RECEPTIONIST
 * role, for example, has the former but not the latter). Because the
 * medical-history fields (allergies, chronic conditions, surgeries,
 * medications, family history, social history, vaccinations, free-
 * text medical notes) live as embedded fields on the same
 * `PatientProfile` document as the plain demographic/administrative
 * fields, returning the raw document to anyone with mere
 * `PATIENTS_READ` would silently leak clinical history to roles that
 * were never granted `MEDICAL_RECORDS_READ` — the RBAC separation
 * would be enforced on paper but not in the actual API response.
 *
 * This module is the single place that decides whether a viewer sees
 * the medical-history fields on a given profile, and strips them
 * when not. A patient can always see their own full record.
 */

const MEDICAL_HISTORY_FIELDS = [
  'allergies',
  'chronicConditions',
  'surgeryHistory',
  'medicationHistory',
  'familyHistory',
  'socialHistory',
  'vaccinationHistory',
  'medicalNotes',
];

const resolveProfileUserId = (profile) => {
  const userRef = profile?.user;

  if (!userRef) {
    return null;
  }

  // `user` may be a populated document/lean-object ({ _id, ... }),
  // an un-populated ObjectId, or a plain string, depending on which
  // service call produced this profile.
  return userRef._id ?? userRef;
};

export const canViewMedicalHistory = (viewer, profile) => {
  if (!viewer) {
    return false;
  }

  const profileUserId = resolveProfileUserId(profile);
  const isSelf =
    !!profileUserId && String(profileUserId) === String(viewer._id);

  if (isSelf) {
    return true;
  }

  return hasPermission(viewer.role, PERMISSIONS.MEDICAL_RECORDS_READ);
};

/**
 * Returns a plain-object copy of `profileDoc` with the medical-
 * history fields removed when the viewer is not entitled to see
 * them. Never mutates the original document/lean-object.
 */
export const redactMedicalHistory = (profileDoc, viewer) => {
  if (!profileDoc) {
    return profileDoc;
  }

  const plain =
    typeof profileDoc.toObject === 'function'
      ? profileDoc.toObject({ virtuals: true })
      : { ...profileDoc };

  if (canViewMedicalHistory(viewer, plain)) {
    return plain;
  }

  for (const field of MEDICAL_HISTORY_FIELDS) {
    delete plain[field];
  }

  plain.medicalHistoryRedacted = true;

  return plain;
};

export const redactMedicalHistoryList = (profileDocs, viewer) => {
  return (profileDocs ?? []).map((doc) => redactMedicalHistory(doc, viewer));
};
