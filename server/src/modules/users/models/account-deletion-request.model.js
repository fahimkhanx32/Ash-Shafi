import mongoose from 'mongoose';

/**
 * BET-17 Checkpoint 3 — Account Lifecycle: deletion-request workflow.
 *
 * Master prompt section 38 ("Patient Account Deletion") is explicit
 * that a deletion request must NEVER blindly, physically delete
 * medical history:
 *
 *   Patient requests deletion
 *     -> Deletion request recorded
 *     -> Account deactivation/anonymization according to policy
 *     -> Required medical records retained per retention requirements
 *     -> Audit trail retained
 *
 * This model is the "request recorded" step and its own lifecycle —
 * it is deliberately a narrow, purpose-built collection with an
 * immutable, append-only `history` array, matching every other
 * state-machine model already established in this project
 * (`Appointment`, `QueueEntry`, `VideoSession`): the state machine
 * itself lives in the service layer
 * (`modules/users/services/account-deletion.service.js`), never
 * here.
 *
 * This record is intentionally kept even after processing — it *is*
 * the audit trail master prompt §38 requires ("Audit trail
 * retained"), independent of (and in addition to) the general
 * `AuditLog` entries BET-17 Checkpoint 1/2 already write for the
 * same actions.
 */

export const ACCOUNT_DELETION_REQUEST_STATUSES = [
  'PENDING',
  'CANCELLED',
  'APPROVED',
  'REJECTED',
];

export const ACCOUNT_DELETION_REQUEST_METHODS = [
  // The account owner requested their own deletion (master prompt
  // §38's primary flow).
  'SELF_SERVICE',
  // An administrator/owner-tier actor initiated it on the account
  // holder's behalf (e.g. a written/offline request) — still goes
  // through the same recorded-request -> review -> processing
  // workflow rather than an immediate direct action, per master
  // prompt §81 ("No Destructive Changes") and §10-style
  // explicit-operation discipline.
  'ADMIN_INITIATED',
];

const historyEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ACCOUNT_DELETION_REQUEST_STATUSES,
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorRole: { type: String, default: null },
    notes: { type: String, default: null, maxlength: 1000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const accountDeletionRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    method: {
      type: String,
      enum: ACCOUNT_DELETION_REQUEST_METHODS,
      required: true,
    },

    reason: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: ACCOUNT_DELETION_REQUEST_STATUSES,
      required: true,
      default: 'PENDING',
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    processingNotes: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    // Set only once a request is APPROVED and the account has
    // actually been anonymized (master prompt §38's "deactivation/
    // anonymization" step). Kept separate from `processedAt` so a
    // REJECTED request's `processedAt` never implies anonymization
    // happened.
    anonymizedAt: {
      type: Date,
      default: null,
    },

    // Immutable, append-only — never edited or removed, matching the
    // established `Appointment`/`QueueEntry`/`VideoSession` history
    // convention. This is the record-level audit trail master prompt
    // §38 requires to be retained.
    history: {
      type: [historyEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// A user may have at most one PENDING request at a time — enforced
// at the database level (defense in depth behind the service-layer
// check) via a partial unique index rather than a blanket unique
// index on `user` alone, since a user legitimately accumulates
// multiple CANCELLED/APPROVED/REJECTED requests over time.
accountDeletionRequestSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING' },
  },
);

accountDeletionRequestSchema.index({ status: 1, requestedAt: -1 });
// Non-unique lookup index on `user` (replaces the former inline `index: true`,
// which collided with the partial-unique { user: 1 } index above — same key
// pattern, different options).
accountDeletionRequestSchema.index({ user: 1, status: 1 });

export const AccountDeletionRequest = mongoose.model(
  'AccountDeletionRequest',
  accountDeletionRequestSchema,
  'account_deletion_requests',
);
