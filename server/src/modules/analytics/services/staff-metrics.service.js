import {
  StaffProfile,
  STAFF_DESIGNATIONS,
  STAFF_EMPLOYMENT_STATUSES,
  STAFF_EMPLOYMENT_TYPES,
} from '../../staff/models/staff-profile.model.js';
import { Appointment } from '../../appointments/models/appointment.model.js';
import { resolveDateRange } from '../utils/date-range.util.js';

/**
 * BET-20 checkpoint — "Staff metrics" (master prompt §51 does not
 * name staff analytics explicitly, but Phase 10's own checkpoint
 * list does — "Staff metrics" — so this covers headcount/composition
 * from `StaffProfile` plus, for doctors specifically, a caseload
 * figure sourced from `Appointment`, since `StaffProfile` itself
 * carries no activity data of its own).
 *
 * Headcount figures are a current-state snapshot (today's active
 * roster), not time-series — a staff roster does not have a
 * meaningful "rate per day" the way appointments/queue/billing do.
 * The doctor-caseload figure is the one part of this service that
 * *is* date-ranged, since it is really sourced from `Appointment`.
 */
export const getStaffMetrics = async ({ from, to } = {}) => {
  const { start, end } = resolveDateRange({ from, to });

  const [designationBreakdown, employmentTypeBreakdown, employmentStatusBreakdown, doctorCaseload] =
    await Promise.all([
      StaffProfile.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$designation', count: { $sum: 1 } } },
        { $project: { _id: 0, designation: '$_id', count: 1 } },
      ]),
      StaffProfile.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$employmentType', count: { $sum: 1 } } },
        { $project: { _id: 0, employmentType: '$_id', count: 1 } },
      ]),
      StaffProfile.aggregate([
        { $group: { _id: '$employmentStatus', count: { $sum: 1 } } },
        { $project: { _id: 0, employmentStatus: '$_id', count: 1 } },
      ]),
      Appointment.aggregate([
        { $match: { appointmentDate: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$doctor',
            totalAppointments: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'doctorUser',
          },
        },
        { $unwind: { path: '$doctorUser', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            doctorId: '$_id',
            name: { $ifNull: ['$doctorUser.name', ''] },
            totalAppointments: 1,
            completed: 1,
          },
        },
        { $sort: { totalAppointments: -1 } },
      ]),
    ]);

  const designationCounts = Object.fromEntries(STAFF_DESIGNATIONS.map((d) => [d, 0]));
  designationBreakdown.forEach(({ designation, count }) => {
    designationCounts[designation] = count;
  });

  const employmentTypeCounts = Object.fromEntries(STAFF_EMPLOYMENT_TYPES.map((t) => [t, 0]));
  employmentTypeBreakdown.forEach(({ employmentType, count }) => {
    employmentTypeCounts[employmentType] = count;
  });

  const employmentStatusCounts = Object.fromEntries(
    STAFF_EMPLOYMENT_STATUSES.map((s) => [s, 0]),
  );
  employmentStatusBreakdown.forEach(({ employmentStatus, count }) => {
    employmentStatusCounts[employmentStatus] = count;
  });

  const activeTotal = designationBreakdown.reduce((sum, r) => sum + r.count, 0);

  return {
    range: { from: start, to: end },
    summary: {
      activeStaffTotal: activeTotal,
    },
    breakdown: {
      byDesignation: designationCounts,
      byEmploymentType: employmentTypeCounts,
      byEmploymentStatus: employmentStatusCounts,
    },
    doctorCaseload,
  };
};
