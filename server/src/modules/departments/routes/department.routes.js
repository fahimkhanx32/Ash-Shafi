import express from 'express';

import {
  createDepartmentController,
  getDepartmentController,
  listDepartmentsController,
  updateDepartmentController,
  deactivateDepartmentController,
  reactivateDepartmentController,
} from '../controllers/department.controller.js';
import * as departmentValidation from '../validators/department.validation.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * Departments administration routes.
 *
 * Reuses `USERS_READ` / `USERS_WRITE` rather than introducing a
 * separate `departments:*` permission pair — departments are staff/
 * organizational administration, the exact same `PERMISSION_GROUPS`
 * "Users & Staff" bucket `staff.routes.js` already reuses these
 * permissions for (see that file's own header comment for the
 * precedent). Every route is authenticated; there is no public read
 * here — the department list only matters to the same admin-tier
 * roles that already manage staff profiles.
 */
const router = express.Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.USERS_READ));

router.get('/', validateQuery(departmentValidation.listDepartmentsQuerySchema), listDepartmentsController);

router.get('/:id', validateParams(departmentValidation.departmentIdParamSchema), getDepartmentController);

router.post(
  '/',
  authorize(PERMISSIONS.USERS_WRITE),
  validateBody(departmentValidation.createDepartmentSchema),
  createDepartmentController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.USERS_WRITE),
  validateParams(departmentValidation.departmentIdParamSchema),
  validateBody(departmentValidation.updateDepartmentSchema),
  updateDepartmentController,
);

router.post(
  '/:id/deactivate',
  authorize(PERMISSIONS.USERS_WRITE),
  validateParams(departmentValidation.departmentIdParamSchema),
  deactivateDepartmentController,
);

router.post(
  '/:id/reactivate',
  authorize(PERMISSIONS.USERS_WRITE),
  validateParams(departmentValidation.departmentIdParamSchema),
  reactivateDepartmentController,
);

export default router;
