import {
  ANALYTICS_DOMAINS,
  ANALYTICS_DOMAIN_PERMISSION,
} from '../constants/analytics.constants.js';
import {
  getAppointmentAnalytics,
  requiresOwnDoctorScope,
} from '../services/appointment-analytics.service.js';
import { getQueueAnalytics } from '../services/queue-analytics.service.js';
import { getBillingAnalytics } from '../services/billing-analytics.service.js';
import { getStaffMetrics } from '../services/staff-metrics.service.js';
import { getClinicalStatistics } from '../services/clinical-statistics.service.js';
import { getOperationalAnalytics } from '../services/operational-analytics.service.js';
import { hasPermission } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { recordAnalyticsAccess } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';
import { AUDIT_CATEGORIES, AUDIT_OUTCOMES } from '../../../audit/audit.model.js';

const DOMAIN_HANDLERS = {
  [ANALYTICS_DOMAINS.OPERATIONAL]: getOperationalAnalytics,
  [ANALYTICS_DOMAINS.APPOINTMENTS]: getAppointmentAnalytics,
  [ANALYTICS_DOMAINS.QUEUE]: getQueueAnalytics,
  [ANALYTICS_DOMAINS.BILLING]: getBillingAnalytics,
  [ANALYTICS_DOMAINS.STAFF]: getStaffMetrics,
  [ANALYTICS_DOMAINS.CLINICAL]: getClinicalStatistics,
};

// Domains whose service accepts (and needs) `doctorId` scoping.
// Billing/clinical/staff deliberately excluded — see each service's
// own docstring for why.
const DOCTOR_SCOPED_DOMAINS = new Set([
  ANALYTICS_DOMAINS.OPERATIONAL,
  ANALYTICS_DOMAINS.APPOINTMENTS,
  ANALYTICS_DOMAINS.QUEUE,
]);

/**
 * BET-20 — `GET /api/v1/analytics/:domain`
 *
 * "Role-based analytics access" + "Analytics authorization": which
 * permission is required varies by `:domain` (operational/
 * appointments/queue/staff need `ANALYTICS_READ`; billing needs
 * `ANALYTICS_BILLING_READ`; clinical needs `ANALYTICS_CLINICAL_READ`
 * — see `ANALYTICS_DOMAIN_PERMISSION`), so — same two-layer shape
 * `tabularExportController` (BET-19) already uses for its own
 * `:entityType` param — this is checked here rather than as a fixed
 * `authorize(...)` on the route, since the route can't know which
 * permission applies until it sees the param.
 *
 * "Sensitive-data protection" for the DOCTOR role: a `DOCTOR` caller
 * querying a doctor-scoped domain is always forced to their own id
 * here, overwriting whatever `doctorId` the query string supplied —
 * never trusting the client to self-report the correct scope, same
 * "server decides, client only requests" principle used throughout
 * this project's ownership checks.
 *
 * "Analytics audit logging": every attempt — allowed or denied — is
 * recorded via `recordAnalyticsAccess`, mirroring BET-19's
 * `recordExport` fail-safe contract (a logging failure never blocks
 * the request).
 */
export const getAnalyticsController = async (req, res, next) => {
  const { domain } = req.params;
  const { from, to, granularity } = req.query;
  let { doctorId } = req.query;

  try {
    const requiredPermission = ANALYTICS_DOMAIN_PERMISSION[domain];
    const permissionOk = requiredPermission && hasPermission(req.user.role, requiredPermission);

    if (!permissionOk) {
      await recordAnalyticsAccess(req, {
        category: AUDIT_CATEGORIES.ADMINISTRATIVE_ACTION,
        action: AUDIT_ACTIONS.ANALYTICS_ACCESS_DENIED,
        resourceType: domain,
        outcome: AUDIT_OUTCOMES.DENIED,
        reason: 'MISSING_ANALYTICS_PERMISSION',
      });

      throw new AppError('You do not have permission to view this analytics domain.', 403, {
        code: 'ANALYTICS_FORBIDDEN',
      });
    }

    if (DOCTOR_SCOPED_DOMAINS.has(domain) && requiresOwnDoctorScope(req.user.role)) {
      doctorId = req.user._id;
    }

    const handler = DOMAIN_HANDLERS[domain];
    const data = await handler({ from, to, granularity, doctorId });

    await recordAnalyticsAccess(req, {
      category:
        domain === ANALYTICS_DOMAINS.CLINICAL
          ? AUDIT_CATEGORIES.CLINICAL_ACCESS
          : AUDIT_CATEGORIES.ADMINISTRATIVE_ACTION,
      action: AUDIT_ACTIONS.ANALYTICS_ACCESSED,
      resourceType: domain,
      metadata: { from, to, granularity, doctorId: doctorId || null },
    });

    return res.status(200).json({
      success: true,
      data,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
