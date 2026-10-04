import express from 'express';

import {
  createStaffProfileController,
  listStaffProfilesController,
  listOrphanedUsersController,
  getStaffProfileController,
  getMyStaffProfileController,
  updateStaffProfileController,
  updateMyStaffProfileController,
  setEmploymentStatusController,
  deactivateStaffProfileController,
  reactivateStaffProfileController,
  listDoctorsController,
  getDoctorController,
  listPublicDoctorsController,
} from '../controllers/staff.controller.js';

import {
  createStaffProfileSchema,
  updateStaffProfileSchema,
  updateMyStaffProfileSchema,
  setEmploymentStatusSchema,
  staffIdParamsSchema,
  listStaffQuerySchema,
  listDoctorsQuerySchema,
} from '../validators/staff.validation.js';

import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middlewares/validation.middleware.js';

import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

// FET-16 — public website "Doctors" page. Must be declared before
// `router.use(authenticate)` below so it stays genuinely
// unauthenticated, same reasoning as `cms.routes.js`'s public GETs.
// Reuses `listDoctorsQuerySchema` purely for search/page/limit shape
// validation — `listPublicDoctorsController` itself never returns
// anything beyond the narrowed public fields regardless of what's
// queried.
router.get(
  '/public/doctors',
  validateQuery(listDoctorsQuerySchema),
  listPublicDoctorsController,
);

// Staff/HR administration is authenticated + explicitly permissioned
// on every route, never inferred from the frontend (master prompt
// section 80). The `PERMISSION_GROUPS` "users" group already covers
// "Users & Staff" together (see `security/permissions.js`), so
// staff profile administration reuses `USERS_READ` / `USERS_WRITE`
// rather than introducing a parallel permission pair.
router.use(authenticate);

// A staff member may always view their own profile without needing
// blanket `users:read` — mirrors the self-or-permission pattern
// already established by `authorizeSelfOrPermission` in BET-04.
router.get('/me', getMyStaffProfileController);

// Self-service profile edit — a staff member (doctor included) fills
// in their own personal/clinical details (phone, address, Bangla
// name/degrees for the prescription letterhead, etc.) once they log
// in, rather than needing an admin to enter it for them. Scoped to
// `SELF_UPDATABLE_FIELDS` in the service layer — org-assigned fields
// (designation, department, employment type/status) still require
// `USERS_WRITE` via `PATCH /:id` below.
router.patch(
  '/me',
  validateBody(updateMyStaffProfileSchema),
  updateMyStaffProfileController,
);

// Doctor-facing read views (master prompt BET-05: "Doctors" /
// "Doctor management"). Gated on `doctors:read` rather than
// `users:read` — a role can be granted visibility into the doctor
// roster (e.g. for future appointment-booking use) without also
// gaining general staff/HR administration access. Must be declared
// before `/:id` so `/doctors` and `/doctors/:id` are not swallowed by
// the generic staff-profile-by-id route below.
router.get(
  '/doctors',
  authorize(PERMISSIONS.DOCTORS_READ),
  validateQuery(listDoctorsQuerySchema),
  listDoctorsController,
);

router.get(
  '/doctors/:id',
  authorize(PERMISSIONS.DOCTORS_READ),
  validateParams(staffIdParamsSchema),
  getDoctorController,
);

router.get(
  '/',
  authorize(PERMISSIONS.USERS_READ),
  validateQuery(listStaffQuerySchema),
  listStaffProfilesController,
);

// Recovery-UI support (see `listOrphanedStaffUsers`) — must be
// declared before `/:id` below so `/orphaned-users` isn't swallowed
// by the generic staff-profile-by-id route. Reuses `USERS_READ`,
// same as every other staff-list read here.
router.get(
  '/orphaned-users',
  authorize(PERMISSIONS.USERS_READ),
  listOrphanedUsersController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.USERS_READ),
  validateParams(staffIdParamsSchema),
  getStaffProfileController,
);

router.post(
  '/',
  authorize(PERMISSIONS.USERS_WRITE),
  validateBody(createStaffProfileSchema),
  createStaffProfileController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.USERS_WRITE),
  validateParams(staffIdParamsSchema),
  validateBody(updateStaffProfileSchema),
  updateStaffProfileController,
);

router.patch(
  '/:id/employment-status',
  authorize(PERMISSIONS.USERS_WRITE),
  validateParams(staffIdParamsSchema),
  validateBody(setEmploymentStatusSchema),
  setEmploymentStatusController,
);

router.patch(
  '/:id/deactivate',
  authorize(PERMISSIONS.USERS_WRITE),
  validateParams(staffIdParamsSchema),
  deactivateStaffProfileController,
);

router.patch(
  '/:id/reactivate',
  authorize(PERMISSIONS.USERS_WRITE),
  validateParams(staffIdParamsSchema),
  reactivateStaffProfileController,
);

export default router;
