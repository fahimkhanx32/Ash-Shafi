import mongoose from 'mongoose';

import { DoctorSchedule } from '../models/doctor-schedule.model.js';
import { BlockedDate } from '../models/blocked-date.model.js';
import { getStaffProfileByUserId } from '../../staff/services/staff.service.js';
import { normalizeToDayStart } from '../utils/date.util.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-10.1 — Doctor Schedules, BET-10.2 — Doctor Availability
 * (template management only; the actual availability *calculation*
 * is `availability.service.js`), BET-10.7 — Holidays & Blocked
 * Dates.
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const assertIsActiveDoctor = async (doctorUserId) => {
  if (!isValidObjectId(doctorUserId)) {
    throw new AppError('Invalid doctor id.', 400, { code: 'INVALID_ID' });
  }
  const staffProfile = await getStaffProfileByUserId(doctorUserId);
  if (staffProfile.designation !== 'DOCTOR') {
    throw new AppError('The specified user is not a doctor.', 400, { code: 'NOT_A_DOCTOR' });
  }
  if (staffProfile.employmentStatus !== 'ACTIVE' || !staffProfile.isActive) {
    throw new AppError('This doctor is not currently active.', 409, { code: 'DOCTOR_INACTIVE' });
  }
  return staffProfile;
};

const findScheduleOrThrow = async (doctorId) => {
  const schedule = await DoctorSchedule.findOne({ doctor: doctorId });
  if (!schedule) {
    throw new AppError('No schedule has been configured for this doctor yet.', 404, {
      code: 'SCHEDULE_NOT_FOUND',
    });
  }
  return schedule;
};

export const getDoctorSchedule = async (doctorId) => findScheduleOrThrow(doctorId);

export const getDoctorScheduleOrNull = async (doctorId) => DoctorSchedule.findOne({ doctor: doctorId });

/**
 * Creates the schedule on first configuration, or replaces the
 * template on subsequent calls (a schedule is a current-state
 * template, not a history — see model docstring; correcting a
 * doctor's hours is expected to happen this way, not via a separate
 * versioned-schedule mechanism which the roadmap doesn't call for).
 */
export const upsertDoctorSchedule = async (doctorId, data, actor) => {
  await assertIsActiveDoctor(doctorId);

  const existing = await DoctorSchedule.findOne({ doctor: doctorId });

  if (existing) {
    Object.assign(existing, data, { updatedBy: actor._id });
    await existing.save();
    logger.info(
      { event: 'doctor_schedule_updated', doctorId: String(doctorId), updatedBy: String(actor._id) },
      'Doctor schedule updated.',
    );
    return existing;
  }

  const schedule = await DoctorSchedule.create({
    ...data,
    doctor: doctorId,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  logger.info(
    { event: 'doctor_schedule_created', doctorId: String(doctorId), createdBy: String(actor._id) },
    'Doctor schedule created.',
  );

  return schedule;
};

export const deactivateDoctorSchedule = async (doctorId, actor) => {
  const schedule = await findScheduleOrThrow(doctorId);
  schedule.isActive = false;
  schedule.updatedBy = actor._id;
  await schedule.save();
  logger.info(
    { event: 'doctor_schedule_deactivated', doctorId: String(doctorId), actor: String(actor._id) },
    'Doctor schedule deactivated.',
  );
  return schedule;
};

// ---------------------------------------------------------------------------
// Holidays & Blocked Dates (BET-10.7)
// ---------------------------------------------------------------------------

export const listBlockedDates = async ({ doctorId, from, to } = {}) => {
  const query = {};
  if (doctorId) {
    // A doctor's effective blocked list includes both their own
    // entries and clinic-wide holidays.
    query.$or = [{ doctor: doctorId }, { doctor: null }];
  }
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = normalizeToDayStart(from);
    if (to) query.date.$lte = normalizeToDayStart(to);
  }
  return BlockedDate.find(query).sort({ date: 1 });
};

export const createBlockedDate = async ({ date, doctorId = null, reason = '', isRecurringYearly = false }, actor) => {
  if (doctorId) {
    await assertIsActiveDoctor(doctorId);
  }

  const normalizedDate = normalizeToDayStart(date);
  if (!normalizedDate) {
    throw new AppError('Invalid date.', 400, { code: 'INVALID_DATE' });
  }

  try {
    const blockedDate = await BlockedDate.create({
      date: normalizedDate,
      doctor: doctorId,
      reason,
      isRecurringYearly,
      createdBy: actor._id,
    });

    logger.info(
      {
        event: 'blocked_date_created',
        date: normalizedDate.toISOString(),
        doctorId: doctorId ? String(doctorId) : 'CLINIC_WIDE',
        actor: String(actor._id),
      },
      'Blocked date / holiday created.',
    );

    return blockedDate;
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('This date is already blocked for this doctor (or clinic-wide).', 409, {
        code: 'BLOCKED_DATE_EXISTS',
      });
    }
    throw error;
  }
};

export const removeBlockedDate = async (id, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid blocked date id.', 400, { code: 'INVALID_ID' });
  }
  const blockedDate = await BlockedDate.findById(id);
  if (!blockedDate) {
    throw new AppError('Blocked date not found.', 404, { code: 'BLOCKED_DATE_NOT_FOUND' });
  }
  await blockedDate.deleteOne();

  logger.info(
    { event: 'blocked_date_removed', blockedDateId: String(id), actor: String(actor._id) },
    'Blocked date / holiday removed.',
  );

  return { removed: true };
};

/**
 * Whether `date` is blocked for `doctorId` — either a doctor-specific
 * entry, or a clinic-wide holiday (`doctor: null`), including
 * yearly-recurring holidays matched on month+day only.
 */
export const isDateBlocked = async (doctorId, date) => {
  const normalizedDate = normalizeToDayStart(date);
  const month = normalizedDate.getUTCMonth();
  const day = normalizedDate.getUTCDate();

  const candidates = await BlockedDate.find({
    $or: [{ doctor: doctorId }, { doctor: null }],
  }).lean();

  return candidates.some((entry) => {
    if (entry.isRecurringYearly) {
      const entryDate = new Date(entry.date);
      return entryDate.getUTCMonth() === month && entryDate.getUTCDate() === day;
    }
    return normalizeToDayStart(entry.date).getTime() === normalizedDate.getTime();
  });
};
