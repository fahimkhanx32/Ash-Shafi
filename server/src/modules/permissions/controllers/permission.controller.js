import {
  getPermissionCatalog,
  getSystemRolePermissionMatrix,
} from '../services/permission.service.js';

export const getPermissionCatalogController = async (req, res, next) => {
  try {
    const catalog = getPermissionCatalog();

    return res.status(200).json({
      success: true,
      message: 'Permission catalog retrieved successfully.',
      data: catalog,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSystemRoleMatrixController = async (req, res, next) => {
  try {
    const matrix = getSystemRolePermissionMatrix();

    return res.status(200).json({
      success: true,
      message: 'System role permission matrix retrieved successfully.',
      data: matrix,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
