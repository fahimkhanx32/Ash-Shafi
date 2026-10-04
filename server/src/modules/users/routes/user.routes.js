import express from 'express';

import {
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  changeUserRoleController,
  setUserStatusController,
  resetUserPasswordController,
  deleteUserController,
  restoreUserController,
} from '../controllers/user.controller.js';

import {
  listAccountDeletionRequestsController,
  getAccountDeletionRequestController,
  processAccountDeletionRequestController,
} from '../controllers/account-deletion.controller.js';

import {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  setUserStatusSchema,
  userIdParamsSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  deleteUserQuerySchema,
} from '../validators/user.validation.js';

import {
  processAccountDeletionSchema,
  deletionRequestIdParamsSchema,
  listDeletionRequestsQuerySchema,
} from '../validators/account-deletion.validation.js';

import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middlewares/validation.middleware.js';

import {
  authenticate,
  authorize,
  blockProtectedRoleTarget,
} from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

/**
 * USER ACCOUNT MANAGEMENT ROUTES
 * ================================
 * All routes in this file are gated on `USER_ACCOUNTS_ADMIN`
 * (master prompt sections 1, 7, 8). Only SOFTWARE_OWNER and
 * SUPER_ADMIN hold this permission — DIRECTOR and ADMIN do NOT,
 * even though they retain `USERS_READ`/`USERS_WRITE` for staff
 * management elsewhere.
 *
 * Enforcement happens at TWO layers:
 *   1. Permission layer (server-side): every route here uses
 *      `authorize(PERMISSIONS.USER_ACCOUNTS_ADMIN)`.
 *   2. UI layer: the frontend ProtectedRoute and navConfig both
 *      use `USER_ACCOUNTS_ADMIN_ROLES` ([SOFTWARE_OWNER, SUPER_ADMIN]).
 *
 * Hiding the nav item is NOT security — the backend enforces this
 * regardless of what the frontend renders.
 */
router.use(authenticate);
router.use(authorize(PERMISSIONS.USER_ACCOUNTS_ADMIN));

router.get(
  '/',
  validateQuery(listUsersQuerySchema),
  listUsersController,
);

// BET-17 checkpoint 3 — account deletion request review (master
// prompt §38). Declared before the generic `/:id` route below so
// `/deletion-requests` and `/deletion-requests/:id` are never
// swallowed by `/:id` matching "deletion-requests" as an id.
router.get(
  '/deletion-requests',
  validateQuery(listDeletionRequestsQuerySchema),
  listAccountDeletionRequestsController,
);

router.get(
  '/deletion-requests/:id',
  validateParams(deletionRequestIdParamsSchema),
  getAccountDeletionRequestController,
);

router.post(
  '/deletion-requests/:id/process',
  validateParams(deletionRequestIdParamsSchema),
  validateBody(processAccountDeletionSchema),
  processAccountDeletionRequestController,
);

router.get(
  '/:id',
  validateParams(userIdParamsSchema),
  getUserController,
);

// `blockProtectedRoleTarget` rejects `SOFTWARE_OWNER` as a target
// role outright (BET-04) before the request ever reaches the
// service layer — creating or promoting an account to that level is
// intentionally not possible through ordinary user management (see
// master prompt section 10: it needs its own explicit, MFA-gated,
// audited operation, which is a later/separate task).
router.post(
  '/',
  validateBody(createUserSchema),
  blockProtectedRoleTarget((req) => req.body.role),
  createUserController,
);

router.patch(
  '/:id',
  validateParams(userIdParamsSchema),
  validateBody(updateUserSchema),
  updateUserController,
);

router.patch(
  '/:id/role',
  validateParams(userIdParamsSchema),
  validateBody(changeUserRoleSchema),
  blockProtectedRoleTarget((req) => req.body.role),
  changeUserRoleController,
);

router.patch(
  '/:id/status',
  validateParams(userIdParamsSchema),
  validateBody(setUserStatusSchema),
  setUserStatusController,
);

/**
 * POST /users/:id/reset-password
 *
 * Admin-initiated password reset. Never reads or returns the old
 * password. Accepts a new password, hashes it with Argon2id,
 * revokes all active sessions. The old hash is overwritten.
 * Audit event: USER_PASSWORD_RESET_BY_ADMIN.
 */
router.post(
  '/:id/reset-password',
  validateParams(userIdParamsSchema),
  validateBody(resetPasswordSchema),
  resetUserPasswordController,
);

/**
 * DELETE /users/:id
 *
 * Two-tier deletion:
 * - SOFTWARE_OWNER / SUPER_ADMIN + ?hardDelete=true → permanent database deletion
 * - All others (or no hardDelete flag) → soft-delete (isDeleted: true, INACTIVE, sessions revoked)
 */
router.delete(
  '/:id',
  validateParams(userIdParamsSchema),
  validateQuery(deleteUserQuerySchema),
  deleteUserController,
);

/**
 * POST /users/:id/restore
 *
 * Restores a soft-deleted account.
 * Only SOFTWARE_OWNER and SUPER_ADMIN can see and use this action.
 */
router.post(
  '/:id/restore',
  validateParams(userIdParamsSchema),
  restoreUserController,
);

export default router;
