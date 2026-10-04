import express from 'express';

import {
  createGynecologyRecordController,
  getGynecologyRecordController,
  getGynecologyRecordByPatientController,
  getMyGynecologyRecordController,
  updateGynecologyRecordController,
  addGynecologicalConditionController,
  updateGynecologicalConditionController,
  removeGynecologicalConditionController,
  addContraceptionController,
  updateContraceptionController,
  removeContraceptionController,
  addStiHistoryController,
  updateStiHistoryController,
  removeStiHistoryController,
  addCervicalScreeningController,
  updateCervicalScreeningController,
  removeCervicalScreeningController,
  addBreastRecordController,
  updateBreastRecordController,
  removeBreastRecordController,
  addProcedureController,
  updateProcedureController,
  removeProcedureController,
} from '../controllers/gynecology.controller.js';

import * as gynecologyValidation from '../validators/gynecology.validation.js';

import {
  validateBody,
  validateParams,
} from '../../../middlewares/validation.middleware.js';

import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-07 — Gynecology & Sensitive Clinical Records routes.
 *
 * Every non-`/me` route is gated on `SENSITIVE_RECORDS_READ`/`WRITE`
 * (`security/permissions.js`, BET-04) at the route layer — granted
 * only to `SOFTWARE_OWNER`, `SUPER_ADMIN`, `DIRECTOR`, `DOCTOR`. A
 * `DOCTOR` passing that check is *not* automatically entitled to a
 * given patient's record — the service layer's
 * `enforceSensitiveRecordAccess` additionally requires them to be
 * that patient's assigned `primaryCareProvider` ("provider-based
 * access"), and logs every attempt (allowed or denied) to
 * `SensitiveRecordAccessLog` regardless of outcome. See
 * `modules/gynecology/services/sensitive-record-access.service.js`.
 *
 * `/me` is reachable by any authenticated user (a `PATIENT` has no
 * `SENSITIVE_RECORDS_READ` grant at all) because self-access is
 * resolved by identity, not by permission — same shape as
 * `GET /patients/me` (BET-06). Every other role hitting `/me` simply
 * gets a 404 (no such record for their own user id), not a 403.
 */

const router = express.Router();

router.use(authenticate);

router.get('/me', getMyGynecologyRecordController);

router.post(
  '/',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateBody(gynecologyValidation.createGynecologyRecordSchema),
  createGynecologyRecordController,
);

router.get(
  '/patient/:patientProfileId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_READ),
  validateParams(gynecologyValidation.patientProfileIdParamSchema),
  getGynecologyRecordByPatientController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_READ),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  getGynecologyRecordController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  validateBody(gynecologyValidation.updateGynecologyRecordSchema),
  updateGynecologyRecordController,
);

// --- Gynecological conditions ---

router.post(
  '/:id/conditions',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  validateBody(gynecologyValidation.addGynecologicalConditionSchema),
  addGynecologicalConditionController,
);

router.patch(
  '/:id/conditions/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  validateBody(gynecologyValidation.updateGynecologicalConditionSchema),
  updateGynecologicalConditionController,
);

router.delete(
  '/:id/conditions/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  removeGynecologicalConditionController,
);

// --- Contraception ---

router.post(
  '/:id/contraception',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  validateBody(gynecologyValidation.addContraceptionSchema),
  addContraceptionController,
);

router.patch(
  '/:id/contraception/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  validateBody(gynecologyValidation.updateContraceptionSchema),
  updateContraceptionController,
);

router.delete(
  '/:id/contraception/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  removeContraceptionController,
);

// --- STI / STD history ---

router.post(
  '/:id/sti-history',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  validateBody(gynecologyValidation.addStiHistorySchema),
  addStiHistoryController,
);

router.patch(
  '/:id/sti-history/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  validateBody(gynecologyValidation.updateStiHistorySchema),
  updateStiHistoryController,
);

router.delete(
  '/:id/sti-history/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  removeStiHistoryController,
);

// --- Cervical screenings ---

router.post(
  '/:id/cervical-screenings',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  validateBody(gynecologyValidation.addCervicalScreeningSchema),
  addCervicalScreeningController,
);

router.patch(
  '/:id/cervical-screenings/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  validateBody(gynecologyValidation.updateCervicalScreeningSchema),
  updateCervicalScreeningController,
);

router.delete(
  '/:id/cervical-screenings/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  removeCervicalScreeningController,
);

// --- Breast records ---

router.post(
  '/:id/breast-records',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  validateBody(gynecologyValidation.addBreastRecordSchema),
  addBreastRecordController,
);

router.patch(
  '/:id/breast-records/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  validateBody(gynecologyValidation.updateBreastRecordSchema),
  updateBreastRecordController,
);

router.delete(
  '/:id/breast-records/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  removeBreastRecordController,
);

// --- Gynecological procedures ---

router.post(
  '/:id/procedures',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.gynecologyRecordIdParamSchema),
  validateBody(gynecologyValidation.addProcedureSchema),
  addProcedureController,
);

router.patch(
  '/:id/procedures/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  validateBody(gynecologyValidation.updateProcedureSchema),
  updateProcedureController,
);

router.delete(
  '/:id/procedures/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(gynecologyValidation.itemIdParamSchema),
  removeProcedureController,
);

export default router;
