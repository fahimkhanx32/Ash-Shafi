import express from 'express';

import {
  createPatientProfileController,
  getPatientProfileController,
  getPatientProfileByPatientIdController,
  getMyPatientProfileController,
  createMyPatientProfileController,
  updateMyPatientProfileController,
  listPatientProfilesController,
  updatePatientProfileController,
  addAllergyController,
  updateAllergyController,
  removeAllergyController,
  addChronicConditionController,
  updateChronicConditionController,
  removeChronicConditionController,
  addSurgeryHistoryController,
  updateSurgeryHistoryController,
  removeSurgeryHistoryController,
  addMedicationHistoryController,
  updateMedicationHistoryController,
  removeMedicationHistoryController,
  addFamilyHistoryController,
  updateFamilyHistoryController,
  removeFamilyHistoryController,
  updateSocialHistoryController,
  addVaccinationHistoryController,
  updateVaccinationHistoryController,
  removeVaccinationHistoryController,
  deactivatePatientProfileController,
  reactivatePatientProfileController,
} from '../controllers/patient.controller.js';

import * as patientValidation from '../validators/patient.validation.js';

import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middlewares/validation.middleware.js';

import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-06 — Patient & Medical History Routes.
 *
 * Follows the same pattern established in `modules/staff/routes` and
 * `modules/users/routes` (BET-04/BET-05): authenticate on the whole
 * router, then an explicit `authorize(permission)` per route — never
 * inferred from the frontend (master prompt section 80).
 *
 * `PATIENTS_READ`/`PATIENTS_WRITE` gate the patient profile itself
 * (demographics/administrative fields); the medical-history sub-
 * resource routes (allergies, conditions, surgeries, medications,
 * family/social history, vaccinations) are separately gated on
 * `MEDICAL_RECORDS_READ`/`MEDICAL_RECORDS_WRITE`, matching the
 * permission split already defined in `security/permissions.js`
 * (e.g. RECEPTIONIST has `PATIENTS_*` but not `MEDICAL_RECORDS_*`).
 * Because the history fields are embedded on the same document,
 * every response is additionally passed through
 * `modules/patients/utils/patient-access.util.js` in the controller
 * layer so that field-level separation actually holds at the API
 * boundary and not merely at the route-gating layer.
 *
 * This module never touches reproductive/sexual-health-specific data
 * — that is BET-07's `modules/gynecology/`, gated on the separate
 * `SENSITIVE_RECORDS_READ`/`WRITE` permissions (master prompt
 * section 16).
 */

const router = express.Router();

router.use(authenticate);

// A patient may always view their own profile without needing
// blanket `patients:read` — mirrors `GET /staff/me` (BET-05).
router.get('/me', getMyPatientProfileController);

// Self-service: a patient creates (if missing) and edits their own profile.
// Declared before `/:id`. Identity comes from the session, and the schemas
// are a strict allowlist (no status / primary care provider / notes / ID).
router.post(
  '/me',
  validateBody(patientValidation.createMyPatientProfileSchema),
  createMyPatientProfileController,
);
router.patch(
  '/me',
  validateBody(patientValidation.updateMyPatientProfileSchema),
  updateMyPatientProfileController,
);

router.get(
  '/',
  authorize(PERMISSIONS.PATIENTS_READ),
  validateQuery(patientValidation.listPatientsQuerySchema),
  listPatientProfilesController,
);

router.post(
  '/',
  authorize(PERMISSIONS.PATIENTS_WRITE),
  validateBody(patientValidation.createPatientProfileSchema),
  createPatientProfileController,
);

// Declared before `/:id` so it is not swallowed by the generic
// profile-by-id route below.
router.get(
  '/patient-id/:patientId',
  authorize(PERMISSIONS.PATIENTS_READ),
  getPatientProfileByPatientIdController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.PATIENTS_READ),
  validateParams(patientValidation.patientIdParamSchema),
  getPatientProfileController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.PATIENTS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.updatePatientProfileSchema),
  updatePatientProfileController,
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.PATIENTS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  deactivatePatientProfileController,
);

router.patch(
  '/:id/reactivate',
  authorize(PERMISSIONS.PATIENTS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  reactivatePatientProfileController,
);

// --- Allergies ---

router.post(
  '/:id/allergies',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.addAllergySchema),
  addAllergyController,
);

router.patch(
  '/:id/allergies/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  validateBody(patientValidation.updateAllergySchema),
  updateAllergyController,
);

router.delete(
  '/:id/allergies/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  removeAllergyController,
);

// --- Chronic conditions ---

router.post(
  '/:id/chronic-conditions',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.addChronicConditionSchema),
  addChronicConditionController,
);

router.patch(
  '/:id/chronic-conditions/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  validateBody(patientValidation.updateChronicConditionSchema),
  updateChronicConditionController,
);

router.delete(
  '/:id/chronic-conditions/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  removeChronicConditionController,
);

// --- Surgery history ---

router.post(
  '/:id/surgeries',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.addSurgeryHistorySchema),
  addSurgeryHistoryController,
);

router.patch(
  '/:id/surgeries/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  validateBody(patientValidation.updateSurgeryHistorySchema),
  updateSurgeryHistoryController,
);

router.delete(
  '/:id/surgeries/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  removeSurgeryHistoryController,
);

// --- Medication history ---

router.post(
  '/:id/medications',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.addMedicationHistorySchema),
  addMedicationHistoryController,
);

router.patch(
  '/:id/medications/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  validateBody(patientValidation.updateMedicationHistorySchema),
  updateMedicationHistoryController,
);

router.delete(
  '/:id/medications/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  removeMedicationHistoryController,
);

// --- Family history ---

router.post(
  '/:id/family-history',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.addFamilyHistorySchema),
  addFamilyHistoryController,
);

router.patch(
  '/:id/family-history/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  validateBody(patientValidation.updateFamilyHistorySchema),
  updateFamilyHistoryController,
);

router.delete(
  '/:id/family-history/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  removeFamilyHistoryController,
);

// --- Social history (single embedded object, not a list) ---

router.patch(
  '/:id/social-history',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.updateSocialHistorySchema),
  updateSocialHistoryController,
);

// --- Vaccination history ---

router.post(
  '/:id/vaccinations',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.patientIdParamSchema),
  validateBody(patientValidation.addVaccinationHistorySchema),
  addVaccinationHistoryController,
);

router.patch(
  '/:id/vaccinations/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  validateBody(patientValidation.updateVaccinationHistorySchema),
  updateVaccinationHistoryController,
);

router.delete(
  '/:id/vaccinations/:itemId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(patientValidation.medicalHistoryItemIdParamSchema),
  removeVaccinationHistoryController,
);

export default router;
