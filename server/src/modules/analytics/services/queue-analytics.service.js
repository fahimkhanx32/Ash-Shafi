import mongoose from 'mongoose';
import { QueueEntry, QUEUE_STATUSES } from '../../queue/models/queue-entry.model.js';
import { resolveDateRange, granularityToDateFormat } from '../utils/date-range.util.js';

/**
 * BET-20 checkpoint — "Queue analytics" (master prompt §51 —
 * operational performance / no-shows, applied to the live queue
 * rather than the appointment book).
 *
 * Wait time = `calledAt - checkedInAt`; consultation duration =
 * `completedAt - consultationStartedAt`. Both are only computed over
 * entries that actually reached that stage (an entry still WAITING
 * has no `calledAt` yet) — `$match`-ing on the timestamp being
 * non-null before averaging, rather than letting a null subtract
 * skew the mean toward zero.
 *
 * `doctorId` scoping follows the same "force to own id for a DOCTOR
 * caller" contract as `appointment-analytics.service.js` — see that
 * file's docstring; the controller resolves which id to pass in.
 */
export const getQueueAnalytics = async ({ from, to, granularity, doctorId } = {}) => {
  const { start, end, granularity: resolvedGranularity } = resolveDateRange({
    from,
    to,
    granularity,
  });

  const match = {
    queueDate: { $gte: start, $lte: end },
  };
  if (doctorId) {
    match.doctor = new mongoose.Types.ObjectId(doctorId);
  }

  const dateFormat = granularityToDateFormat(resolvedGranularity);

  const [statusBreakdown, waitTimeAgg, consultationDurationAgg, series, totals] =
    await Promise.all([
      QueueEntry.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      QueueEntry.aggregate([
        { $match: { ...match, calledAt: { $ne: null } } },
        {
          $project: {
            waitMinutes: {
              $divide: [{ $subtract: ['$calledAt', '$checkedInAt'] }, 60000],
            },
          },
        },
        { $group: { _id: null, avgWaitMinutes: { $avg: '$waitMinutes' } } },
      ]),
      QueueEntry.aggregate([
        { $match: { ...match, consultationStartedAt: { $ne: null }, completedAt: { $ne: null } } },
        {
          $project: {
            durationMinutes: {
              $divide: [{ $subtract: ['$completedAt', '$consultationStartedAt'] }, 60000],
            },
          },
        },
        { $group: { _id: null, avgConsultationMinutes: { $avg: '$durationMinutes' } } },
      ]),
      QueueEntry.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$queueDate' } },
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
            noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, bucket: '$_id', total: 1, completed: 1, noShow: 1 } },
      ]),
      QueueEntry.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
            noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          },
        },
      ]),
    ]);

  const totalsDoc = totals[0] || { total: 0, completed: 0, noShow: 0, cancelled: 0 };
  const noShowRate = totalsDoc.total ? totalsDoc.noShow / totalsDoc.total : 0;

  const statusCounts = Object.fromEntries(QUEUE_STATUSES.map((status) => [status, 0]));
  statusBreakdown.forEach(({ status, count }) => {
    statusCounts[status] = count;
  });

  return {
    range: { from: start, to: end, granularity: resolvedGranularity },
    summary: {
      total: totalsDoc.total,
      completed: totalsDoc.completed,
      noShow: totalsDoc.noShow,
      cancelled: totalsDoc.cancelled,
      noShowRate,
      avgWaitMinutes: waitTimeAgg[0]?.avgWaitMinutes ?? null,
      avgConsultationMinutes: consultationDurationAgg[0]?.avgConsultationMinutes ?? null,
    },
    breakdown: {
      byStatus: statusCounts,
    },
    series,
  };
};
