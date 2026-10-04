import express from 'express';

import { importPatientsController } from '../controllers/import.controller.js';
import { authenticate, authorizeAll } from '../../../middlewares/auth.middleware.js';
import { uploadSingle } from '../../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-19 — Data Interoperability: bulk import, mounted at
 * `/api/v1/imports`.
 *
 * Checkpoint 1 requires the same `PATIENTS_WRITE` permission the
 * native `POST /api/v1/patients` endpoint already requires — bulk
 * import creates nothing a caller couldn't already create one row
 * at a time through that endpoint. "Export authorization" adds a
 * second, dedicated `DATA_IMPORT` permission on top of that as an
 * additional, narrower gate (`security/permissions.js`) — a role can
 * hold `patients:write` (ordinary one-record-at-a-time registration)
 * without also holding `data:import`, since bulk-creating many
 * accounts from an uploaded file deserves a stricter bar than
 * single-record creation does. Both are required.
 */

const router = express.Router();

router.post(
  '/patients',
  authenticate,
  authorizeAll([PERMISSIONS.PATIENTS_WRITE, PERMISSIONS.DATA_IMPORT]),
  uploadSingle('file'),
  importPatientsController,
);

export default router;
