import {
  getRetentionPolicy,
  previewExpiredData,
  purgeExpiredData,
} from '../services/data-lifecycle.service.js';

import { sendSuccess } from '../../../utils/apiResponse.js';
import { recordAdministrativeAction } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const getRetentionPolicyController = async (req, res, next) => {
  try {
    const policy = getRetentionPolicy();

    return sendSuccess(res, {
      message: 'Data retention & lifecycle policy retrieved successfully.',
      data: policy,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const previewExpiredDataController = async (req, res, next) => {
  try {
    const { categories } = req.query;

    const result = await previewExpiredData({ categories });

    return sendSuccess(res, {
      message: 'Purge-eligible record counts retrieved successfully. Nothing was deleted.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * The one genuinely destructive endpoint this module exposes. See
 * `data-lifecycle.service.js#purgeExpiredData` for the full
 * confirmation contract (password + explicit confirm + written
 * reason + SYSTEM_ADMIN permission, on top of this route's own
 * authorization gate).
 */
export const purgeExpiredDataController = async (req, res, next) => {
  const { categories, reason, confirm, password } = req.body;

  try {
    const result = await purgeExpiredData({
      categories,
      reason,
      confirm,
      password,
      actorId: req.user._id,
    });

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.DATA_RETENTION_PURGE_EXECUTED,
      resourceType: 'DataLifecyclePurge',
      metadata: {
        targets: result.targets,
        rejected: result.rejected,
        results: result.results,
        reason,
      },
    });

    return sendSuccess(res, {
      message: 'Expired data purged successfully per the configured retention policy.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    // Every failure path here — bad confirmation, wrong password, no
    // eligible category — is itself worth a DENIED audit entry: this
    // is a privileged, irreversible-by-design operation, so even
    // rejected attempts to invoke it are signal (master prompt §10's
    // "explicit privileged operation" discipline, reused here).
    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.DATA_RETENTION_PURGE_DENIED,
      resourceType: 'DataLifecyclePurge',
      outcome: 'DENIED',
      reason: error?.code || error?.message || 'UNKNOWN_ERROR',
      metadata: { categories: categories || null },
    });

    return next(error);
  }
};
