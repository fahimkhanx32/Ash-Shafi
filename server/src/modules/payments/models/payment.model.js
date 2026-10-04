import mongoose from 'mongoose';

/**
 * BET-15.2 — Payment Provider Abstraction (master prompt §36). A
 * `Payment` is one attempted-or-completed transaction against exactly
 * one `Invoice`. Deliberately never stores card numbers, CVV, bank
 * account numbers, or any other raw payment-instrument data — only
 * the provider's own opaque transaction reference and status, exactly
 * the master prompt §36 "never trust frontend 'payment successful'"
 * boundary: status here is only ever written by
 * `services/payment.service.js` after either (a) a staff member
 * manually confirms a cash/bank-transfer receipt, or (b) a
 * provider webhook is signature-verified — never by a client request
 * body claiming success.
 */
export const PAYMENT_METHODS = Object.freeze([
  'CASH',
  'CARD',
  'MOBILE_FINANCIAL_SERVICE',
  'BANK_TRANSFER',
  'ONLINE_GATEWAY',
]);

export const PAYMENT_STATUSES = Object.freeze([
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 60 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const paymentSchema = new mongoose.Schema(
  {
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'BDT' },

    method: { type: String, enum: PAYMENT_METHODS, required: true },
    // Free-text provider label ('manual', or the configured
    // `env.payment.provider` name at the time of the transaction) —
    // not an enum, since the payment-provider abstraction is meant to
    // be swappable without a schema migration (master prompt §36).
    provider: { type: String, trim: true, maxlength: 60, default: 'manual' },

    // Opaque reference from the provider/manual reconciliation only —
    // never a raw card/account number. `sparse` so multiple manual
    // payments (which have none) don't collide on the unique index.
    providerTransactionId: { type: String, trim: true, maxlength: 200, default: null },

    // Caller-supplied idempotency key for `initiate` requests, so a
    // retried/duplicated client request can never create two pending
    // payments for the same intent (master prompt §36 "duplicate
    // prevention").
    idempotencyKey: { type: String, trim: true, maxlength: 100, default: null },

    status: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING', index: true },
    failureReason: { type: String, trim: true, maxlength: 500, default: '' },

    // The staff member who recorded a manual payment, or the patient/
    // staff member who initiated an online payment.
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The staff member who reconciled/confirmed a manual payment.
    // Left null for provider-verified online payments (the webhook
    // signature itself is the verification).
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },

    history: { type: [historyEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ patientProfile: 1, status: 1 });
paymentSchema.index({ invoice: 1, status: 1 });
paymentSchema.index(
  { providerTransactionId: 1 },
  { unique: true, sparse: true },
);
paymentSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true },
);

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
