import { listPatientProfiles, getPatientProfileById } from '../../patients/services/patient.service.js';
import { canViewMedicalHistory, redactMedicalHistory } from '../../patients/utils/patient-access.util.js';

/**
 * `search_patient` — master prompt §11.
 *
 * Backed by the same `listPatientProfiles` the `GET /patients` UI
 * list uses (BET-06); no separate voice-only query is built. Returns
 * only the minimum fields a doctor needs to pick the right patient by
 * voice ("Rahim Ahmed, age 34, phone ...01712...") — never the
 * embedded medical-history fields, which `listPatientProfiles`
 * doesn't select in the first place.
 */
export const searchPatient = async ({ query, limit = 5 }, actor) => {
  const { profiles } = await listPatientProfiles({ search: query, limit, page: 1 });

  if (profiles.length === 0) {
    return {
      success: true,
      action: 'search_patient',
      message: `I couldn't find a patient matching "${query}".`,
      results: [],
    };
  }

  const results = profiles.map((p) => ({
    patientProfileId: String(p._id),
    name: `${p.firstName} ${p.lastName}`.trim(),
    patientId: p.patientId,
    phone: p.phone || '',
    gender: p.gender || '',
  }));

  return {
    success: true,
    action: 'search_patient',
    message:
      results.length === 1
        ? `Found ${results[0].name}.`
        : `Found ${results.length} matching patients — which one did you mean?`,
    requiresConfirmation: results.length > 1,
    results,
  };
};

/**
 * `get_patient_summary` — master prompt §11.
 *
 * Deliberately routed through `redactMedicalHistory` exactly like the
 * existing `GET /patients/:id` controller does, so a voice caller who
 * shouldn't see medical-history fields (per `MEDICAL_RECORDS_READ`)
 * doesn't see them here either just because this is a different
 * entry point into the same data (master prompt §7: "prefer IDs and
 * minimal required context").
 */
export const getPatientSummary = async ({ patientProfileId }, actor) => {
  const profile = await getPatientProfileById(patientProfileId);
  const safe = redactMedicalHistory(profile, actor);

  return {
    success: true,
    action: 'get_patient_summary',
    message: `${safe.fullName}, ${safe.age ?? 'unknown age'}, ${safe.gender || 'gender not recorded'}.`,
    patient: {
      patientProfileId: String(profile._id),
      name: safe.fullName,
      patientId: safe.patientId,
      age: safe.age ?? null,
      gender: safe.gender || '',
      bloodGroup: safe.bloodGroup || '',
      phone: safe.phone || '',
      medicalHistoryIncluded: canViewMedicalHistory(actor, profile),
    },
  };
};
