/**
 * BET-19 — Patient mapping: `PatientProfile` (+ its linked `User`)
 * → FHIR R4 `Patient`.
 *
 * Deliberately maps only fields that have a genuine FHIR `Patient`
 * home. Ash-Shāfī-specific fields with no FHIR `Patient` equivalent
 * (medical-history arrays — allergies, chronic conditions,
 * medications — are their own FHIR resources, `AllergyIntolerance`/
 * `Condition`/`MedicationStatement`, out of this checkpoint's scope,
 * "Clinical-record mapping") are simply not included here rather
 * than crammed into an `extension` no consuming FHIR system would
 * understand.
 */

import {
  buildIdentifier,
  buildHumanName,
  buildContactPoint,
  buildAddress,
  fhirMeta,
} from '../utils/fhir-builder.util.js';
import { FHIR_IDENTIFIER_SYSTEMS, FHIR_CODE_SYSTEMS } from '../constants/fhir.constants.js';

// This project's own `PATIENT_GENDERS` enum
// (`modules/patients/models/patient-profile.model.js`) is broader
// than FHIR R4's fixed 4-value `administrative-gender` code system
// (male | female | other | unknown) — administrative-gender is
// explicitly *not* meant to capture gender identity, only the value
// needed for clinical/administrative purposes, per FHIR's own spec
// note. `PREFER_NOT_TO_SAY` has no honest match in that fixed set,
// so it maps to `unknown` rather than being forced into `other`
// (which FHIR reserves for a different, more specific meaning).
const GENDER_MAP = Object.freeze({
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  PREFER_NOT_TO_SAY: 'unknown',
});

/**
 * @param {import('mongoose').Document} patientProfile - a `PatientProfile` document
 * @param {{ name?: string, email?: string } | null} user - the linked `User`'s summary fields (name isn't stored on PatientProfile itself)
 * @returns {object} FHIR R4 Patient resource
 */
export const mapPatientToFhir = (patientProfile, user = null) => {
  if (!patientProfile) {
    throw new TypeError('mapPatientToFhir requires a PatientProfile document.');
  }

  const identifiers = [
    buildIdentifier({
      system: FHIR_IDENTIFIER_SYSTEMS.PATIENT_ID,
      value: patientProfile.patientId,
      use: 'usual',
    }),
    buildIdentifier({
      system: FHIR_IDENTIFIER_SYSTEMS.NATIONAL_ID,
      value: patientProfile.nationalIdNumber,
      use: 'official',
    }),
  ].filter(Boolean);

  const name = [
    buildHumanName({
      family: patientProfile.lastName,
      given: [patientProfile.firstName],
      text: user?.name || `${patientProfile.firstName} ${patientProfile.lastName}`.trim(),
    }),
  ];

  const telecom = [
    buildContactPoint({ system: 'phone', value: patientProfile.phone, use: 'mobile' }),
    buildContactPoint({ system: 'phone', value: patientProfile.alternatePhone, use: 'home' }),
    buildContactPoint({ system: 'email', value: user?.email, use: 'home' }),
  ].filter(Boolean);

  const address = [
    buildAddress({
      line: [patientProfile.address?.street],
      city: patientProfile.address?.city,
      state: patientProfile.address?.state,
      postalCode: patientProfile.address?.postalCode,
      country: patientProfile.address?.country,
    }),
  ].filter(Boolean);

  const contact = [];
  if (patientProfile.emergencyContact?.name || patientProfile.emergencyContact?.phone) {
    contact.push({
      relationship: patientProfile.emergencyContact.relationship
        ? [{ text: patientProfile.emergencyContact.relationship }]
        : undefined,
      name: buildHumanName({ text: patientProfile.emergencyContact.name }),
      telecom: [
        buildContactPoint({ system: 'phone', value: patientProfile.emergencyContact.phone }),
      ].filter(Boolean),
    });
  }

  return {
    resourceType: 'Patient',
    id: String(patientProfile._id),
    meta: fhirMeta(),
    active: patientProfile.status === 'ACTIVE',
    ...(identifiers.length > 0 ? { identifier: identifiers } : {}),
    name,
    ...(telecom.length > 0 ? { telecom } : {}),
    gender: GENDER_MAP[patientProfile.gender] || 'unknown',
    birthDate: patientProfile.dateOfBirth
      ? new Date(patientProfile.dateOfBirth).toISOString().slice(0, 10)
      : undefined,
    deceasedBoolean: patientProfile.status === 'DECEASED' ? true : undefined,
    ...(address.length > 0 ? { address } : {}),
    ...(contact.length > 0 ? { contact } : {}),
    // `PATIENT_BLOOD_GROUPS`/nationality/`bloodGroup` have no direct
    // FHIR `Patient` element (blood type is properly an
    // `Observation`, out of this checkpoint's scope) — deliberately
    // omitted rather than force-fit, per this file's own docstring.
  };
};

// Kept here (not used inside this file) only so the mapper and its
// own gender code-system reference stay next to each other for
// review.
export const PATIENT_GENDER_CODE_SYSTEM = FHIR_CODE_SYSTEMS.ADMINISTRATIVE_GENDER;
