import mongoose from 'mongoose';

/**
 * BET-10.4 — BET-10.9 — Appointment booking, cancellation,
 * rescheduling, states and history.
 *
 * Master prompt §50/§84 — appointment history must never be
 * silently destroyed. `status` transitions forward through a fixed
 * state machine (enforced in `appointment.service.js`, not here —
 * the model stays a plain data container per this project's
 * established convention, see `encounter.model.js`), and every
 * transition is appended to the immutable `history` array rather
 * than overwriting anything (BET-10.9 "Appointment History").
 *
 * Rescheduling never mutates a booked slot in place: it creates a
 * brand-new `Appointment` document and links the two via
 * `rescheduledFrom`/`rescheduledTo`, so the original booking's
 * history is preserved exactly as it happened (BET-10.6).
 */

export const APPOINTMENT_STATUSES = Object.freeze([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
  'NO_SHOW',
]);

export const APPOINTMENT_VISIT_TYPES = Object.freeze(['NEW', 'FOLLOW_UP']);
export const APPOINTMENT_CONSULTATION_MODES = Object.freeze(['PHYSICAL', 'ONLINE']);

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 60 },
    fromStatus: { type: String, enum: [...APPOINTMENT_STATUSES, null], default: null },
    toStatus: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const appointmentSchema = new mongoose.Schema(
  {
    // Human-friendly booking reference — distinct from `_id`, for
    // display on confirmations/printouts. Same pattern as
    // `PatientProfile.patientId` / `StaffProfile.employeeId`.
    appointmentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    visitType: { type: String, enum: APPOINTMENT_VISIT_TYPES, default: 'NEW' },
    consultationMode: { type: String, enum: APPOINTMENT_CONSULTATION_MODES, default: 'PHYSICAL' },

    // Normalized UTC midnight for the calendar day (query convenience);
    // the actual bookable moment is `scheduledStart`/`scheduledEnd`.
    appointmentDate: { type: Date, required: true, index: true },
    scheduledStart: { type: Date, required: true, index: true },
    scheduledEnd: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 240 },

    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'SCHEDULED', index: true },

    reasonForVisit: { type: String, trim: true, maxlength: 500, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },

    // Rescheduling links (BET-10.6) — both sides preserved, never
    // overwritten.
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    rescheduledTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

    cancellationReason: { type: String, trim: true, maxlength: 500, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },

    confirmedAt: { type: Date, default: null },
    checkedInAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    noShowAt: { type: Date, default: null },

    // Set once the appointment is checked in and a queue token is
    // issued (BET-10.17 appointment-to-queue workflow). Kept as a
    // forward reference here; `modules/queue` owns the actual
    // `QueueEntry` document and is the only writer of this field.
    queueEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueEntry', default: null },

    // Forward-looking only — populated once BET-09's Encounter is
    // linked back from the consultation, and BET-11/12 exist.
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter', default: null },

    // BET-14 — set once a `VideoSession` is created for this
    // appointment (only ever relevant when `consultationMode` is
    // `ONLINE`). Purely a forward reference for convenience —
    // `modules/video-calls` remains the sole writer of this field and
    // the sole owner of the `VideoSession` document itself, the same
    // one-way-reference convention `queueEntry` above already
    // established for `modules/queue`. Deliberately additive: no
    // existing field, index, or validation on this schema was
    // touched to add it.
    videoSession: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoSession', default: null },

    history: { type: [historyEntrySchema], default: [] },

    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

appointmentSchema.index({ doctor: 1, appointmentDate: 1, status: 1 });
appointmentSchema.index({ patientProfile: 1, appointmentDate: -1 });
appointmentSchema.index({ patient: 1, appointmentDate: -1 });

// Prevents two *active* appointments from occupying the exact same
// doctor+slot start at the database level, as defense-in-depth
// behind the service-layer overlap check (BET-10.4 "Validate doctor
// availability" / master prompt §80 — never rely on a single layer
// of protection). CANCELLED/RESCHEDULED/NO_SHOW appointments are
// excluded so a freed slot can be rebooked.
appointmentSchema.index(
  { doctor: 1, scheduledStart: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
    },
  },
);

export const Appointment = mongoose.model('Appointment', appointmentSchema, 'appointments');
