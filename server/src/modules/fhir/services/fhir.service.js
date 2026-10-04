/**
 * BET-19 — FHIR-ready architecture: the fetch-and-map layer.
 *
 * Deliberately does not query Mongoose models directly. Every fetch
 * here reuses the exact same service function the REST-native
 * `/api/v1/patients`/`/api/v1/staff` routes already call
 * (`getPatientProfileById`, `getStaffProfileById`) — a FHIR consumer
 * and this project's own frontend see the same access rules, the
 * same 404 behavior, and the same underlying data, just serialized
 * two different ways. This is the actual meaning of "FHIR-ready
 * architecture": FHIR is a presentation/interop layer bolted onto
 * the existing domain services, not a second parallel data-access
 * path that could drift from the first.
 */

import mongoose from 'mongoose';

import { getPatientProfileById } from '../../patients/services/patient.service.js';
import { getStaffProfileById } from '../../staff/services/staff.service.js';
import { getEncounterById } from '../../encounters/services/encounter.service.js';
import { getPrescriptionById } from '../../prescriptions/services/prescription.service.js';
import { getReportById } from '../../reports/services/report.service.js';
import { User } from '../../../users/user.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { mapPatientToFhir } from '../mappers/patient.mapper.js';
import { mapPractitionerToFhir } from '../mappers/practitioner.mapper.js';
import { mapEncounterToFhir } from '../mappers/encounter.mapper.js';
import { mapPrescriptionToFhir } from '../mappers/medication-request.mapper.js';
import { mapMedicalReportToFhir } from '../mappers/diagnostic-report.mapper.js';
import {
  mapAllergiesToFhir,
  mapChronicConditionsToFhir,
  mapVaccinationsToFhir,
} from '../mappers/clinical-record.mapper.js';
import { getSupportedResourceTypes } from '../mappers/mapper-registry.js';
import { FHIR_VERSION } from '../constants/fhir.constants.js';
import { buildBundle } from '../utils/fhir-builder.util.js';

const assertValidObjectId = (id, resourceType) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`"${id}" is not a valid ${resourceType} id.`, 400, {
      code: 'FHIR_INVALID_ID',
    });
  }
};

/** @param {string} id - `PatientProfile._id` */
export const getFhirPatientById = async (id) => {
  assertValidObjectId(id, 'Patient');

  const profile = await getPatientProfileById(id);
  // `getPatientProfileById` doesn't populate `name` (see its own
  // `includeUser` option, which only selects `email username
  // status`) — `User.name` is fetched separately here rather than
  // widening that shared function's populate just for this one
  // caller.
  const user = await User.findById(profile.user).select('name email');

  return mapPatientToFhir(profile, user);
};

/** @param {string} id - `StaffProfile._id` */
export const getFhirPractitionerById = async (id) => {
  assertValidObjectId(id, 'Practitioner');

  const profile = await getStaffProfileById(id); // already populates `user` with name/email
  return mapPractitionerToFhir(profile);
};

/** @param {string} id - `Encounter._id` */
export const getFhirEncounterById = async (id) => {
  assertValidObjectId(id, 'Encounter');

  const encounter = await getEncounterById(id);
  return mapEncounterToFhir(encounter);
};

/**
 * @param {string} id - `Prescription._id`
 * @param {object} actor - the authenticated caller, reused by
 *   `getPrescriptionById`'s own ownership check (a `PATIENT` actor
 *   can only fetch their own prescription's FHIR representation —
 *   same 404-on-mismatch rule the native `/prescriptions/:id` route
 *   already enforces, not a wider FHIR-side exception to it).
 * @returns {object} a FHIR `Bundle` of `MedicationRequest` resources
 *   — never a bare array, since a bare JSON array isn't itself a
 *   valid FHIR resource a client could request/parse as one.
 */
export const getFhirMedicationRequestsByPrescriptionId = async (id, actor) => {
  assertValidObjectId(id, 'MedicationRequest');

  const prescription = await getPrescriptionById(id, actor);
  const resources = mapPrescriptionToFhir(prescription);

  return buildBundle({ type: 'collection', resources, total: resources.length });
};

/**
 * @param {string} id - `MedicalReport._id`
 * @param {object} actor - reused by `getReportById`'s own
 *   authorization/ownership + sensitive-report filtering, same
 *   reasoning as `getFhirMedicationRequestsByPrescriptionId` above.
 * @returns {object} a FHIR `Bundle` containing the `DiagnosticReport`
 *   followed by every referenced `Observation` — a client fetching
 *   one FHIR resource for a report gets a self-contained bundle
 *   rather than needing N additional requests to resolve each
 *   `result` reference.
 */
export const getFhirDiagnosticReportById = async (id, actor) => {
  assertValidObjectId(id, 'DiagnosticReport');

  const report = await getReportById(id, actor);
  const { diagnosticReport, observations } = mapMedicalReportToFhir(report);
  const resources = [diagnosticReport, ...observations];

  return buildBundle({ type: 'collection', resources, total: resources.length });
};

/**
 * @param {string} id - `PatientProfile._id`
 * @returns {object} a FHIR `Bundle` of every `AllergyIntolerance` +
 *   `Condition` + `Immunization` resource derived from that
 *   patient's general medical history (BET-06) — bundled together
 *   since a caller asking for "this patient's clinical record" wants
 *   all three, not one resource type fetched three separate times.
 */
export const getFhirClinicalRecordBundleByPatientId = async (id) => {
  assertValidObjectId(id, 'Patient');

  const profile = await getPatientProfileById(id);
  const resources = [
    ...mapAllergiesToFhir(profile),
    ...mapChronicConditionsToFhir(profile),
    ...mapVaccinationsToFhir(profile),
  ];

  return buildBundle({ type: 'collection', resources, total: resources.length });
};

/**
 * FHIR's standard `CapabilityStatement` resource — what a FHIR
 * client is supposed to fetch first (conventionally `GET
 * /fhir/metadata`) to discover what a server actually supports,
 * rather than guessing or assuming full R4 coverage. Kept in sync
 * with `mapper-registry.js`'s registered resource types rather than
 * hand-maintained separately, so it can never silently drift out of
 * date as later BET-19 checkpoints add Encounter/MedicationRequest/
 * DiagnosticReport/Condition mappers.
 */
export const getCapabilityStatement = () => ({
  resourceType: 'CapabilityStatement',
  status: 'active',
  date: new Date().toISOString(),
  kind: 'instance',
  software: { name: 'Ash-Shāfī', version: '1.0.0' },
  fhirVersion: FHIR_VERSION,
  format: ['json'],
  rest: [
    {
      mode: 'server',
      resource: getSupportedResourceTypes().map((resourceType) => ({
        type: resourceType,
        interaction: [{ code: 'read' }],
      })),
    },
  ],
});
