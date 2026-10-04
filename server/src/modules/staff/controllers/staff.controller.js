import {
  createStaffProfile,
  listDoctorDirectoryForPatient,
  listStaffProfiles,
  listOrphanedStaffUsers,
  getStaffProfileById,
  getStaffProfileByUserId,
  updateStaffProfile,
  updateMyStaffProfile,
  setEmploymentStatus,
  deactivateStaffProfile,
  reactivateStaffProfile,
  listDoctors,
  getDoctorById,
  listPublicDoctors,
  toDoctorDirectoryEntry,
} from '../services/staff.service.js';

import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordAdministrativeAction } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

// FET-16 — public website "Doctors" page. Unauthenticated on purpose
// (mounted before `router.use(authenticate)` in staff.routes.js);
// returns `listPublicDoctors`'s already-narrowed, PII-free shape.
export const listPublicDoctorsController = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;

    const { items, total, page: currentPage, limit: currentLimit } =
      await listPublicDoctors({ search, page, limit });

    return sendPaginated(res, {
      message: 'Doctors retrieved successfully.',
      items,
      page: currentPage,
      limit: currentLimit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// Recovery-UI support — see `listOrphanedStaffUsers` for why this
// exists. Intentionally a flat, unpaginated list (not `sendPaginated`)
// since this is expected to be a short, occasional cleanup queue, not
// a routinely large collection.
export const listOrphanedUsersController = async (req, res, next) => {
  try {
    const users = await listOrphanedStaffUsers();

    return sendSuccess(res, {
      message: 'Users without a staff profile retrieved successfully.',
      data: users,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const createStaffProfileController = async (req, res, next) => {
  try {
    const profile = await createStaffProfile(req.body, req.user._id);

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.STAFF_PROFILE_CREATE,
      resourceType: 'StaffProfile',
      resourceId: profile?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Staff profile created successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listStaffProfilesController = async (req, res, next) => {
  try {
    const {
      designation,
      employmentStatus,
      department,
      search,
      includeInactive,
      page,
      limit,
    } = req.query;

    const { items, total, page: currentPage, limit: currentLimit } =
      await listStaffProfiles({
        designation,
        employmentStatus,
        department,
        search,
        includeInactive: includeInactive === 'true',
        page,
        limit,
      });

    return sendPaginated(res, {
      message: 'Staff profiles retrieved successfully.',
      items,
      page: currentPage,
      limit: currentLimit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getStaffProfileController = async (req, res, next) => {
  try {
    const profile = await getStaffProfileById(req.params.id);

    return sendSuccess(res, {
      message: 'Staff profile retrieved successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyStaffProfileController = async (req, res, next) => {
  try {
    const profile = await getStaffProfileByUserId(req.user._id);

    return sendSuccess(res, {
      message: 'Staff profile retrieved successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateStaffProfileController = async (req, res, next) => {
  try {
    const profile = await updateStaffProfile(
      req.params.id,
      req.body,
      req.user._id,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.STAFF_PROFILE_UPDATE,
      resourceType: 'StaffProfile',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Staff profile updated successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// Self-service counterpart of the admin-only controller above —
// scoped entirely by `req.user._id`, so there is no `:id` param a
// caller could point at someone else's profile.
export const updateMyStaffProfileController = async (req, res, next) => {
  try {
    const profile = await updateMyStaffProfile(
      req.user._id,
      req.body,
      req.user._id,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.STAFF_PROFILE_UPDATE,
      resourceType: 'StaffProfile',
      resourceId: profile._id,
    });

    return sendSuccess(res, {
      message: 'Your profile was updated successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const setEmploymentStatusController = async (req, res, next) => {
  try {
    const profile = await setEmploymentStatus(
      req.params.id,
      req.body.status,
      req.user._id,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.STAFF_STATUS_CHANGE,
      resourceType: 'StaffProfile',
      resourceId: req.params.id,
      metadata: { newStatus: req.body.status },
    });

    return sendSuccess(res, {
      message: 'Staff employment status updated successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deactivateStaffProfileController = async (req, res, next) => {
  try {
    const profile = await deactivateStaffProfile(req.params.id, req.user._id);

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.STAFF_STATUS_CHANGE,
      resourceType: 'StaffProfile',
      resourceId: req.params.id,
      metadata: { newStatus: 'DEACTIVATED' },
    });

    return sendSuccess(res, {
      message: 'Staff profile deactivated successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const reactivateStaffProfileController = async (req, res, next) => {
  try {
    const profile = await reactivateStaffProfile(req.params.id, req.user._id);

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.STAFF_STATUS_CHANGE,
      resourceType: 'StaffProfile',
      resourceId: req.params.id,
      metadata: { newStatus: 'REACTIVATED' },
    });

    return sendSuccess(res, {
      message: 'Staff profile reactivated successfully.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listDoctorsController = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;

    // Patients get the account-based directory (see
    // `listDoctorDirectoryForPatient`) so a registered doctor without a
    // staff profile is still selectable; staff keep the profile list.
    const isPatient = req.user.role === 'PATIENT';
    const { items, total, page: currentPage, limit: currentLimit } = isPatient
      ? await listDoctorDirectoryForPatient({ search, page, limit })
      : await listDoctors({ search, page, limit });

    return sendPaginated(res, {
      message: 'Doctors retrieved successfully.',
      // Patients hold doctors:read only to pick a recipient; they get the
      // narrow directory entry, never the full HR profile.
      items,
      page: currentPage,
      limit: currentLimit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getDoctorController = async (req, res, next) => {
  try {
    const doctor = await getDoctorById(req.params.id);

    return sendSuccess(res, {
      message: 'Doctor retrieved successfully.',
      data: req.user.role === 'PATIENT' ? toDoctorDirectoryEntry(doctor) : doctor,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
