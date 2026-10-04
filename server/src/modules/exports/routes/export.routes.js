import express from 'express';

import {
  tabularExportController,
  requestMedicalRecordExportController,
  downloadControlledExportController,
} from '../controllers/export.controller.js';
import {
  tabularExportQuerySchema,
  tabularExportParamsSchema,
  medicalRecordExportParamsSchema,
  medicalRecordExportBodySchema,
  exportDownloadParamsSchema,
} from '../validators/export.validation.js';
import {
  validateQuery,
  validateParams,
  validateBody,
} from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize, authorizeAll } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-19 — Data Interoperability, mounted at `/api/v1/exports`.
 *
 * Checkpoint 1: bulk tabular export, `?format=CSV|XLSX|PDF|JSON`.
 * Checkpoint 2: single-patient "medical-record export" (request
 * step below) wrapped in "controlled export" (the separate download
 * step below) — see each route's own comment.
 *
 * Per-entity-type permission for the checkpoint-1 route is checked
 * inside the controller (see its docstring) rather than here, since
 * it depends on the `:entityType` route param — the controller also
 * checks `DATA_EXPORT` there for the same reason. This route's own
 * `authorizeAll` below is the equivalent two-permission ("may read
 * this specific patient's records" + "may use the bulk-export
 * feature at all") gate for the medical-record-package route, where
 * both permissions are fixed and known ahead of the handler.
 */

const router = express.Router();

// Declared before `/:entityType` so `patients`/`download` are never
// swallowed by that single-segment generic route — same ordering
// discipline `patient.routes.js` already uses for its own
// specific-before-generic routes.

router.post(
  '/patients/:patientProfileId/medical-record',
  authenticate,
  authorizeAll([PERMISSIONS.MEDICAL_RECORDS_READ, PERMISSIONS.DATA_EXPORT]),
  validateParams(medicalRecordExportParamsSchema),
  validateBody(medicalRecordExportBodySchema),
  requestMedicalRecordExportController,
);

// Deliberately unauthenticated — the single-use, time-limited token
// itself is the credential (see the controller's own docstring for
// why this mirrors the password-reset-link shape already used
// elsewhere in this project).
router.get(
  '/download/:token',
  validateParams(exportDownloadParamsSchema),
  downloadControlledExportController,
);

router.get(
  '/:entityType',
  authenticate,
  validateParams(tabularExportParamsSchema),
  validateQuery(tabularExportQuerySchema),
  tabularExportController,
);

export default router;
