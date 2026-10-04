import {
  listRoles,
  getRoleById,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
} from '../services/role.service.js';

import { recordAdministrativeAction } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const listRolesController = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';

    const roles = await listRoles({ includeInactive });

    return res.status(200).json({
      success: true,
      message: 'Roles retrieved successfully.',
      data: roles,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getRoleController = async (req, res, next) => {
  try {
    const role = await getRoleById(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Role retrieved successfully.',
      data: role,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const createRoleController = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;

    const role = await createCustomRole({
      name,
      description,
      permissions,
      actorId: req.user._id,
    });

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.ROLE_CREATE,
      resourceType: 'Role',
      resourceId: role?._id,
      metadata: { name },
    });

    return res.status(201).json({
      success: true,
      message: 'Custom role created successfully.',
      data: role,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateRoleController = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;

    const role = await updateCustomRole(
      req.params.id,
      { name, description, permissions },
      req.user._id,
    );

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.ROLE_PERMISSIONS_UPDATE,
      resourceType: 'Role',
      resourceId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully.',
      data: role,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteRoleController = async (req, res, next) => {
  try {
    await deleteCustomRole(req.params.id);

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.ROLE_DELETE,
      resourceType: 'Role',
      resourceId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Role deactivated successfully.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
