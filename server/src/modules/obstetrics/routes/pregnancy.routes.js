import express from 'express';

import {
  createPregnancyRecordController,
  getPregnancyRecordController,
  listPregnancyRecordsByPatientController,
  getMyPregnancyRecordsController,
  updatePregnancyRecordController,
  updateDeliveryController,
  updatePostpartumController,
  addAntenatalVisitController,
  updateAntenatalVisitController,
  removeAntenatalVisitController,
  addFetalObservationController,
  updateFetalObservationController,
  removeFetalObservationController,
  addComplicationController,
  updateComplicationController,
  removeComplicationController,
} from '../controllers/pregnancy.controller.js';

import * as pregnancyValidation from '../validators/pregnancy.validation.js';
import { validateBody, validateParams } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-08 — Obstetric & Pregnancy Records routes.
 * Same access model as BET-07 (`modules/gynecology/routes/gynecology.routes.js`):
 * `SENSITIVE_RECORDS_READ`/`WRITE` at the route layer, provider-based
 * access + mandatory audit logging in the service layer, `/me` open to
 * any authenticated user for self-access.
 */

const router = express.Router();

router.use(authenticate);

router.get('/me', getMyPregnancyRecordsController);

router.post(
  '/',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateBody(pregnancyValidation.createPregnancyRecordSchema),
  createPregnancyRecordController,
);

router.get(
  '/patient/:patientProfileId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_READ),
  validateParams(pregnancyValidation.patientProfileIdParamSchema),
  listPregnancyRecordsByPatientController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_READ),
  validateParams(pregnancyValidation.pregnancyRecordIdParamSchema),
  getPregnancyRecordController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.pregnancyRecordIdParamSchema),
  validateBody(pregnancyValidation.updatePregnancyRecordSchema),
  updatePregnancyRecordController,
);

router.patch(
  '/:id/delivery',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.pregnancyRecordIdParamSchema),
  validateBody(pregnancyValidation.updateDeliverySchema),
  updateDeliveryController,
);

router.patch(
  '/:id/postpartum',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.pregnancyRecordIdParamSchema),
  validateBody(pregnancyValidation.updatePostpartumSchema),
  updatePostpartumController,
);

// --- Antenatal visits ---
router.post(
  '/:id/antenatal-visits',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.pregnancyRecordIdParamSchema),
  validateBody(pregnancyValidation.addAntenatalVisitSchema),
  addAntenatalVisitController,
);
router.patch(
  '/:id/antenatal-visits/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.itemIdParamSchema),
  validateBody(pregnancyValidation.updateAntenatalVisitSchema),
  updateAntenatalVisitController,
);
router.delete(
  '/:id/antenatal-visits/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.itemIdParamSchema),
  removeAntenatalVisitController,
);

// --- Fetal observations ---
router.post(
  '/:id/fetal-observations',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.pregnancyRecordIdParamSchema),
  validateBody(pregnancyValidation.addFetalObservationSchema),
  addFetalObservationController,
);
router.patch(
  '/:id/fetal-observations/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.itemIdParamSchema),
  validateBody(pregnancyValidation.updateFetalObservationSchema),
  updateFetalObservationController,
);
router.delete(
  '/:id/fetal-observations/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.itemIdParamSchema),
  removeFetalObservationController,
);

// --- Complications ---
router.post(
  '/:id/complications',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.pregnancyRecordIdParamSchema),
  validateBody(pregnancyValidation.addComplicationSchema),
  addComplicationController,
);
router.patch(
  '/:id/complications/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.itemIdParamSchema),
  validateBody(pregnancyValidation.updateComplicationSchema),
  updateComplicationController,
);
router.delete(
  '/:id/complications/:itemId',
  authorize(PERMISSIONS.SENSITIVE_RECORDS_WRITE),
  validateParams(pregnancyValidation.itemIdParamSchema),
  removeComplicationController,
);

export default router;
