import mongoose from 'mongoose';
import { Appointment, APPOINTMENT_STATUSES } from '../../appointments/models/appointment.model.js';
import { ROLES } from '../../../security/permissions.js';
import { resolveDateRange, granularityToDateFormat } from '../utils/date-range.util.js';

/**
 * BET-20 checkpoint — "Appointment analytics" (master prompt §51:
 * appointments, no-shows).
 *
 * Every service in this module follows the same shape: resolve the
 * caller-scoped filter, run one or more `$group` aggregation
 * pipelines, and return only pre-aggregated counts/rates — never a
 * cursor over raw `Appointment` documents. This is deliberate, not
 * just a performance choice: it's the mechanism that satisfies
 * "role-based analytics access" for DOCTOR callers below (a doctor
 * can see their own appointment throughput without a route ever
 * exposing another doctor's patient list) and, more broadly, keeps
 * every analytics endpoint returning aggregate shapes only, per
 * master prompt §51 "where possible, use aggregated/de-identified
 * data for statistics."
 *
 * `doctorId` scoping: a non-admin `DOCTOR` caller is always forced
 * to their own `req.user._id` regardless of any `doctorId` query
 * param the request supplies (see `analytics.controller.js`, which
 * resolves this before calling in) — a doctor's own operational
 * numbers are fine to self-serve, another doctor's are not, and
 * this must be enforced here (or the controller layer immediately
 * above it), not merely assumed from a route-level permission gate.
 */
export const getAppointmentAnalytics = async ({ from, to, granularity, doctorId } = {}) => {
  const { start, end, granularity: resolvedGranularity } = resolveDateRange({
    from,
    to,
    granularity,
  });

  const match = {
    appointmentDate: { $gte: start, $lte: end },
  };
  if (doctorId) {
    match.doctor = new mongoose.Types.ObjectId(doctorId);
  }

  const dateFormat = granularityToDateFormat(resolvedGranularity);

  const [statusBreakdown, series, visitTypeBreakdown, modeBreakdown, totals] = await Promise.all([
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            bucket: { $dateToString: { format: dateFormat, date: '$appointmentDate' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.bucket',
          byStatus: { $push: { status: '$_id.status', count: '$count' } },
          total: { $sum: '$count' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, bucket: '$_id', total: 1, byStatus: 1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$visitType', count: { $sum: 1 } } },
      { $project: { _id: 0, visitType: '$_id', count: 1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$consultationMode', count: { $sum: 1 } } },
      { $project: { _id: 0, consultationMode: '$_id', count: 1 } },
    ]),
    Appointment.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const totalsDoc = totals[0] || { total: 0, completed: 0, cancelled: 0, noShow: 0 };
  const cancellationRate = totalsDoc.total ? totalsDoc.cancelled / totalsDoc.total : 0;
  const noShowRate = totalsDoc.total ? totalsDoc.noShow / totalsDoc.total : 0;
  const completionRate = totalsDoc.total ? totalsDoc.completed / totalsDoc.total : 0;

  // Fill in any statuses that had zero occurrences in range, so
  // consumers always get a stable, complete shape rather than having
  // to check for missing keys.
  const statusCounts = Object.fromEntries(APPOINTMENT_STATUSES.map((status) => [status, 0]));
  statusBreakdown.forEach(({ status, count }) => {
    statusCounts[status] = count;
  });

  return {
    range: { from: start, to: end, granularity: resolvedGranularity },
    summary: {
      total: totalsDoc.total,
      completed: totalsDoc.completed,
      cancelled: totalsDoc.cancelled,
      noShow: totalsDoc.noShow,
      completionRate,
      cancellationRate,
      noShowRate,
    },
    breakdown: {
      byStatus: statusCounts,
      byVisitType: Object.fromEntries(visitTypeBreakdown.map((r) => [r.visitType, r.count])),
      byConsultationMode: Object.fromEntries(
        modeBreakdown.map((r) => [r.consultationMode, r.count]),
      ),
    },
    series,
  };
};

/** Whether a caller's role gets forced doctor-scoping (see docstring above). */
export const requiresOwnDoctorScope = (role) => role === ROLES.DOCTOR;
