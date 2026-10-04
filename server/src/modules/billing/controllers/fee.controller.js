import * as feeService from '../services/fee.service.js';
import { hasPermission } from '../../../security/permissions.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const createFeeController = async (req, res, next) => {
  try {
    const fee = await feeService.createFee(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.FEE_CREATE,
      resourceType: 'Fee',
      resourceId: fee?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Fee created successfully.',
      data: fee,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateFeeController = async (req, res, next) => {
  try {
    const fee = await feeService.updateFee(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.FEE_UPDATE,
      resourceType: 'Fee',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Fee updated successfully.',
      data: fee,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const activateFeeController = async (req, res, next) => {
  try {
    const fee = await feeService.setFeeActive(req.params.id, true, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.FEE_ACTIVATE,
      resourceType: 'Fee',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Fee activated.',
      data: fee,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deactivateFeeController = async (req, res, next) => {
  try {
    const fee = await feeService.setFeeActive(req.params.id, false, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.FEE_DEACTIVATE,
      resourceType: 'Fee',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Fee deactivated.',
      data: fee,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getFeeController = async (req, res, next) => {
  try {
    const fee = await feeService.getFeeById(req.params.id);

    return sendSuccess(res, {
      message: 'Fee retrieved successfully.',
      data: fee,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /billing/fees is intentionally open to any authenticated user
// (master prompt §35/§86 — patients must see prices before booking),
// but `includeInactive` is only honored for a caller who actually
// holds `BILLING_WRITE` — never trusted purely because the query
// string asked for it.
export const listFeesController = async (req, res, next) => {
  try {
    const canSeeInactive = hasPermission(req.user.role, PERMISSIONS.BILLING_WRITE);

    const fees = await feeService.listFees({
      serviceType: req.query.serviceType,
      includeInactive: canSeeInactive && req.query.includeInactive === 'true',
    });

    return sendSuccess(res, {
      message: 'Fees retrieved successfully.',
      data: fees,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
