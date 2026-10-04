import express from 'express';

import {
  getRetentionPolicyController,
  previewExpiredDataController,
  purgeExpiredDataController,
} from '../controllers/data-lifecycle.controller.js';

import {
  previewQuerySchema,
  purgeBodySchema,
} from '../validators/data-lifecycle.validation.js';

import {
  validateQuery,
  validateBody,
} from '../../../middlewares/validation.middleware.js';

import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

router.use(authenticate);

// Reading the policy catalog is informational only (no counts, no
// deletion) — same bar as reading the audit log itself, `audit:read`
// (SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR, ADMIN).
router.get(
  '/policy',
  authorize(PERMISSIONS.AUDIT_READ),
  getRetentionPolicyController,
);

// Preview and purge are both gated on `system:admin`, which today
// only SOFTWARE_OWNER and SUPER_ADMIN hold (see
// `security/permissions.js`) — a preview directly informs a
// destructive operation, so it gets the same owner-tier bar as the
// purge itself, not the broader `audit:read` bar above.
router.get(
  '/preview',
  authorize(PERMISSIONS.SYSTEM_ADMIN),
  validateQuery(previewQuerySchema),
  previewExpiredDataController,
);

router.post(
  '/purge',
  authorize(PERMISSIONS.SYSTEM_ADMIN),
  validateBody(purgeBodySchema),
  purgeExpiredDataController,
);

export default router;
