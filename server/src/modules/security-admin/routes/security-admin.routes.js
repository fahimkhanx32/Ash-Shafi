import express from 'express';

import {
  getSecurityDashboardController,
  listSessionsAdminController,
  revokeSessionAdminController,
  getAccountSecurityAdminController,
  unlockAccountAdminController,
  listSecurityEventsAdminController,
  listSecurityAlertsController,
} from '../controllers/security-admin.controller.js';

import {
  listSessionsAdminQuerySchema,
  sessionIdParamsSchema,
  revokeSessionAdminBodySchema,
  userIdParamsSchema,
  unlockAccountBodySchema,
  securityEventsAdminQuerySchema,
} from '../validators/security-admin.validation.js';

import { validateQuery, validateParams, validateBody } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * FET-20 prerequisite backend — Security Administration.
 *
 * Mounted at `/api/v1/security-admin`. Read endpoints (dashboard,
 * sessions list, account security profile, events, alerts) require
 * `AUDIT_READ` — today held by DIRECTOR/ADMIN/SOFTWARE_OWNER/
 * SUPER_ADMIN (`security/permissions.js`), the same tier that can
 * already browse the general audit-log viewer
 * (`modules/audit-logs`). The two mutating endpoints — revoking
 * *another* user's session, unlocking *another* user's account —
 * require the stricter `SYSTEM_ADMIN` (today: SOFTWARE_OWNER/
 * SUPER_ADMIN only), matching the owner-tier bar
 * `modules/backups` already uses for its own irreversible/high-
 * impact operations. This mirrors the read/write split this project
 * uses throughout (e.g. `SENSITIVE_RECORDS_READ`/`WRITE`).
 *
 * Every route here is about *other* users' security state — a
 * caller's own sessions/security remain `/auth/sessions` and
 * `/auth/change-password` (self-service, no special permission
 * needed beyond `authenticate`), unchanged by this module.
 */

const router = express.Router();

router.use(authenticate);

router.get(
  '/dashboard',
  authorize(PERMISSIONS.AUDIT_READ),
  getSecurityDashboardController,
);

router.get(
  '/sessions',
  authorize(PERMISSIONS.AUDIT_READ),
  validateQuery(listSessionsAdminQuerySchema),
  listSessionsAdminController,
);

router.delete(
  '/sessions/:sessionId',
  authorize(PERMISSIONS.SYSTEM_ADMIN),
  validateParams(sessionIdParamsSchema),
  validateBody(revokeSessionAdminBodySchema),
  revokeSessionAdminController,
);

router.get(
  '/accounts/:userId/security',
  authorize(PERMISSIONS.AUDIT_READ),
  validateParams(userIdParamsSchema),
  getAccountSecurityAdminController,
);

router.post(
  '/accounts/:userId/unlock',
  authorize(PERMISSIONS.SYSTEM_ADMIN),
  validateParams(userIdParamsSchema),
  validateBody(unlockAccountBodySchema),
  unlockAccountAdminController,
);

router.get(
  '/events',
  authorize(PERMISSIONS.AUDIT_READ),
  validateQuery(securityEventsAdminQuerySchema),
  listSecurityEventsAdminController,
);

router.get(
  '/alerts',
  authorize(PERMISSIONS.AUDIT_READ),
  listSecurityAlertsController,
);

export default router;
