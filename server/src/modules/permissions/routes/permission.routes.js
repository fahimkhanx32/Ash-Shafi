import express from 'express';

import {
  getPermissionCatalogController,
  getSystemRoleMatrixController,
} from '../controllers/permission.controller.js';

import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

// Every route in this module requires authentication plus explicit
// roles/permissions administration authorization — never inferred
// from the frontend, per master prompt section 80.
router.use(authenticate);

router.get(
  '/',
  authorize(PERMISSIONS.PERMISSIONS_READ),
  getPermissionCatalogController,
);

router.get(
  '/role-matrix',
  authorize(PERMISSIONS.PERMISSIONS_READ),
  getSystemRoleMatrixController,
);

export default router;
