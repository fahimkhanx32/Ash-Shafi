import {
  getFhirPatientById,
  getFhirPractitionerById,
  getFhirEncounterById,
  getFhirMedicationRequestsByPrescriptionId,
  getFhirDiagnosticReportById,
  getFhirClinicalRecordBundleByPatientId,
  getCapabilityStatement,
} from '../services/fhir.service.js';
import { buildOperationOutcome } from '../utils/fhir-builder.util.js';
import { recordClinicalAccess } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

/**
 * BET-19 — Every FHIR endpoint responds with either the FHIR
 * resource itself or a FHIR `OperationOutcome` on error —
 * deliberately never this project's normal `{ success, message,
 * data }` envelope (`utils/apiResponse.js`), even for the same
 * underlying "not found"/"invalid id" errors `AppError` already
 * represents elsewhere. A FHIR-consuming client only knows how to
 * parse FHIR shapes; wrapping an `OperationOutcome` inside another
 * envelope would defeat the point of exposing a FHIR surface at all.
 * This is why every handler below catches its own errors instead of
 * calling `next(error)` into the application's shared error
 * middleware.
 */

const FHIR_CONTENT_TYPE = 'application/fhir+json; charset=utf-8';

const sendFhirResource = (res, resource, statusCode = 200) => {
  res.status(statusCode).type(FHIR_CONTENT_TYPE).json(resource);
};

const sendOperationOutcome = (res, error) => {
  const statusCode = error?.statusCode || 500;
  const severity = statusCode >= 500 ? 'fatal' : 'error';
  const code = statusCode === 404 ? 'not-found' : statusCode === 400 ? 'invalid' : 'exception';

  res
    .status(statusCode)
    .type(FHIR_CONTENT_TYPE)
    .json(
      buildOperationOutcome({
        severity,
        code,
        diagnostics: error?.message || 'An unexpected error occurred while processing the FHIR request.',
      }),
    );
};

export const capabilityStatementController = (req, res) => {
  sendFhirResource(res, getCapabilityStatement());
};

export const getFhirPatientController = async (req, res) => {
  try {
    const patient = await getFhirPatientById(req.params.id);

    // Same clinical-access audit event `patient.controller.js`
    // already records for `GET /patients/:id` — this endpoint
    // returns the same underlying clinical data, just as a FHIR
    // resource instead of this project's normal API envelope, so it
    // gets the same audit coverage rather than a silent, unlogged
    // second read path into patient records.
    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.PATIENT_RECORD_VIEW,
      resourceType: 'PatientProfile',
      resourceId: req.params.id,
      patientId: req.params.id,
      metadata: { via: 'FHIR' },
    });

    sendFhirResource(res, patient);
  } catch (error) {
    sendOperationOutcome(res, error);
  }
};

export const getFhirPractitionerController = async (req, res) => {
  try {
    const practitioner = await getFhirPractitionerById(req.params.id);
    sendFhirResource(res, practitioner);
  } catch (error) {
    sendOperationOutcome(res, error);
  }
};

export const getFhirEncounterController = async (req, res) => {
  try {
    const encounter = await getFhirEncounterById(req.params.id);

    // Same audit event the native `GET /encounters/:id` route already
    // records — see `getFhirPatientController`'s comment above for
    // why a FHIR read of clinical data gets the same coverage as the
    // REST-native read, not a silent second path.
    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.ENCOUNTER_VIEW,
      resourceType: 'Encounter',
      resourceId: req.params.id,
      metadata: { via: 'FHIR' },
    });

    sendFhirResource(res, encounter);
  } catch (error) {
    sendOperationOutcome(res, error);
  }
};

export const getFhirMedicationRequestController = async (req, res) => {
  try {
    const bundle = await getFhirMedicationRequestsByPrescriptionId(req.params.id, req.user);

    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_VIEW,
      resourceType: 'Prescription',
      resourceId: req.params.id,
      metadata: { via: 'FHIR' },
    });

    sendFhirResource(res, bundle);
  } catch (error) {
    sendOperationOutcome(res, error);
  }
};

export const getFhirDiagnosticReportController = async (req, res) => {
  try {
    // Deliberately no extra `recordClinicalAccess` call here — unlike
    // Patient/Encounter/MedicationRequest above, `getReportById`
    // (called inside the service function) already routes through
    // BET-12's own `enforceReportAccess`/`logReportAccess`, which
    // logs this exact read to `report_access_logs` regardless of
    // caller. Adding a second, differently-shaped audit entry here
    // would duplicate that coverage rather than add to it — the same
    // "already owned elsewhere, don't duplicate" decision BET-17's
    // own checkpoint notes made for reports/gynecology.
    const bundle = await getFhirDiagnosticReportById(req.params.id, req.user);
    sendFhirResource(res, bundle);
  } catch (error) {
    sendOperationOutcome(res, error);
  }
};

export const getFhirClinicalRecordController = async (req, res) => {
  try {
    const bundle = await getFhirClinicalRecordBundleByPatientId(req.params.id);

    // Same clinical-access audit event the native
    // `GET /patients/:id` route already records for general
    // medical-history reads (BET-06/BET-17) — this endpoint exposes
    // the same allergy/condition/vaccination data, just as FHIR
    // resources.
    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.PATIENT_RECORD_VIEW,
      resourceType: 'PatientProfile',
      resourceId: req.params.id,
      patientId: req.params.id,
      metadata: { via: 'FHIR', scope: 'clinical-record' },
    });

    sendFhirResource(res, bundle);
  } catch (error) {
    sendOperationOutcome(res, error);
  }
};
