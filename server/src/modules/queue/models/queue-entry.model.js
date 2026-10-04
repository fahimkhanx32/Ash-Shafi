import mongoose from 'mongoose';

/**
 * BET-10.10 — BET-10.17 — Queue Management, Token Generation,
 * Check-in, Waiting/Queue Position, Consultation State, Completed
 * State, No-show Management.
 *
 * One `QueueEntry` = one patient's place in one doctor's queue on
 * one calendar day. `queueDate` scopes `tokenNumber` uniqueness per
 * doctor-per-day, which is what gives BET-10.11's "daily queue
 * reset" for free — token 1 on Tuesday and token 1 on Wednesday are
 * different documents, no explicit reset job needed.
 *
 * Always created from a checked-in `Appointment` (BET-10.17
 * "Convert booked appointment into queue entry") — `appointment` is
 * required and unique per day, so a single appointment can never
 * produce two queue entries. Queue *position* (BET-10.13) is
 * deliberately not a stored field — it is always derived at read
 * time in `queue.service.js` from `tokenNumber` order among WAITING
 * entries, so it can never drift out of sync with reality the way a
 * cached counter could.
 */

export const QUEUE_STATUSES = Object.freeze([
  'WAITING',
  'CALLED',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 60 },
    fromStatus: { type: String, enum: [...QUEUE_STATUSES, null], default: null },
    toStatus: { type: String, enum: QUEUE_STATUSES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const queueEntrySchema = new mongoose.Schema(
  {
    queueDate: { type: Date, required: true, index: true }, // normalized UTC midnight

    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    tokenNumber: { type: Number, required: true, min: 1 },

    status: { type: String, enum: QUEUE_STATUSES, default: 'WAITING', index: true },

    checkedInAt: { type: Date, default: () => new Date() },
    calledAt: { type: Date, default: null },
    consultationStartedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    noShowAt: { type: Date, default: null },

    notes: { type: String, trim: true, maxlength: 500, default: '' },

    history: { type: [historyEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

// One queue entry per appointment, ever — check-in is not repeatable.
queueEntrySchema.index({ appointment: 1 }, { unique: true });

// Token numbers are unique per doctor-per-day (the "daily reset").
queueEntrySchema.index({ doctor: 1, queueDate: 1, tokenNumber: 1 }, { unique: true });

// Primary read pattern: "today's queue for doctor X, in token order".
queueEntrySchema.index({ doctor: 1, queueDate: 1, status: 1, tokenNumber: 1 });

export const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema, 'queue_entries');
