import {
  listUsers,
  getUserById,
  createUserByAdmin,
  updateUserProfile,
  changeUserRole,
  setUserStatus,
  adminResetPassword,
  deleteUser,
  restoreUser,
} from '../services/user.service.js';

import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordAdministrativeAction } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const listUsersController = async (req, res, next) => {
  try {
    const { role, status, search, page, limit, includeDeleted, onlyDeleted } = req.query;

    const { items, total, page: currentPage, limit: currentLimit } =
      await listUsers({
        role,
        status,
        search,
        page,
        limit,
        includeDeleted,
        onlyDeleted,
        actorRole: req.user.role,
      });

    return sendPaginated(res, {
      message: 'Users retrieved successfully.',
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

export const getUserController = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);

    return sendSuccess(res, {
      message: 'User retrieved successfully.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const createUserController = async (req, res, next) => {
  try {
    const { name, email, username, role, password } = req.body;

    const user = await createUserByAdmin(
      { name, email, username, role , password },
      req.user._id,
      req.user.role,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.USER_CREATE_BY_ADMIN,
      resourceType: 'User',
      resourceId: user?._id,
      metadata: { role },
    });

    return sendSuccess(res, {
      statusCode: 201,
      message:
        'User account created successfully. A password-setup email has been sent.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserController = async (req, res, next) => {
  try {
    const user = await updateUserProfile(req.params.id, req.body, req.user._id);

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.USER_DETAILS_UPDATE_BY_ADMIN,
      resourceType: 'User',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'User profile updated successfully.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const changeUserRoleController = async (req, res, next) => {
  try {
    const user = await changeUserRole(
      req.params.id,
      req.body.role,
      req.user._id,
      req.user.role,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
      resourceType: 'User',
      resourceId: req.params.id,
      metadata: { newRole: req.body.role },
    });

    return sendSuccess(res, {
      message: 'User role updated successfully.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.code === 'PROTECTED_ACCOUNT') {
      await recordAdministrativeAction(req, {
        action: AUDIT_ACTIONS.PROTECTED_ACCOUNT_ACTION_BLOCKED,
        resourceType: 'User',
        resourceId: req.params.id,
        outcome: 'DENIED',
        reason: 'PROTECTED_ACCOUNT',
      });
    }
    return next(error);
  }
};

export const setUserStatusController = async (req, res, next) => {
  try {
    const user = await setUserStatus(
      req.params.id,
      req.body.status,
      req.user._id,
      req.user.role,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.USER_STATUS_CHANGE,
      resourceType: 'User',
      resourceId: req.params.id,
      metadata: { newStatus: req.body.status },
    });

    return sendSuccess(res, {
      message: 'User account status updated successfully.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.code === 'PROTECTED_ACCOUNT') {
      await recordAdministrativeAction(req, {
        action: AUDIT_ACTIONS.PROTECTED_ACCOUNT_ACTION_BLOCKED,
        resourceType: 'User',
        resourceId: req.params.id,
        outcome: 'DENIED',
        reason: 'PROTECTED_ACCOUNT',
      });
    }
    return next(error);
  }
};

/**
 * POST /users/:id/reset-password
 *
 * Admin-initiated password reset. The new password is hashed
 * server-side with Argon2id and the old hash is overwritten. The
 * plaintext is never logged, stored, or returned. All active
 * sessions are revoked.
 */
export const resetUserPasswordController = async (req, res, next) => {
  try {
    const user = await adminResetPassword(
      req.params.id,
      req.body.newPassword,
      req.user._id,
      req.user.role,
    );

    // AUDIT: record the action but NEVER log the password itself.
    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET_BY_ADMIN,
      resourceType: 'User',
      resourceId: req.params.id,
      metadata: { targetRole: user.role },
    });

    return sendSuccess(res, {
      message: 'Password reset successfully. All active sessions have been revoked.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.code === 'PROTECTED_ACCOUNT') {
      await recordAdministrativeAction(req, {
        action: AUDIT_ACTIONS.PROTECTED_ACCOUNT_ACTION_BLOCKED,
        resourceType: 'User',
        resourceId: req.params.id,
        outcome: 'DENIED',
        reason: 'PROTECTED_ACCOUNT',
      });
    }
    return next(error);
  }
};

/**
 * DELETE /users/:id
 *
 * Two-tier deletion:
 * - SOFTWARE_OWNER / SUPER_ADMIN + ?hardDelete=true → permanent database deletion
 * - All others (or no hardDelete flag) → soft-delete (isDeleted: true, INACTIVE, sessions revoked)
 */
export const deleteUserController = async (req, res, next) => {
  try {
    const hardDelete = req.query.hardDelete === true || req.query.hardDelete === 'true';

    const user = await deleteUser(
      req.params.id,
      req.user._id,
      req.user.role,
      { hardDelete },
    );

    const isPermanent = user?.deletedPermanently === true;

    await recordAdministrativeAction(req, {
      action: isPermanent ? AUDIT_ACTIONS.USER_DELETE_BY_ADMIN : AUDIT_ACTIONS.USER_DELETE_BY_ADMIN,
      resourceType: 'User',
      resourceId: req.params.id,
      metadata: { targetRole: user.role, hardDelete: isPermanent },
    });

    return sendSuccess(res, {
      message: isPermanent
        ? 'User account has been permanently deleted from the database.'
        : 'User account has been soft-deleted (archived) successfully.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.code === 'PROTECTED_ACCOUNT') {
      await recordAdministrativeAction(req, {
        action: AUDIT_ACTIONS.PROTECTED_ACCOUNT_ACTION_BLOCKED,
        resourceType: 'User',
        resourceId: req.params.id,
        outcome: 'DENIED',
        reason: 'PROTECTED_ACCOUNT',
      });
    }
    return next(error);
  }
};

/**
 * POST /users/:id/restore
 *
 * Restores a soft-deleted account. Only SOFTWARE_OWNER and SUPER_ADMIN
 * can execute this action.
 */
export const restoreUserController = async (req, res, next) => {
  try {
    const user = await restoreUser(
      req.params.id,
      req.user._id,
      req.user.role,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.USER_STATUS_CHANGE,
      resourceType: 'User',
      resourceId: req.params.id,
      metadata: { action: 'RESTORE', targetRole: user.role },
    });

    return sendSuccess(res, {
      message: 'User account has been restored successfully.',
      data: user,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
