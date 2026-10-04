import {
  getSecurityDashboard,
  listSessionsAdmin,
  revokeSessionAdmin,
  getAccountSecurityAdmin,
  unlockAccountAdmin,
  listSecurityEventsForAdmin,
  listSecurityAlerts,
} from '../services/security-admin.service.js';

import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordAdministrativeAction } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

// ------------------------------------------------------------------
// Security dashboard
// ------------------------------------------------------------------

export const getSecurityDashboardController = async (req, res, next) => {
  try {
    const dashboard = await getSecurityDashboard();

    return sendSuccess(res, {
      message: 'Security dashboard retrieved.',
      data: dashboard,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// ------------------------------------------------------------------
// Active sessions (admin)
// ------------------------------------------------------------------

export const listSessionsAdminController = async (req, res, next) => {
  try {
    const { items, total, page, limit } = await listSessionsAdmin(req.query);

    return sendPaginated(res, {
      message: 'Active sessions retrieved.',
      items,
      page,
      limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const revokeSessionAdminController = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const result = await revokeSessionAdmin({
      sessionId,
      actorId: req.user._id,
      actorRole: req.user.role,
      reason,
    });

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.SESSION_REVOKED_BY_ADMIN,
      resourceType: 'Session',
      resourceId: sessionId,
      reason,
      metadata: { targetUser: result.targetUser },
    });

    return sendSuccess(res, {
      message: 'Session revoked successfully.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// ------------------------------------------------------------------
// Account security (admin)
// ------------------------------------------------------------------

export const getAccountSecurityAdminController = async (req, res, next) => {
  try {
    const profile = await getAccountSecurityAdmin(req.params.userId);

    return sendSuccess(res, {
      message: 'Account security profile retrieved.',
      data: profile,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const unlockAccountAdminController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const result = await unlockAccountAdmin({
      userId,
      actorId: req.user._id,
      actorRole: req.user.role,
      reason,
    });

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.ACCOUNT_UNLOCKED_BY_ADMIN,
      resourceType: 'User',
      resourceId: userId,
      reason,
      metadata: { targetUser: result.user },
    });

    return sendSuccess(res, {
      message: 'Account unlocked successfully.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// ------------------------------------------------------------------
// Security / authentication events (admin)
// ------------------------------------------------------------------

export const listSecurityEventsAdminController = async (req, res, next) => {
  try {
    const { items, total, page, limit } = await listSecurityEventsForAdmin(req.query);

    return sendPaginated(res, {
      message: 'Security events retrieved.',
      items,
      page,
      limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// ------------------------------------------------------------------
// Security alerts
// ------------------------------------------------------------------

export const listSecurityAlertsController = async (req, res, next) => {
  try {
    const result = await listSecurityAlerts();

    return sendSuccess(res, {
      message: 'Security alerts retrieved.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
