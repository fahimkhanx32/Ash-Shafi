import { Appointment } from '../models/appointment.model.js';
import { getDoctorScheduleOrNull } from './schedule.service.js';
import { isDateBlocked } from './schedule.service.js';
import {
  normalizeToDayStart,
  dayOfWeekUTC,
  combineDateAndTime,
  addMinutes,
  isPast,
} from '../utils/date.util.js';
import { AppError } from '../../../middlewares/error.middleware.js';

/**
 * BET-10.2 — Doctor Availability, BET-10.3 — Appointment Slots.
 *
 * Slots are always computed fresh from `DoctorSchedule` +
 * `BlockedDate` + existing active `Appointment`s — never persisted
 * as their own documents. This is the single source of truth
 * `appointment.service.js`'s booking validation also calls into, so
 * "what slots does the patient see" and "is this slot still
 * bookable at the moment of booking" can never drift apart (master
 * prompt §80 — no separate, potentially-stale copy of availability
 * data to trust).
 */

const ACTIVE_APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'];

export const getAvailableSlots = async (doctorId, dateLike, { now = new Date() } = {}) => {
  const date = normalizeToDayStart(dateLike);
  if (!date) {
    throw new AppError('Invalid date.', 400, { code: 'INVALID_DATE' });
  }

  const schedule = await getDoctorScheduleOrNull(doctorId);
  if (!schedule || !schedule.isActive) {
    return { date, slots: [], reason: 'NO_SCHEDULE' };
  }

  const maxBookingDate = addMinutes(normalizeToDayStart(now), schedule.maxBookingHorizonDays * 24 * 60);
  if (date.getTime() > maxBookingDate.getTime()) {
    return { date, slots: [], reason: 'OUTSIDE_BOOKING_HORIZON' };
  }

  const blocked = await isDateBlocked(doctorId, date);
  if (blocked) {
    return { date, slots: [], reason: 'BLOCKED_DATE' };
  }

  const dayTemplate = schedule.weeklyAvailability.find((d) => d.dayOfWeek === dayOfWeekUTC(date));
  if (!dayTemplate || !dayTemplate.isActive || dayTemplate.blocks.length === 0) {
    return { date, slots: [], reason: 'DOCTOR_NOT_AVAILABLE_THIS_DAY' };
  }

  // Candidate slots from every block on this day.
  const candidates = [];
  for (const block of dayTemplate.blocks) {
    let cursor = combineDateAndTime(date, block.startTime);
    const blockEnd = combineDateAndTime(date, block.endTime);
    while (addMinutes(cursor, schedule.slotDurationMinutes).getTime() <= blockEnd.getTime()) {
      const slotStart = cursor;
      const slotEnd = addMinutes(cursor, schedule.slotDurationMinutes);
      candidates.push({ start: slotStart, end: slotEnd });
      cursor = addMinutes(cursor, schedule.slotDurationMinutes + schedule.bufferMinutes);
    }
  }

  // Exclude slots inside the minimum booking lead time / already past.
  const earliestBookable = addMinutes(now, schedule.minBookingLeadMinutes);
  const bookableCandidates = candidates.filter(
    (slot) => !isPast(slot.start, earliestBookable),
  );

  if (bookableCandidates.length === 0) {
    return { date, slots: [], reason: 'NO_BOOKABLE_SLOTS' };
  }

  // Existing active appointments occupy their slot.
  const dayStart = date;
  const dayEnd = addMinutes(date, 24 * 60);
  const existingAppointments = await Appointment.find({
    doctor: doctorId,
    appointmentDate: { $gte: dayStart, $lt: dayEnd },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
  })
    .select('scheduledStart scheduledEnd')
    .lean();

  const occupied = new Set(existingAppointments.map((a) => new Date(a.scheduledStart).getTime()));

  const slots = bookableCandidates.map((slot) => ({
    start: slot.start,
    end: slot.end,
    available: !occupied.has(slot.start.getTime()),
  }));

  return { date, slots, reason: null };
};

/**
 * Validates that `scheduledStart` is an actual slot boundary the
 * doctor's schedule currently offers and is not already taken —
 * called from `appointment.service.js` at booking/rescheduling time
 * so a request can never bypass the schedule by supplying an
 * arbitrary timestamp (master prompt §80).
 */
export const assertSlotIsBookable = async (doctorId, scheduledStart, { now = new Date(), excludeAppointmentId = null } = {}) => {
  const { slots, reason } = await getAvailableSlots(doctorId, scheduledStart, { now });

  if (reason && slots.length === 0) {
    throw new AppError('This doctor has no available slots on the requested date.', 409, {
      code: 'NO_AVAILABILITY',
      details: { reason },
    });
  }

  const targetTime = new Date(scheduledStart).getTime();
  const match = slots.find((slot) => slot.start.getTime() === targetTime);

  if (!match) {
    throw new AppError('The requested time is not a valid appointment slot for this doctor.', 409, {
      code: 'INVALID_SLOT',
    });
  }

  if (!match.available) {
    // A slot can appear "taken" only by the appointment being
    // rescheduled itself — double-check against the real document
    // rather than trusting the flag when excluding one appointment.
    if (excludeAppointmentId) {
      const clashing = await Appointment.findOne({
        doctor: doctorId,
        scheduledStart: new Date(scheduledStart),
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        _id: { $ne: excludeAppointmentId },
      }).lean();
      if (!clashing) return match;
    }
    throw new AppError('This slot has just been booked by someone else. Please choose another.', 409, {
      code: 'SLOT_UNAVAILABLE',
    });
  }

  return match;
};
