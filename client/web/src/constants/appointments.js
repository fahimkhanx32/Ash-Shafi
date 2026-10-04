/**
 * FET-09 — mirrors the backend enums exactly (copied from
 * `server/src/modules/appointments/models/appointment.model.js` and
 * `server/src/modules/queue/models/queue-entry.model.js`) so the UI
 * never invents a status value the backend doesn't recognize.
 */
export const APPOINTMENT_STATUSES = Object.freeze([
  'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW',
]);

export const APPOINTMENT_VISIT_TYPES = Object.freeze(['NEW', 'FOLLOW_UP']);
export const APPOINTMENT_CONSULTATION_MODES = Object.freeze(['PHYSICAL', 'ONLINE']);

export const QUEUE_STATUSES = Object.freeze([
  'WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
]);

const APPOINTMENT_STATUS_LABELS = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No-show',
};

const QUEUE_STATUS_LABELS = {
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_CONSULTATION: 'In consultation',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

export const appointmentStatusLabel = (status) => APPOINTMENT_STATUS_LABELS[status] || status;
export const queueStatusLabel = (status) => QUEUE_STATUS_LABELS[status] || status;

export const appointmentStatusVariant = (status) => {
  if (status === 'COMPLETED' || status === 'CONFIRMED' || status === 'CHECKED_IN') return 'success';
  if (status === 'SCHEDULED') return 'info';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'destructive';
  if (status === 'RESCHEDULED') return 'warning';
  return 'neutral';
};

export const queueStatusVariant = (status) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_CONSULTATION' || status === 'CALLED') return 'info';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'destructive';
  return 'neutral';
};

export const visitTypeLabel = (type) => (type === 'FOLLOW_UP' ? 'Follow-up' : 'New patient');
export const consultationModeLabel = (mode) => (mode === 'ONLINE' ? 'Online' : 'Physical');

// Statuses from which an appointment can still be cancelled/rescheduled/
// checked in — mirrors what the backend's state machine actually allows
// (server/src/modules/appointments/services/appointment.service.js) so the
// UI doesn't offer an action that would just 409.
export const CANCELLABLE_STATUSES = ['SCHEDULED', 'CONFIRMED'];
export const RESCHEDULABLE_STATUSES = ['SCHEDULED', 'CONFIRMED'];
export const CHECK_IN_ELIGIBLE_STATUSES = ['SCHEDULED', 'CONFIRMED'];
export const CONFIRMABLE_STATUSES = ['SCHEDULED'];
export const NO_SHOWABLE_STATUSES = ['SCHEDULED', 'CONFIRMED'];

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
