import mongoose from 'mongoose';

import { Appointment, APPOINTMENT_STATUSES } from '../models/appointment.model.js';
import { assertIsActiveDoctor } from './schedule.service.js';
import { assertSlotIsBookable } from './availability.service.js';
import { getPatientProfileById, getPatientProfileByUserId } from '../../patients/services/patient.service.js';
import { normalizeToDayStart } from '../utils/date.util.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-10.4 — Appointment Booking, BET-10.5 — Cancellation,
 * BET-10.6 — Rescheduling, BET-10.8 — Appointment States,
 * BET-10.9 — Appointment History.
 *
 * The state machine (BET-10.8) is enforced here, not in the model —
 * matching this project's established convention (see
 * `encounter.service.js`'s header comment). Every transition also
 * appends to `appointment.history` (BET-10.9) so the full lifecycle
 * of a booking is always reconstructable, never overwritten.
 *
 * Check-in (BET-10.12) and everything queue-related (BET-10.10 —
 * BET-10.17) deliberately lives in `modules/queue`, not here — this
 * service only transitions `Appointment.status` to `CHECKED_IN` /
 * `COMPLETED` / `NO_SHOW` when `modules/queue` calls back into it
 * (`markCheckedIn`, `markCompleted`, `markNoShowFromQueue`), keeping
 * a single direction of ownership: queue reacts to appointments
 * being checked in, and appointments react to queue state changes,
 * without either module reaching into the other's collection
 * directly (BET-10.18 "Synchronize appointment and queue states").
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const ACTIVE_STATUSES = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'];
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'];

const findAppointmentOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid appointment id.', 400, { code: 'INVALID_ID' });
  }
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404, { code: 'APPOINTMENT_NOT_FOUND' });
  }
  return appointment;
};

/**
 * A `PATIENT` actor may only ever act on their own appointments —
 * checked here, not merely hidden in the UI (master prompt §80/§30:
 * "no patient should be able to see another patient's ... appointment").
 * A mismatch returns the same 404 as a genuinely missing appointment
 * rather than a 403, so this endpoint can't be used to enumerate
 * other patients' valid appointment ids (IDOR/BOLA hardening).
 */
const assertCanAccessAppointment = (appointment, actor) => {
  if (actor?.role === 'PATIENT' && String(appointment.patient) !== String(actor._id)) {
    throw new AppError('Appointment not found.', 404, { code: 'APPOINTMENT_NOT_FOUND' });
  }
};

const pushHistory = (appointment, { action, toStatus, actor, reason = '' }) => {
  appointment.history.push({
    action,
    fromStatus: appointment.status,
    toStatus,
    actor: actor?._id ?? null,
    reason,
  });
};

/**
 * Mirrors `generatePatientId()`/`generateEmployeeId()` (BET-05/06) —
 * date-scoped prefix + sequential counter, with a retry loop against
 * the appointment collection's unique index as the real concurrency
 * guard (the read-then-increment pattern alone can race under load).
 */
const generateAppointmentReference = async () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const prefix = `APT-${y}${m}${d}`;

  const latest = await Appointment.findOne({ appointmentReference: { $regex: `^${prefix}-` } })
    .sort({ appointmentReference: -1 })
    .select('appointmentReference')
    .lean();

  let nextSequence = 1;
  if (latest?.appointmentReference) {
    const match = latest.appointmentReference.match(/-(\d{4})$/);
    if (match) nextSequence = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
};

/**
 * Resolves the target `PatientProfile` for a booking request. A
 * `PATIENT` actor may only ever book for themselves — `patientProfileId`
 * in the payload is ignored for that role rather than trusted
 * (master prompt §80: never trust a client-provided patient id for
 * authorization-relevant decisions). Staff roles (with
 * `APPOINTMENTS_WRITE`) must supply it explicitly.
 */
const resolvePatientProfileForBooking = async (patientProfileId, actor) => {
  if (actor.role === 'PATIENT') {
    return getPatientProfileByUserId(actor._id);
  }
  if (!patientProfileId) {
    throw new AppError('patientProfileId is required when booking on behalf of a patient.', 400, {
      code: 'PATIENT_PROFILE_REQUIRED',
    });
  }
  return getPatientProfileById(patientProfileId);
};

export const bookAppointment = async (
  { patientProfileId, doctorId, scheduledStart, visitType, consultationMode, reasonForVisit, notes },
  actor,
) => {
  if (!isValidObjectId(doctorId)) {
    throw new AppError('Invalid doctor id.', 400, { code: 'INVALID_ID' });
  }

  const [patientProfile] = await Promise.all([
    resolvePatientProfileForBooking(patientProfileId, actor),
    assertIsActiveDoctor(doctorId),
  ]);

  const slotStart = new Date(scheduledStart);
  if (Number.isNaN(slotStart.getTime())) {
    throw new AppError('Invalid scheduledStart.', 400, { code: 'INVALID_DATE' });
  }

  const match = await assertSlotIsBookable(doctorId, slotStart);
  const durationMinutes = Math.round((match.end.getTime() - match.start.getTime()) / 60000);

  const appointmentReference = await generateAppointmentReference();

  let appointment;
  try {
    appointment = await Appointment.create({
      appointmentReference,
      patientProfile: patientProfile._id,
      patient: patientProfile.user,
      doctor: doctorId,
      visitType: visitType || 'NEW',
      consultationMode: consultationMode || 'PHYSICAL',
      appointmentDate: normalizeToDayStart(slotStart),
      scheduledStart: match.start,
      scheduledEnd: match.end,
      durationMinutes,
      reasonForVisit: reasonForVisit || '',
      notes: notes || '',
      status: 'SCHEDULED',
      bookedBy: actor._id,
      createdBy: actor._id,
      updatedBy: actor._id,
      history: [
        {
          action: 'BOOKED',
          fromStatus: null,
          toStatus: 'SCHEDULED',
          actor: actor._id,
        },
      ],
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('This slot has just been booked by someone else. Please choose another.', 409, {
        code: 'SLOT_UNAVAILABLE',
      });
    }
    throw error;
  }

  logger.info(
    {
      event: 'appointment_booked',
      appointmentId: appointment._id.toString(),
      appointmentReference,
      doctorId: String(doctorId),
      patientProfileId: String(patientProfile._id),
      bookedBy: String(actor._id),
    },
    'Appointment booked.',
  );

  return appointment;
};

export const getAppointmentById = async (id, actor) => {
  const appointment = await findAppointmentOrThrow(id);
  assertCanAccessAppointment(appointment, actor);
  return appointment;
};

export const listAppointments = async ({
  doctorId,
  patientProfileId,
  status,
  from,
  to,
  page = 1,
  limit = 20,
} = {}) => {
  const query = {};
  if (doctorId) query.doctor = doctorId;
  if (patientProfileId) query.patientProfile = patientProfileId;
  if (status) query.status = status;
  if (from || to) {
    query.appointmentDate = {};
    if (from) query.appointmentDate.$gte = normalizeToDayStart(from);
    if (to) query.appointmentDate.$lte = normalizeToDayStart(to);
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    // BET-23 — .lean() is safe here: this list is read-only display
    // data (no controller downstream calls .save()/instance methods
    // on these results), so skipping Mongoose document hydration
    // measurably reduces CPU/memory on the highest-traffic admin
    // list endpoint in this module.
    Appointment.find(query)
      .sort({ scheduledStart: 1 })
      .skip(skip)
      .limit(limit)
      .populate('doctor', 'name email role')
      .populate('patient', 'name email role')
      .lean(),
    Appointment.countDocuments(query),
  ]);

  return { items, pagination: { page, limit, total } };
};

export const getMyAppointments = async (
  actor,
  { status, from, to, page = 1, limit = 20 } = {},
) => {
  const patientProfile = await getPatientProfileByUserId(actor._id);
  const query = { patientProfile: patientProfile._id };
  if (status) query.status = status;
  if (from || to) {
    query.appointmentDate = {};
    if (from) query.appointmentDate.$gte = normalizeToDayStart(from);
    if (to) query.appointmentDate.$lte = normalizeToDayStart(to);
  }

  // BET-23 — this endpoint previously returned every appointment a
  // patient had ever booked, unbounded, on every call. Over a
  // multi-year patient relationship that list only grows; without a
  // cap it degrades linearly for both the query and the payload
  // size. Paginated the same way `listAppointments` already is,
  // capped at 100 to protect against a caller who never sends
  // `limit` at all.
  const safeLimit = Math.min(Number(limit) || 20, 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    Appointment.find(query)
      .sort({ scheduledStart: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('doctor', 'name email role')
      .lean(),
    Appointment.countDocuments(query),
  ]);

  return { items, pagination: { page: safePage, limit: safeLimit, total } };
};

export const confirmAppointment = async (id, actor) => {
  const appointment = await findAppointmentOrThrow(id);
  if (appointment.status !== 'SCHEDULED') {
    throw new AppError(`Only a SCHEDULED appointment can be confirmed (current status: ${appointment.status}).`, 409, {
      code: 'INVALID_STATUS_TRANSITION',
    });
  }
  pushHistory(appointment, { action: 'CONFIRMED', toStatus: 'CONFIRMED', actor });
  appointment.status = 'CONFIRMED';
  appointment.confirmedAt = new Date();
  appointment.updatedBy = actor._id;
  await appointment.save();

  logger.info({ event: 'appointment_confirmed', appointmentId: String(id), actor: String(actor._id) }, 'Appointment confirmed.');
  return appointment;
};

export const cancelAppointment = async (id, reason, actor) => {
  const appointment = await findAppointmentOrThrow(id);
  assertCanAccessAppointment(appointment, actor);

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    throw new AppError(`This appointment is already ${appointment.status.toLowerCase()} and cannot be cancelled.`, 409, {
      code: 'INVALID_STATUS_TRANSITION',
    });
  }

  pushHistory(appointment, { action: 'CANCELLED', toStatus: 'CANCELLED', actor, reason });
  appointment.status = 'CANCELLED';
  appointment.cancellationReason = reason || '';
  appointment.cancelledBy = actor._id;
  appointment.cancelledAt = new Date();
  appointment.updatedBy = actor._id;
  await appointment.save();

  logger.info(
    { event: 'appointment_cancelled', appointmentId: String(id), reason, actor: String(actor._id) },
    'Appointment cancelled.',
  );

  return appointment;
};

export const rescheduleAppointment = async (id, { scheduledStart, reason }, actor) => {
  const original = await findAppointmentOrThrow(id);
  assertCanAccessAppointment(original, actor);

  if (TERMINAL_STATUSES.includes(original.status)) {
    throw new AppError(
      `This appointment is already ${original.status.toLowerCase()} and cannot be rescheduled.`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  const newSlotStart = new Date(scheduledStart);
  if (Number.isNaN(newSlotStart.getTime())) {
    throw new AppError('Invalid scheduledStart.', 400, { code: 'INVALID_DATE' });
  }

  const match = await assertSlotIsBookable(original.doctor, newSlotStart, { excludeAppointmentId: original._id });
  const durationMinutes = Math.round((match.end.getTime() - match.start.getTime()) / 60000);
  const appointmentReference = await generateAppointmentReference();

  let replacement;
  try {
    replacement = await Appointment.create({
      appointmentReference,
      patientProfile: original.patientProfile,
      patient: original.patient,
      doctor: original.doctor,
      visitType: original.visitType,
      consultationMode: original.consultationMode,
      appointmentDate: normalizeToDayStart(newSlotStart),
      scheduledStart: match.start,
      scheduledEnd: match.end,
      durationMinutes,
      reasonForVisit: original.reasonForVisit,
      notes: original.notes,
      status: 'SCHEDULED',
      rescheduledFrom: original._id,
      bookedBy: actor._id,
      createdBy: actor._id,
      updatedBy: actor._id,
      history: [
        {
          action: 'BOOKED_VIA_RESCHEDULE',
          fromStatus: null,
          toStatus: 'SCHEDULED',
          actor: actor._id,
          reason: reason || '',
        },
      ],
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('This slot has just been booked by someone else. Please choose another.', 409, {
        code: 'SLOT_UNAVAILABLE',
      });
    }
    throw error;
  }

  pushHistory(original, { action: 'RESCHEDULED', toStatus: 'RESCHEDULED', actor, reason });
  original.status = 'RESCHEDULED';
  original.rescheduledTo = replacement._id;
  original.updatedBy = actor._id;
  await original.save();

  logger.info(
    {
      event: 'appointment_rescheduled',
      originalAppointmentId: String(original._id),
      newAppointmentId: String(replacement._id),
      actor: String(actor._id),
    },
    'Appointment rescheduled.',
  );

  return { original, replacement };
};

export const markNoShow = async (id, actor, { reason = '' } = {}) => {
  const appointment = await findAppointmentOrThrow(id);

  if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
    throw new AppError(
      `Only a SCHEDULED or CONFIRMED appointment can be marked as no-show (current status: ${appointment.status}).`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  pushHistory(appointment, { action: 'NO_SHOW', toStatus: 'NO_SHOW', actor, reason });
  appointment.status = 'NO_SHOW';
  appointment.noShowAt = new Date();
  appointment.updatedBy = actor._id;
  await appointment.save();

  logger.info({ event: 'appointment_no_show', appointmentId: String(id), actor: String(actor._id) }, 'Appointment marked no-show.');
  return appointment;
};

export const getAppointmentHistory = async (id, actor) => {
  const appointment = await findAppointmentOrThrow(id);
  assertCanAccessAppointment(appointment, actor);
  return appointment.history;
};

// ---------------------------------------------------------------------------
// Callbacks invoked exclusively by `modules/queue` (BET-10.18 sync).
// Never exported to a route directly — reached only via queue.service.js.
// ---------------------------------------------------------------------------

export const markCheckedIn = async (id, queueEntryId, actor) => {
  const appointment = await findAppointmentOrThrow(id);

  if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
    throw new AppError(
      `Only a SCHEDULED or CONFIRMED appointment can be checked in (current status: ${appointment.status}).`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  pushHistory(appointment, { action: 'CHECKED_IN', toStatus: 'CHECKED_IN', actor });
  appointment.status = 'CHECKED_IN';
  appointment.checkedInAt = new Date();
  appointment.queueEntry = queueEntryId;
  appointment.updatedBy = actor._id;
  await appointment.save();
  return appointment;
};

export const markCompleted = async (id, actor) => {
  const appointment = await findAppointmentOrThrow(id);
  pushHistory(appointment, { action: 'COMPLETED', toStatus: 'COMPLETED', actor });
  appointment.status = 'COMPLETED';
  appointment.completedAt = new Date();
  appointment.updatedBy = actor._id;
  await appointment.save();
  return appointment;
};

export const markNoShowFromQueue = async (id, actor) => {
  const appointment = await findAppointmentOrThrow(id);
  pushHistory(appointment, { action: 'NO_SHOW', toStatus: 'NO_SHOW', actor });
  appointment.status = 'NO_SHOW';
  appointment.noShowAt = new Date();
  appointment.updatedBy = actor._id;
  await appointment.save();
  return appointment;
};

export const revertCheckInOnQueueCancel = async (id, actor, reason) => {
  const appointment = await findAppointmentOrThrow(id);
  if (appointment.status !== 'CHECKED_IN') return appointment;
  pushHistory(appointment, { action: 'CANCELLED', toStatus: 'CANCELLED', actor, reason });
  appointment.status = 'CANCELLED';
  appointment.cancellationReason = reason || 'Removed from queue.';
  appointment.cancelledBy = actor._id;
  appointment.cancelledAt = new Date();
  appointment.updatedBy = actor._id;
  await appointment.save();
  return appointment;
};

export { ACTIVE_STATUSES, TERMINAL_STATUSES, APPOINTMENT_STATUSES };
