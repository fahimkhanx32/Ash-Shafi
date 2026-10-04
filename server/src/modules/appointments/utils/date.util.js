/**
 * BET-10 — shared date helpers.
 *
 * All "day" fields in this module (`Appointment.appointmentDate`,
 * `BlockedDate.date`, `QueueEntry.queueDate`) are stored as UTC
 * midnight so equality/range queries are simple and consistent,
 * regardless of what time-of-day a request happens to arrive.
 * Clock-time comparisons for actual slot booking still use full
 * `Date` objects (`scheduledStart`/`scheduledEnd`) — only the
 * *day-bucket* fields go through this normalization.
 */

export const normalizeToDayStart = (dateLike) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const isSameDay = (a, b) => {
  const na = normalizeToDayStart(a);
  const nb = normalizeToDayStart(b);
  return !!na && !!nb && na.getTime() === nb.getTime();
};

export const dayOfWeekUTC = (dateLike) => new Date(dateLike).getUTCDay();

export const combineDateAndTime = (dateLike, hhmm) => {
  const day = normalizeToDayStart(dateLike);
  const [hours, minutes] = hhmm.split(':').map(Number);
  const combined = new Date(day);
  combined.setUTCHours(hours, minutes, 0, 0);
  return combined;
};

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

export const isPast = (date, now = new Date()) => date.getTime() < now.getTime();
