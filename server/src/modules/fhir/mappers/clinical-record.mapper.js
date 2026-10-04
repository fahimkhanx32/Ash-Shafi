/**
 * BET-19 — Clinical-record mapping: the general medical-history
 * arrays embedded on `PatientProfile`
 * (`modules/patients/models/patient-profile.model.js` — BET-06) →
 * their own dedicated FHIR R4 resources. Each of these has a real,
 * specific FHIR home distinct from `Patient` itself, which is
 * exactly why `patient.mapper.js`'s own docstring says these are
 * deliberately excluded from the `Patient` resource and left to this
 * later checkpoint.
 *
 * All three mappers here return an array (one source array element →
 * one resource each), the same one-to-many shape
 * `medication-request.mapper.js` established — never a single
 * resource, since a `PatientProfile` can hold zero-to-many of each.
 *
 * Deliberately out of scope for this file: `GynecologyRecord`/
 * `PregnancyRecord` (BET-07/08) sensitive reproductive-health data.
 * Those are protected by provider-based access control specifically
 * because of their sensitivity (see that module's own access-log
 * pattern) — folding them into a general clinical-record FHIR export
 * would bypass that protection model. If a future task needs FHIR
 * export of sensitive records, it should reuse
 * `enforceSensitiveRecordAccess` explicitly, not extend this file.
 */

import { fhirMeta, buildReference, buildCodeableConcept } from '../utils/fhir-builder.util.js';
import { FHIR_CODE_SYSTEMS } from '../constants/fhir.constants.js';

const ALLERGY_SEVERITY_MAP = Object.freeze({
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  // FHIR's `AllergyIntolerance.reaction.severity` is a 3-value set
  // (mild | moderate | severe) with no life-threatening code of its
  // own — the distinction is instead carried in `criticality`
  // (see below), so LIFE_THREATENING still maps to the closest
  // reaction-severity value rather than being dropped.
  LIFE_THREATENING: 'severe',
});

// FHIR's separate `criticality` element (low | high | unable-to-assess)
// is where "could this kill the patient" actually belongs — mapped
// from the same source field for the one value that clearly implies it.
const ALLERGY_CRITICALITY_MAP = Object.freeze({
  LIFE_THREATENING: 'high',
});

/**
 * @param {import('mongoose').Document} patientProfile - a `PatientProfile` document
 * @returns {object[]} FHIR R4 AllergyIntolerance resources, one per `allergies[]` entry
 */
export const mapAllergiesToFhir = (patientProfile) => {
  if (!patientProfile) {
    throw new TypeError('mapAllergiesToFhir requires a PatientProfile document.');
  }
  if (!Array.isArray(patientProfile.allergies)) return [];

  return patientProfile.allergies.map((allergy) => ({
    resourceType: 'AllergyIntolerance',
    id: String(allergy._id),
    meta: fhirMeta(),
    clinicalStatus: buildCodeableConcept({
      system: FHIR_CODE_SYSTEMS.CONDITION_CLINICAL_STATUS,
      code: allergy.isActive ? 'active' : 'inactive',
    }),
    code: buildCodeableConcept({ text: allergy.allergen }),
    patient: buildReference({ resourceType: 'Patient', id: String(patientProfile._id) }),
    ...(allergy.diagnosedDate
      ? { recordedDate: new Date(allergy.diagnosedDate).toISOString() }
      : {}),
    ...(ALLERGY_CRITICALITY_MAP[allergy.severity]
      ? { criticality: ALLERGY_CRITICALITY_MAP[allergy.severity] }
      : {}),
    ...(allergy.reaction
      ? {
          reaction: [
            {
              description: allergy.reaction,
              ...(ALLERGY_SEVERITY_MAP[allergy.severity]
                ? { severity: ALLERGY_SEVERITY_MAP[allergy.severity] }
                : {}),
            },
          ],
        }
      : {}),
    ...(allergy.notes ? { note: [{ text: allergy.notes }] } : {}),
  }));
};

const CONDITION_CLINICAL_STATUS_MAP = Object.freeze({
  ACTIVE: 'active',
  MANAGED: 'active', // still an ongoing condition, just clinically controlled — FHIR has no separate "managed" code
  RESOLVED: 'resolved',
  CHRONIC: 'active',
});

/**
 * @param {import('mongoose').Document} patientProfile - a `PatientProfile` document
 * @returns {object[]} FHIR R4 Condition resources, one per `chronicConditions[]` entry
 */
export const mapChronicConditionsToFhir = (patientProfile) => {
  if (!patientProfile) {
    throw new TypeError('mapChronicConditionsToFhir requires a PatientProfile document.');
  }
  if (!Array.isArray(patientProfile.chronicConditions)) return [];

  return patientProfile.chronicConditions.map((condition) => ({
    resourceType: 'Condition',
    id: String(condition._id),
    meta: fhirMeta(),
    clinicalStatus: buildCodeableConcept({
      system: FHIR_CODE_SYSTEMS.CONDITION_CLINICAL_STATUS,
      code: CONDITION_CLINICAL_STATUS_MAP[condition.status] || 'unknown',
    }),
    code: buildCodeableConcept({ text: condition.condition }),
    subject: buildReference({ resourceType: 'Patient', id: String(patientProfile._id) }),
    ...(condition.diagnosedDate
      ? { onsetDateTime: new Date(condition.diagnosedDate).toISOString() }
      : {}),
    ...(condition.treatment || condition.notes
      ? { note: [{ text: [condition.treatment, condition.notes].filter(Boolean).join(' — ') }] }
      : {}),
  }));
};

/**
 * @param {import('mongoose').Document} patientProfile - a `PatientProfile` document
 * @returns {object[]} FHIR R4 Immunization resources, one per `vaccinationHistory[]` entry
 */
export const mapVaccinationsToFhir = (patientProfile) => {
  if (!patientProfile) {
    throw new TypeError('mapVaccinationsToFhir requires a PatientProfile document.');
  }
  if (!Array.isArray(patientProfile.vaccinationHistory)) return [];

  return patientProfile.vaccinationHistory.map((vaccination) => ({
    resourceType: 'Immunization',
    id: String(vaccination._id),
    meta: fhirMeta(),
    // This project records only that a dose was administered, never
    // a refusal/not-given event — `status` is therefore always the
    // fixed FHIR code for a completed administration, not derived
    // from any source field (there is no "was it given" flag to
    // derive it from; the record's mere existence means it was).
    status: 'completed',
    vaccineCode: buildCodeableConcept({ text: vaccination.vaccineName }),
    patient: buildReference({ resourceType: 'Patient', id: String(patientProfile._id) }),
    ...(vaccination.dateAdministered
      ? { occurrenceDateTime: new Date(vaccination.dateAdministered).toISOString() }
      : { occurrenceString: 'unknown' }), // FHIR requires one of occurrence[x]; date is genuinely unknown for some historical entries
    ...(typeof vaccination.doseNumber === 'number'
      ? { protocolApplied: [{ doseNumberPositiveInt: vaccination.doseNumber }] }
      : {}),
    ...(vaccination.administeredBy
      ? { performer: [{ actor: { display: vaccination.administeredBy } }] }
      : {}),
    ...(vaccination.notes ? { note: [{ text: vaccination.notes }] } : {}),
  }));
};
