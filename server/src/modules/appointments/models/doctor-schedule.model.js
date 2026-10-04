import mongoose from 'mongoose';

/**
 * BET-10.1/10.2 — Doctor Schedules & Availability.
 *
 * One `DoctorSchedule` per doctor (`user`, unique index) — a
 * recurring weekly template, not a per-date collection of slots.
 * Concrete available slots (BET-10.3) are always *computed* on
 * demand from this template plus `BlockedDate` (BET-10.7) plus
 * existing `Appointment` documents (BET-10.4) — see
 * `services/availability.service.js`. Nothing here is a persisted
 * slot, so changing a doctor's hours never requires migrating
 * already-generated slot documents (master prompt §81 — no
 * destructive migrations needed for a schedule change).
 *
 * `weeklyAvailability` holds one entry per day of week (0=Sunday..
 * 6=Saturday, matching `Date#getDay()`), each with zero or more
 * time blocks (so a doctor can have a morning block and a separate
 * evening block on the same day) and a slot duration used to divide
 * those blocks into bookable slots.
 */

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:mm", 24-hour

const scheduleBlockSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true, match: timePattern },
    endTime: { type: String, required: true, match: timePattern },
  },
  { _id: true },
);

const dayAvailabilitySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isActive: { type: Boolean, default: false },
    blocks: { type: [scheduleBlockSchema], default: [] },
  },
  { _id: false },
);

export const CONSULTATION_MODES = Object.freeze(['PHYSICAL', 'ONLINE']);

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // One entry per day of week, always present (seeded inactive by
    // default) so consumers never have to guard against a missing day.
    weeklyAvailability: {
      type: [dayAvailabilitySchema],
      default: () => [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, isActive: false, blocks: [] })),
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 7,
        message: 'weeklyAvailability must contain exactly 7 entries (one per day of week).',
      },
    },

    slotDurationMinutes: { type: Number, min: 5, max: 240, default: 15 },
    bufferMinutes: { type: Number, min: 0, max: 120, default: 0 },

    consultationModes: {
      type: [String],
      enum: CONSULTATION_MODES,
      default: ['PHYSICAL'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one consultation mode must be enabled.',
      },
    },

    // Minimum lead time before a slot can be booked (prevents booking
    // a slot 2 minutes from now) and the furthest a patient can book
    // ahead — both configurable per doctor.
    minBookingLeadMinutes: { type: Number, min: 0, max: 10080, default: 60 },
    maxBookingHorizonDays: { type: Number, min: 1, max: 365, default: 60 },

    timezone: { type: String, trim: true, default: 'Asia/Dhaka' },

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

doctorScheduleSchema.pre('validate', function validateBlocks(next) {
  for (const day of this.weeklyAvailability || []) {
    for (const block of day.blocks || []) {
      if (block.startTime >= block.endTime) {
        return next(new Error(`Invalid time block on day ${day.dayOfWeek}: startTime must be before endTime.`));
      }
    }
  }
  return next();
});

export const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema, 'doctor_schedules');
