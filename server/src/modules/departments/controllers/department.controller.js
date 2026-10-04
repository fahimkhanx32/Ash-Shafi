import * as departmentService from '../services/department.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const createDepartmentController = async (req, res, next) => {
  try {
    const department = await departmentService.createDepartment(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.DEPARTMENT_CREATE,
      resourceType: 'Department',
      resourceId: department?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Department created successfully.',
      data: department,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getDepartmentController = async (req, res, next) => {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    return sendSuccess(res, {
      message: 'Department retrieved successfully.',
      data: department,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listDepartmentsController = async (req, res, next) => {
  try {
    const { items, pagination } = await departmentService.listDepartments(req.query);
    return sendPaginated(res, {
      message: 'Departments retrieved successfully.',
      items,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateDepartmentController = async (req, res, next) => {
  try {
    const department = await departmentService.updateDepartment(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.DEPARTMENT_UPDATE,
      resourceType: 'Department',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Department updated successfully.',
      data: department,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deactivateDepartmentController = async (req, res, next) => {
  try {
    const department = await departmentService.deactivateDepartment(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.DEPARTMENT_DEACTIVATE,
      resourceType: 'Department',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Department deactivated successfully.',
      data: department,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const reactivateDepartmentController = async (req, res, next) => {
  try {
    const department = await departmentService.reactivateDepartment(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.DEPARTMENT_REACTIVATE,
      resourceType: 'Department',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Department reactivated successfully.',
      data: department,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
