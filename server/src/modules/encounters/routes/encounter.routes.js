import express from 'express';

import {
  createEncounterController,
  getEncounterController,
  listEncountersByPatientController,
  getMyEncountersController,
  updateEncounterController,
  finalizeEncounterController,
  amendEncounterController,
} from '../controllers/encounter.controller.js';
import * as encounterValidation from '../validators/encounter.validation.js';
import { validateBody, validateParams } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-09 — Consultation & Clinical Encounters routes.
 * `MEDICAL_RECORDS_READ`/`WRITE` gating, matching BET-06's precedent
 * (see `encounter.service.js`'s header comment on why this differs
 * from BET-07/08's `SENSITIVE_RECORDS_*` pattern). `/me` is open to
 * any authenticated user for self-access, same convention as
 * gynecology/obstetrics.
 */
const router = express.Router();

router.use(authenticate);

router.get('/me', getMyEncountersController);

router.post(
  '/',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateBody(encounterValidation.createEncounterSchema),
  createEncounterController,
);

router.get(
  '/patient/:patientProfileId',
  authorize(PERMISSIONS.MEDICAL_RECORDS_READ),
  validateParams(encounterValidation.patientProfileIdParamSchema),
  listEncountersByPatientController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.MEDICAL_RECORDS_READ),
  validateParams(encounterValidation.encounterIdParamSchema),
  getEncounterController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(encounterValidation.encounterIdParamSchema),
  validateBody(encounterValidation.updateEncounterSchema),
  updateEncounterController,
);

router.post(
  '/:id/finalize',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(encounterValidation.encounterIdParamSchema),
  finalizeEncounterController,
);

router.post(
  '/:id/amend',
  authorize(PERMISSIONS.MEDICAL_RECORDS_WRITE),
  validateParams(encounterValidation.encounterIdParamSchema),
  validateBody(encounterValidation.amendEncounterSchema),
  amendEncounterController,
);

export default router;
