import {
  listAppointments,
  bookAppointment,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
} from '../../appointments/services/appointment.service.js';
import { getAvailableSlots } from '../../appointments/services/availability.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';

/**
 * Mirrors `appointment.routes.js`'s own `staffOnly` gate (applied
 * there to the list and confirm routes) — a PATIENT-role caller must
 * not reach those two operations through the voice path either.
 */
const assertStaff = (actor) => {
  if (actor.role === 'PATIENT') {
    throw new AppError('This action is restricted to clinic staff.', 403, { code: 'PATIENT_ACTION_FORBIDDEN' });
  }
};

const summarizeAppointment = (a) => ({
  appointmentId: String(a._id),
  reference: a.appointmentReference,
  status: a.status,
  scheduledStart: a.scheduledStart,
  scheduledEnd: a.scheduledEnd,
  doctorName: a.doctor?.name || '',
  reasonForVisit: a.reasonForVisit || '',
});

const formatWhen = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * `search_appointments` — master prompt §21. Same `listAppointments`
 * the admin list endpoint uses. A DOCTOR caller who doesn't name a
 * doctor gets their own schedule by default (what "today's
 * appointments" means when a doctor says it); other roles see what
 * they filter for, exactly as the REST list allows.
 */
export const searchAppointmentsTool = async ({ limit = 10, doctorId, ...filters }, actor) => {
  assertStaff(actor);
  const { items } = await listAppointments({
    ...filters,
    doctorId: doctorId || (actor.role === 'DOCTOR' ? actor._id : undefined),
    page: 1,
    limit,
  });

  return {
    success: true,
    action: 'search_appointments',
    message: items.length === 0 ? 'No appointments found.' : `Found ${items.length} appointment(s).`,
    results: items.map(summarizeAppointment),
  };
};

/**
 * `get_available_slots` — lets the agent verify availability before
 * proposing a booking (master prompt §21: "do not blindly create
 * conflicting appointments"). Reuses the same function
 * `assertSlotIsBookable` calls at booking time, so what the agent
 * reads out and what booking will accept cannot drift apart.
 */
export const getAvailableSlotsTool = async ({ doctorId, date }) => {
  const { slots, reason } = await getAvailableSlots(doctorId, date);
  const open = slots.filter((s) => s.available).map((s) => ({ start: s.start, end: s.end }));

  return {
    success: true,
    action: 'get_available_slots',
    message: open.length === 0 ? `No open slots on that day${reason ? ` (${reason})` : ''}.` : `${open.length} open slot(s).`,
    slots: open,
    reason,
  };
};

export const bookAppointmentTool = async ({ patientProfileId, doctorId, scheduledStart, reasonForVisit }, actor) => {
  const appointment = await bookAppointment({ patientProfileId, doctorId, scheduledStart, reasonForVisit }, actor);
  return {
    success: true,
    action: 'book_appointment',
    message: `Appointment booked for ${formatWhen(appointment.scheduledStart)}.`,
    appointment: summarizeAppointment(appointment),
  };
};

export const confirmAppointmentTool = async ({ appointmentId }, actor) => {
  assertStaff(actor);
  const appointment = await confirmAppointment(appointmentId, actor);
  return {
    success: true,
    action: 'confirm_appointment',
    message: 'Appointment confirmed.',
    appointment: summarizeAppointment(appointment),
  };
};

export const rescheduleAppointmentTool = async ({ appointmentId, scheduledStart, reason = '' }, actor) => {
  // The real service returns `{ original, replacement }` — the old
  // booking is marked RESCHEDULED and a new SCHEDULED one is created.
  const { replacement } = await rescheduleAppointment(appointmentId, { scheduledStart, reason }, actor);
  return {
    success: true,
    action: 'reschedule_appointment',
    message: `Appointment moved to ${formatWhen(replacement.scheduledStart)}.`,
    appointment: summarizeAppointment(replacement),
  };
};

export const cancelAppointmentTool = async ({ appointmentId, reason = '' }, actor) => {
  const appointment = await cancelAppointment(appointmentId, reason, actor);
  return {
    success: true,
    action: 'cancel_appointment',
    message: 'Appointment cancelled.',
    appointment: summarizeAppointment(appointment),
  };
};
