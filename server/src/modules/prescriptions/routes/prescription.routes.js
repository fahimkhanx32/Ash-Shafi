import express from 'express';

import {
  createPrescriptionController,
  getPrescriptionController,
  listPrescriptionsController,
  listPrescriptionsByPatientController,
  getMyPrescriptionsController,
  getPrescriptionHistoryController,
  updatePrescriptionController,
  finalizePrescriptionController,
  revisePrescriptionController,
  copyPrescriptionController,
  cancelPrescriptionController,
  archivePrescriptionController,
  deletePrescriptionController,
  verifyPrescriptionTokenController,
  getFavoriteMedicinesController,
  saveFavoriteMedicineController,
  getPrescriptionPdfController,
} from '../controllers/prescription.controller.js';
import * as prescriptionValidation from '../validators/prescription.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

/**
 * Public/Permissive verification endpoint for QR code scans.
 * If user has an auth token, it will be populated; if not, basic verification status is returned.
 */
router.get(
  '/verify/:token',
  validateParams(prescriptionValidation.verificationTokenParamSchema),
  verifyPrescriptionTokenController,
);

const authorizeReadOrSelf = (req, res, next) => {
  if (req.user.role === 'PATIENT') {
    return next();
  }
  return authorize(PERMISSIONS.PRESCRIPTIONS_READ)(req, res, next);
};

router.use(authenticate);

router.get('/me', getMyPrescriptionsController);

router.get(
  '/favorites/medicines',
  authorize(PERMISSIONS.PRESCRIPTIONS_READ),
  getFavoriteMedicinesController,
);

router.post(
  '/favorites/medicines',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateBody(prescriptionValidation.favoriteMedicineSchema),
  saveFavoriteMedicineController,
);

router.get(
  '/',
  authorize(PERMISSIONS.PRESCRIPTIONS_READ),
  validateQuery(prescriptionValidation.listPrescriptionsQuerySchema),
  listPrescriptionsController,
);

router.post(
  '/',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateBody(prescriptionValidation.createPrescriptionSchema),
  createPrescriptionController,
);

router.get(
  '/patient/:patientProfileId',
  authorize(PERMISSIONS.PRESCRIPTIONS_READ),
  validateParams(prescriptionValidation.patientProfileIdParamSchema),
  listPrescriptionsByPatientController,
);

router.get(
  '/:id',
  authorizeReadOrSelf,
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  getPrescriptionController,
);

router.get(
  '/:id/history',
  authorizeReadOrSelf,
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  getPrescriptionHistoryController,
);

router.get(
  '/:id/pdf',
  authorizeReadOrSelf,
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  getPrescriptionPdfController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  validateBody(prescriptionValidation.updatePrescriptionSchema),
  updatePrescriptionController,
);

router.post(
  '/:id/finalize',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  finalizePrescriptionController,
);

router.post(
  '/:id/revise',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  validateBody(prescriptionValidation.revisePrescriptionSchema),
  revisePrescriptionController,
);

router.post(
  '/:id/copy',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  copyPrescriptionController,
);

router.post(
  '/:id/cancel',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  validateBody(prescriptionValidation.cancelPrescriptionSchema),
  cancelPrescriptionController,
);

router.post(
  '/:id/archive',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  validateBody(prescriptionValidation.archivePrescriptionSchema),
  archivePrescriptionController,
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(prescriptionValidation.prescriptionIdParamSchema),
  deletePrescriptionController,
);

export default router;
