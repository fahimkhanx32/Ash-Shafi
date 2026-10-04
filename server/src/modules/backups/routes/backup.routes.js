import express from 'express';

import {
  triggerBackupController,
  listBackupsController,
  getBackupController,
  purgeExpiredBackupsController,
  runRestoreTestController,
  restoreToProductionController,
} from '../controllers/backup.controller.js';

import {
  listBackupsQuerySchema,
  backupIdParamsSchema,
  triggerBackupSchema,
  restoreBodySchema,
} from '../validators/backup.validation.js';

import { validateQuery, validateParams, validateBody } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-18 — Backup, Recovery & Data Protection.
 *
 * Every route here is gated on `SYSTEM_ADMIN` (today: SOFTWARE_OWNER
 * and SUPER_ADMIN only) — the same owner-tier bar
 * `modules/data-lifecycle` uses throughout, not the broader
 * `AUDIT_READ`/`WEBSITE_MANAGE`-style permissions used elsewhere.
 * A full database dump and the ability to overwrite production data
 * with one are both squarely "the most privileged thing this
 * application can do", so there is no lower-tier read-only role for
 * this module the way `data-lifecycle`'s `/policy` route has one.
 */

const router = express.Router();

router.use(authenticate, authorize(PERMISSIONS.SYSTEM_ADMIN));

router.get('/', validateQuery(listBackupsQuerySchema), listBackupsController);

router.post('/', validateBody(triggerBackupSchema), triggerBackupController);

router.post('/retention/purge', purgeExpiredBackupsController);

router.get('/:id', validateParams(backupIdParamsSchema), getBackupController);

router.post('/:id/restore-test', validateParams(backupIdParamsSchema), runRestoreTestController);

router.post(
  '/:id/restore',
  validateParams(backupIdParamsSchema),
  validateBody(restoreBodySchema),
  restoreToProductionController,
);

export default router;
