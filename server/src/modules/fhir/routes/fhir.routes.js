import express from 'express';

import {
  capabilityStatementController,
  getFhirPatientController,
  getFhirPractitionerController,
  getFhirEncounterController,
  getFhirMedicationRequestController,
  getFhirDiagnosticReportController,
  getFhirClinicalRecordController,
} from '../controllers/fhir.controller.js';

import { fhirIdParamsSchema } from '../validators/fhir.validation.js';
import { validateParams } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-19 — FHIR-ready architecture, mounted at `/api/v1/fhir`.
 *
 * `GET /metadata` (the `CapabilityStatement`) is deliberately the
 * one unauthenticated route here — FHIR's own convention is that a
 * server's capability statement is public discovery metadata (what
 * resource types/interactions exist), not PHI, so a FHIR client can
 * probe it before authenticating. Every resource-read route requires
 * the exact same permission this project's own native REST routes
 * for the same underlying data already require
 * (`patients.routes.js`'s `PATIENTS_READ`, `staff.routes.js`'s
 * `DOCTORS_READ`) — a FHIR consumer gets no wider access than this
 * project's own frontend has.
 */

const router = express.Router();

router.get('/metadata', capabilityStatementController);

router.get(
  '/Patient/:id',
  authenticate,
  authorize(PERMISSIONS.PATIENTS_READ),
  validateParams(fhirIdParamsSchema),
  getFhirPatientController,
);

router.get(
  '/Practitioner/:id',
  authenticate,
  authorize(PERMISSIONS.DOCTORS_READ),
  validateParams(fhirIdParamsSchema),
  getFhirPractitionerController,
);

// Same permission the native `/api/v1/encounters/:id` route already
// requires (`MEDICAL_RECORDS_READ`) — see `encounter.routes.js`.
router.get(
  '/Encounter/:id',
  authenticate,
  authorize(PERMISSIONS.MEDICAL_RECORDS_READ),
  validateParams(fhirIdParamsSchema),
  getFhirEncounterController,
);

// Same permission the native `/api/v1/prescriptions/:id` route
// already requires (`PRESCRIPTIONS_READ`) — see
// `prescription.routes.js`. A `PATIENT` caller may hold this
// permission for their own records too; ownership is still enforced
// inside `getPrescriptionById` regardless of the route-level check.
router.get(
  '/MedicationRequest/:id',
  authenticate,
  authorize(PERMISSIONS.PRESCRIPTIONS_READ),
  validateParams(fhirIdParamsSchema),
  getFhirMedicationRequestController,
);

// Same permission the native `/api/v1/reports/:id` route requires
// (`INVESTIGATIONS_READ`/report read is gated inside `report.routes.js`
// on `REPORTS_READ` — see that file) — reused, not widened, for the
// FHIR surface. Sensitive-report and ownership rules are still
// enforced inside `getReportById` itself regardless of this
// route-level check.
router.get(
  '/DiagnosticReport/:id',
  authenticate,
  authorize(PERMISSIONS.REPORTS_READ),
  validateParams(fhirIdParamsSchema),
  getFhirDiagnosticReportController,
);

// Same permission the native `/api/v1/patients/:id` route requires
// for general medical-history fields — see
// `modules/patients/utils/patient-access.util.js`'s own note on why
// `MEDICAL_RECORDS_READ` is distinct from `PATIENTS_READ`.
router.get(
  '/Patient/:id/clinical-record',
  authenticate,
  authorize(PERMISSIONS.MEDICAL_RECORDS_READ),
  validateParams(fhirIdParamsSchema),
  getFhirClinicalRecordController,
);

export default router;
