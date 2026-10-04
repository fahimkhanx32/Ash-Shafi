import { getAppointmentAnalytics } from './appointment-analytics.service.js';
import { getQueueAnalytics } from './queue-analytics.service.js';
import { getStaffMetrics } from './staff-metrics.service.js';

/**
 * BET-20 checkpoint — "Operational analytics" (master prompt §51 —
 * "operational performance"). Deliberately a thin composition over
 * the appointment/queue/staff services rather than its own
 * aggregation pipeline — "how is the clinic running" is exactly
 * "appointments today + queue today + staffing today" and
 * duplicating those pipelines here would just be a second place for
 * the same bug to happen twice. `doctorId` scoping (DOCTOR callers
 * forced to their own id) is enforced once in the controller and
 * simply passed through to the two sub-services that use it —
 * `getStaffMetrics` intentionally ignores it, since staff
 * composition is never a "my own" concept the way appointment/queue
 * throughput is.
 */
export const getOperationalAnalytics = async ({ from, to, granularity, doctorId } = {}) => {
  const [appointments, queue, staff] = await Promise.all([
    getAppointmentAnalytics({ from, to, granularity, doctorId }),
    getQueueAnalytics({ from, to, granularity, doctorId }),
    getStaffMetrics({ from, to }),
  ]);

  return {
    appointments: appointments.summary,
    queue: queue.summary,
    staff: staff.summary,
  };
};
