import express from 'express';

import {
  listRolesController,
  getRoleController,
  createRoleController,
  updateRoleController,
  deleteRoleController,
} from '../controllers/role.controller.js';

import {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamsSchema,
  listRolesQuerySchema,
} from '../validators/role.validation.js';

import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middlewares/validation.middleware.js';

import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

// Role administration is authenticated + explicitly permissioned on
// every route (never inferred from the frontend) — see master
// prompt section 80. Reading the role list/detail requires
// `roles:read` (granted to SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR,
// ADMIN); creating/editing/deactivating a custom role requires
// `roles:write` (granted only to SOFTWARE_OWNER and SUPER_ADMIN).
router.use(authenticate);

router.get(
  '/',
  authorize(PERMISSIONS.ROLES_READ),
  validateQuery(listRolesQuerySchema),
  listRolesController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.ROLES_READ),
  validateParams(roleIdParamsSchema),
  getRoleController,
);

router.post(
  '/',
  authorize(PERMISSIONS.ROLES_WRITE),
  validateBody(createRoleSchema),
  createRoleController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.ROLES_WRITE),
  validateParams(roleIdParamsSchema),
  validateBody(updateRoleSchema),
  updateRoleController,
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.ROLES_WRITE),
  validateParams(roleIdParamsSchema),
  deleteRoleController,
);

export default router;
