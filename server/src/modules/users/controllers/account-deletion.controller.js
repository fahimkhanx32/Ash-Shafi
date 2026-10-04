import {
  requestAccountDeletion,
  cancelAccountDeletionRequest,
  listAccountDeletionRequests,
  getAccountDeletionRequestById,
  processAccountDeletionRequest,
} from '../services/account-deletion.service.js';

import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordUserAction, recordAdministrativeAction } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

// ------------------------------------------------------------------
// Self-service (mounted under /api/v1/auth/me/deletion-request)
// ------------------------------------------------------------------

export const requestMyAccountDeletionController = async (req, res, next) => {
  try {
    const { password, reason } = req.body;

    const request = await requestAccountDeletion({
      userId: req.user._id,
      password,
      reason,
    });

    await recordUserAction(req, {
      action: AUDIT_ACTIONS.ACCOUNT_DELETION_REQUESTED,
      resourceType: 'AccountDeletionRequest',
      resourceId: request._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message:
        'Your account deletion request has been recorded and will be reviewed by staff. Your account remains active until then, and you can cancel this request at any time before it is processed.',
      data: {
        id: request._id.toString(),
        status: request.status,
        requestedAt: request.requestedAt,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.code === 'PROTECTED_ACCOUNT') {
      await recordUserAction(req, {
        action: AUDIT_ACTIONS.ACCOUNT_DELETION_REQUESTED,
        resourceType: 'User',
        resourceId: req.user?._id,
        outcome: 'DENIED',
        reason: 'PROTECTED_ACCOUNT',
      });
    }
    return next(error);
  }
};

export const cancelMyAccountDeletionController = async (req, res, next) => {
  try {
    const request = await cancelAccountDeletionRequest({
      userId: req.user._id,
      notes: req.body?.notes,
    });

    await recordUserAction(req, {
      action: AUDIT_ACTIONS.ACCOUNT_DELETION_CANCELLED,
      resourceType: 'AccountDeletionRequest',
      resourceId: request._id,
    });

    return sendSuccess(res, {
      message: 'Your account deletion request has been cancelled.',
      data: {
        id: request._id.toString(),
        status: request.status,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// ------------------------------------------------------------------
// Administrative review (mounted under /api/v1/users/deletion-requests)
// ------------------------------------------------------------------

export const listAccountDeletionRequestsController = async (req, res, next) => {
  try {
    const { status, search, page, limit } = req.query;

    const { items, total, page: currentPage, limit: currentLimit } =
      await listAccountDeletionRequests({ status, search, page, limit });

    return sendPaginated(res, {
      message: 'Account deletion requests retrieved successfully.',
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

export const getAccountDeletionRequestController = async (req, res, next) => {
  try {
    const request = await getAccountDeletionRequestById(req.params.id);

    return sendSuccess(res, {
      message: 'Account deletion request retrieved successfully.',
      data: request,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const processAccountDeletionRequestController = async (req, res, next) => {
  try {
    const { approve, notes } = req.body;

    const { request, user } = await processAccountDeletionRequest({
      requestId: req.params.id,
      approve,
      notes,
      actorId: req.user._id,
      actorRole: req.user.role,
    });

    await recordAdministrativeAction(req, {
      action: approve
        ? AUDIT_ACTIONS.ACCOUNT_DELETION_APPROVED
        : AUDIT_ACTIONS.ACCOUNT_DELETION_REJECTED,
      resourceType: 'AccountDeletionRequest',
      resourceId: request._id,
      patientId: request.user,
      metadata: { approve },
    });

    return sendSuccess(res, {
      message: approve
        ? 'Deletion request approved. The account has been anonymized and deactivated; associated clinical/medical records have been retained per policy.'
        : 'Deletion request rejected. The account remains active and unchanged.',
      data: { request, user },
      requestId: req.requestId,
    });
  } catch (error) {
    if (error?.code === 'PROTECTED_ACCOUNT') {
      await recordAdministrativeAction(req, {
        action: AUDIT_ACTIONS.PROTECTED_ACCOUNT_ACTION_BLOCKED,
        resourceType: 'AccountDeletionRequest',
        resourceId: req.params.id,
        outcome: 'DENIED',
        reason: 'PROTECTED_ACCOUNT',
      });
    }
    return next(error);
  }
};
