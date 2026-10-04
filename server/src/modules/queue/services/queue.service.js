import mongoose from 'mongoose';

import { QueueEntry } from '../models/queue-entry.model.js';
import { Appointment } from '../../appointments/models/appointment.model.js';
import * as appointmentService from '../../appointments/services/appointment.service.js';
import { normalizeToDayStart, isSameDay } from '../../appointments/utils/date.util.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-10.10 — Queue Management, BET-10.11 — Token Generation,
 * BET-10.12 — Patient Check-in, BET-10.13 — Waiting & Queue
 * Position, BET-10.14 — Consultation State, BET-10.15 — Completed
 * State, BET-10.16 — No-show Management, BET-10.17 — Appointment-
 * to-Queue Workflow, BET-10.18 — Queue & Appointment Integration.
 *
 * State machine: WAITING -> CALLED -> IN_CONSULTATION -> COMPLETED,
 * with CANCELLED/NO_SHOW reachable from WAITING/CALLED. Every
 * transition is enforced here (never trusted from the client) and
 * appended to `QueueEntry.history`, mirroring
 * `appointment.service.js`'s pattern exactly.
 *
 * BET-10.18's "prevent inconsistent statuses" is implemented by this
 * module being the *only* writer of `Appointment.status` transitions
 * that originate from queue activity — it calls the dedicated
 * `appointmentService.markCheckedIn/markCompleted/markNoShowFromQueue`
 * functions instead of touching the `Appointment` document's status
 * field directly, so the two collections can never independently
 * drift (queue lifecycle is the single source of truth for
 * check-in-onward appointment status).
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findQueueEntryOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid queue entry id.', 400, { code: 'INVALID_ID' });
  }
  const entry = await QueueEntry.findById(id);
  if (!entry) {
    throw new AppError('Queue entry not found.', 404, { code: 'QUEUE_ENTRY_NOT_FOUND' });
  }
  return entry;
};

const pushHistory = (entry, { action, toStatus, actor, reason = '' }) => {
  entry.history.push({
    action,
    fromStatus: entry.status,
    toStatus,
    actor: actor?._id ?? null,
    reason,
  });
};

/**
 * Sequential token per doctor-per-day, generated the same
 * find-highest-then-increment-with-retry way as
 * `generateAppointmentReference()`/`generatePatientId()` — the
 * unique `{doctor, queueDate, tokenNumber}` index is the real
 * concurrency guard; this is just the candidate-value generator.
 */
const generateNextTokenNumber = async (doctorId, queueDate) => {
  const latest = await QueueEntry.findOne({ doctor: doctorId, queueDate })
    .sort({ tokenNumber: -1 })
    .select('tokenNumber')
    .lean();
  return (latest?.tokenNumber ?? 0) + 1;
};

/**
 * BET-10.12 / BET-10.17 — Check a booked appointment into today's
 * queue: validates the appointment is checkable-in, generates a
 * token, creates the `WAITING` queue entry, and transitions the
 * appointment to `CHECKED_IN` via the dedicated callback.
 */
export const checkIn = async (appointmentId, actor, { notes = '' } = {}) => {
  if (!isValidObjectId(appointmentId)) {
    throw new AppError('Invalid appointment id.', 400, { code: 'INVALID_ID' });
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404, { code: 'APPOINTMENT_NOT_FOUND' });
  }

  if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
    throw new AppError(
      `This appointment cannot be checked in (current status: ${appointment.status}).`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  if (!isSameDay(appointment.appointmentDate, new Date())) {
    throw new AppError('Only appointments scheduled for today can be checked in.', 409, {
      code: 'NOT_TODAYS_APPOINTMENT',
    });
  }

  const existing = await QueueEntry.findOne({ appointment: appointment._id });
  if (existing) {
    throw new AppError('This appointment has already been checked in.', 409, {
      code: 'ALREADY_CHECKED_IN',
    });
  }

  const queueDate = normalizeToDayStart(new Date());

  let entry;
  let attempts = 0;
  // Retry on a token-number collision (concurrent check-ins racing
  // for the same next token) — the unique index is the real guard;
  // this loop just makes the generator's read-then-write race safe.
  while (attempts < 5) {
    attempts += 1;
    const tokenNumber = await generateNextTokenNumber(appointment.doctor, queueDate);
    try {
      // eslint-disable-next-line no-await-in-loop
      entry = await QueueEntry.create({
        queueDate,
        doctor: appointment.doctor,
        appointment: appointment._id,
        patientProfile: appointment.patientProfile,
        patient: appointment.patient,
        tokenNumber,
        status: 'WAITING',
        notes,
        createdBy: actor._id,
        updatedBy: actor._id,
        history: [{ action: 'CHECKED_IN', fromStatus: null, toStatus: 'WAITING', actor: actor._id }],
      });
      break;
    } catch (error) {
      if (error?.code === 11000 && attempts < 5) {
        continue; // eslint-disable-line no-continue
      }
      throw error;
    }
  }

  if (!entry) {
    throw new AppError('Could not generate a queue token — please try again.', 500, {
      code: 'TOKEN_GENERATION_FAILED',
    });
  }

  await appointmentService.markCheckedIn(appointment._id, entry._id, actor);

  logger.info(
    {
      event: 'patient_checked_in',
      appointmentId: String(appointment._id),
      queueEntryId: String(entry._id),
      doctorId: String(appointment.doctor),
      tokenNumber: entry.tokenNumber,
      actor: String(actor._id),
    },
    'Patient checked in to queue.',
  );

  return entry;
};

/** BET-10.13 — position among currently-WAITING entries, 1-indexed. */
const computePosition = async (entry) => {
  if (entry.status !== 'WAITING') return null;
  const aheadCount = await QueueEntry.countDocuments({
    doctor: entry.doctor,
    queueDate: entry.queueDate,
    status: 'WAITING',
    tokenNumber: { $lt: entry.tokenNumber },
  });
  return aheadCount + 1;
};

const withPosition = async (entry) => {
  const position = await computePosition(entry);
  const plain = entry.toObject ? entry.toObject() : entry;
  return { ...plain, position };
};

/** BET-10.10 / BET-10.13 — today's full queue for a doctor, token-ordered. */
export const getTodayQueue = async (doctorId, { date } = {}) => {
  const queueDate = normalizeToDayStart(date || new Date());
  const entries = await QueueEntry.find({ doctor: doctorId, queueDate })
    .sort({ tokenNumber: 1 })
    .populate('patient', 'name email role')
    .populate('patientProfile', 'patientId firstName lastName');

  // Single sorted pass computing each WAITING entry's live position —
  // equivalent to, and cheaper than, calling computePosition() per
  // entry individually.
  let waitingIndex = 0;
  return entries.map((entry) => {
    const plain = entry.toObject();
    plain.position = entry.status === 'WAITING' ? (waitingIndex += 1) : null;
    return plain;
  });
};

export const getQueueEntryById = async (id) => withPosition(await findQueueEntryOrThrow(id));

/**
 * FET-12 (Patient Portal) — "Queue status" self-service. Deliberately
 * NOT gated by `staffOnly` (see `queue.routes.js`'s route ordering) —
 * reuses `appointmentService.getAppointmentById`'s existing
 * ownership check (404-not-403 on a mismatch, same IDOR/BOLA
 * hardening every other self-service `/me` endpoint in this project
 * already relies on) rather than duplicating that logic here. Returns
 * `null` (not a 404) when the appointment simply hasn't been checked
 * in yet — "not in the queue" is a normal, expected state for a
 * patient checking their own status, not an error.
 */
export const getMyQueueStatus = async (appointmentId, actor) => {
  await appointmentService.getAppointmentById(appointmentId, actor);
  const entry = await QueueEntry.findOne({ appointment: appointmentId });
  if (!entry) return null;
  return withPosition(entry);
};

/** BET-10.14 — call the next waiting patient. */
export const callPatient = async (id, actor) => {
  const entry = await findQueueEntryOrThrow(id);

  if (entry.status !== 'WAITING') {
    throw new AppError(`Only a WAITING entry can be called (current status: ${entry.status}).`, 409, {
      code: 'INVALID_STATUS_TRANSITION',
    });
  }

  pushHistory(entry, { action: 'CALLED', toStatus: 'CALLED', actor });
  entry.status = 'CALLED';
  entry.calledAt = new Date();
  entry.updatedBy = actor._id;
  await entry.save();

  logger.info({ event: 'queue_patient_called', queueEntryId: String(id), actor: String(actor._id) }, 'Patient called from queue.');
  return entry;
};

/**
 * BET-10.14 — move to IN_CONSULTATION. "Prevent duplicate queue
 * processing": a doctor can only have one entry IN_CONSULTATION at
 * a time, checked explicitly rather than assumed from UI behavior.
 */
export const startConsultation = async (id, actor) => {
  const entry = await findQueueEntryOrThrow(id);

  if (!['WAITING', 'CALLED'].includes(entry.status)) {
    throw new AppError(
      `Only a WAITING or CALLED entry can start consultation (current status: ${entry.status}).`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  const alreadyInConsultation = await QueueEntry.findOne({
    doctor: entry.doctor,
    queueDate: entry.queueDate,
    status: 'IN_CONSULTATION',
    _id: { $ne: entry._id },
  }).lean();

  if (alreadyInConsultation) {
    throw new AppError('This doctor already has a patient in consultation. Complete that visit first.', 409, {
      code: 'CONSULTATION_ALREADY_IN_PROGRESS',
    });
  }

  pushHistory(entry, { action: 'CONSULTATION_STARTED', toStatus: 'IN_CONSULTATION', actor });
  entry.status = 'IN_CONSULTATION';
  entry.consultationStartedAt = new Date();
  entry.updatedBy = actor._id;
  await entry.save();

  logger.info(
    { event: 'queue_consultation_started', queueEntryId: String(id), actor: String(actor._id) },
    'Consultation started for queue entry.',
  );
  return entry;
};

/** BET-10.15 — completes the visit; syncs the appointment to COMPLETED. */
export const completeConsultation = async (id, actor) => {
  const entry = await findQueueEntryOrThrow(id);

  if (entry.status !== 'IN_CONSULTATION') {
    throw new AppError(
      `Only an IN_CONSULTATION entry can be completed (current status: ${entry.status}).`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  pushHistory(entry, { action: 'COMPLETED', toStatus: 'COMPLETED', actor });
  entry.status = 'COMPLETED';
  entry.completedAt = new Date();
  entry.updatedBy = actor._id;
  await entry.save();

  await appointmentService.markCompleted(entry.appointment, actor);

  logger.info(
    { event: 'queue_consultation_completed', queueEntryId: String(id), actor: String(actor._id) },
    'Consultation completed; queue entry and appointment marked COMPLETED.',
  );
  return entry;
};

/** BET-10.16 — no-show handling; removes from active queue. */
export const markNoShow = async (id, actor, { reason = '' } = {}) => {
  const entry = await findQueueEntryOrThrow(id);

  if (!['WAITING', 'CALLED'].includes(entry.status)) {
    throw new AppError(
      `Only a WAITING or CALLED entry can be marked no-show (current status: ${entry.status}).`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  pushHistory(entry, { action: 'NO_SHOW', toStatus: 'NO_SHOW', actor, reason });
  entry.status = 'NO_SHOW';
  entry.noShowAt = new Date();
  entry.updatedBy = actor._id;
  await entry.save();

  await appointmentService.markNoShowFromQueue(entry.appointment, actor);

  logger.info(
    { event: 'queue_patient_no_show', queueEntryId: String(id), actor: String(actor._id), reason },
    'Patient marked no-show; removed from active queue.',
  );
  return entry;
};

/**
 * BET-10.18 — removes a queue entry when its appointment is
 * cancelled/rescheduled after check-in. Called from the appointment
 * side (cancel/reschedule), not exposed as its own patient/staff-
 * facing route — a direct "cancel this queue entry" action for an
 * otherwise-active visit should go through the appointment.
 */
export const cancelForAppointment = async (appointmentId, actor, reason = 'Appointment cancelled.') => {
  const entry = await QueueEntry.findOne({ appointment: appointmentId, status: { $in: ['WAITING', 'CALLED'] } });
  if (!entry) return null;

  pushHistory(entry, { action: 'CANCELLED', toStatus: 'CANCELLED', actor, reason });
  entry.status = 'CANCELLED';
  entry.cancelledAt = new Date();
  entry.updatedBy = actor._id;
  await entry.save();

  logger.info(
    { event: 'queue_entry_cancelled', queueEntryId: String(entry._id), appointmentId: String(appointmentId), reason },
    'Queue entry cancelled following appointment cancellation.',
  );
  return entry;
};
