import express from 'express';

import {
  listMyAuditLogsController,
  listAuditLogsAdminController,
  getAuditLogAdminController,
  listSensitiveRecordAccessController,
  listReportAccessController,
} from '../controllers/audit-log.controller.js';
import {
  myAuditLogQuerySchema,
  adminAuditLogQuerySchema,
  auditLogIdParamsSchema,
  sensitiveRecordAccessQuerySchema,
  fileAccessQuerySchema,
} from '../validators/audit-log.validation.js';
import { validateQuery, validateParams } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * FET-20 (minimal slice, pulled forward for FET-21's "Export
 * history") — mounted at `/api/v1/audit-logs`.
 *
 * Only one route: `GET /me`, self-scoped, `authenticate` only — no
 * `authorize(AUDIT_READ)` here, deliberately. `AUDIT_READ` is held
 * by DIRECTOR/ADMIN/SOFTWARE_OWNER/SUPER_ADMIN only (see
 * `security/permissions.js`), which would exclude DOCTOR/RECEPTIONIST
 * from ever seeing their *own* export/import history even though
 * both hold `DATA_EXPORT`/`DATA_IMPORT` and can trigger those
 * actions. Reading your own action log is a self-service concern
 * (matches `GET /notifications/me`'s boundary), not the admin-tier
 * "browse everyone's audit trail" feature `AUDIT_READ` is for — that
 * remains out of scope for this slice, left for the real FET-20 task
 * (`modules/audit-logs/README.md`).
 */
const router = express.Router();

// FET-20 prerequisite backend — the admin viewer this module's
// README described as reserved/unbuilt. `AUDIT_READ`-gated
// cross-user browsing — the "Audit data must respect backend
// permissions" requirement is enforced right here, at the route
// layer, same as `AUDIT_READ` gates every other admin read surface
// in this project (see `security/permissions.js`'s role grants:
// DIRECTOR/ADMIN/SOFTWARE_OWNER/SUPER_ADMIN only).
//
// Registered before `/me` is irrelevant for this literal `/` path,
// but `/:id` below is deliberately registered LAST — after both
// `/` and `/me` — so a request for `/audit-logs/me` is never
// swallowed by the `/:id` param route.
router.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.AUDIT_READ),
  validateQuery(adminAuditLogQuerySchema),
  listAuditLogsAdminController,
);

router.get('/me', authenticate, validateQuery(myAuditLogQuerySchema), listMyAuditLogsController);

// FET-20 — Audit Administration, checkpoint 2: "Sensitive-record
// access" and "File access". Both read from existing, already-
// complete purpose-built logs (`SensitiveRecordAccessLog`, BET-07;
// `ReportAccessLog`, BET-12.24) that had no admin-facing read route
// until now — no new writer for either. Registered here, before
// `/:id`, for the same reason `/me` above is: a literal path like
// `/sensitive-record-access` must never be swallowed by the `/:id`
// param route.
router.get(
  '/sensitive-record-access',
  authenticate,
  authorize(PERMISSIONS.AUDIT_READ),
  validateQuery(sensitiveRecordAccessQuerySchema),
  listSensitiveRecordAccessController,
);

router.get(
  '/file-access',
  authenticate,
  authorize(PERMISSIONS.AUDIT_READ),
  validateQuery(fileAccessQuerySchema),
  listReportAccessController,
);

router.get(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.AUDIT_READ),
  validateParams(auditLogIdParamsSchema),
  getAuditLogAdminController,
);

export default router;
