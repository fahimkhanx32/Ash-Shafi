import {
  listMyAuditLogs,
  listAuditLogsAdmin,
  getAuditLogById,
  listSensitiveRecordAccessAdmin,
  listReportAccessAdmin,
} from '../services/audit-log-query.service.js';
import { sendPaginated, sendSuccess } from '../../../utils/apiResponse.js';

/**
 * FET-20 (minimal slice) — `GET /api/v1/audit-logs/me`.
 *
 * Deliberately no permission check beyond `authenticate` (see the
 * route file's own comment): this returns only the signed-in user's
 * own recorded actions, the same self-service boundary
 * `GET /notifications/me` / `GET /payments/me` already use elsewhere
 * in this project — not the cross-user audit trail `AUDIT_READ`
 * gates, which stays out of scope for this slice.
 */
export const listMyAuditLogsController = async (req, res, next) => {
  try {
    const { items, total } = await listMyAuditLogs(req.user._id, req.query);

    return sendPaginated(res, {
      message: 'Audit log retrieved.',
      items,
      page: req.query.page,
      limit: req.query.limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * FET-20 prerequisite backend — `GET /api/v1/audit-logs` (admin
 * viewer). `authorize(PERMISSIONS.AUDIT_READ)` at the route layer is
 * what makes this "respect backend permissions" — this controller
 * assumes that gate has already run, same as every other admin-tier
 * list controller in this project.
 */
export const listAuditLogsAdminController = async (req, res, next) => {
  try {
    const { items, total } = await listAuditLogsAdmin(req.query);

    return sendPaginated(res, {
      message: 'Audit log entries retrieved.',
      items,
      page: req.query.page,
      limit: req.query.limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * FET-20 prerequisite backend — `GET /api/v1/audit-logs/:id` ("Audit
 * details"). Same `AUDIT_READ` gate as the list route.
 */
export const getAuditLogAdminController = async (req, res, next) => {
  try {
    const entry = await getAuditLogById(req.params.id);

    if (!entry) {
      return next(
        Object.assign(new Error('Audit log entry not found.'), {
          statusCode: 404,
          code: 'AUDIT_LOG_NOT_FOUND',
        }),
      );
    }

    return sendSuccess(res, {
      message: 'Audit log entry retrieved.',
      data: entry,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * FET-20 — Audit Administration, checkpoint 2: "Sensitive-record
 * access" — `GET /api/v1/audit-logs/sensitive-record-access`. Same
 * `AUDIT_READ` gate as the general admin viewer above, enforced at
 * the route layer.
 */
export const listSensitiveRecordAccessController = async (req, res, next) => {
  try {
    const { items, total } = await listSensitiveRecordAccessAdmin(req.query);

    return sendPaginated(res, {
      message: 'Sensitive-record access log retrieved.',
      items,
      page: req.query.page,
      limit: req.query.limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * FET-20 — Audit Administration, checkpoint 2: "File access" —
 * `GET /api/v1/audit-logs/file-access`. Same `AUDIT_READ` gate as
 * the general admin viewer above, enforced at the route layer.
 */
export const listReportAccessController = async (req, res, next) => {
  try {
    const { items, total } = await listReportAccessAdmin(req.query);

    return sendPaginated(res, {
      message: 'File access log retrieved.',
      items,
      page: req.query.page,
      limit: req.query.limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
