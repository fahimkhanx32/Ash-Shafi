import mongoose from 'mongoose';

/**
 * BET-15.1 — Invoice, invoice items, discounts, balances, billing
 * history (master prompt §35). `amountPaid`/`balanceDue`/`status` are
 * server-computed exclusively by `services/invoice.service.js` and
 * `../../payments/services/payment.service.js` — never accepted
 * directly from a client request body (master prompt §80). Line
 * totals are always recomputed server-side from `unitPrice` *
 * `quantity` - `discountAmount`, never trusted from the client either.
 */
export const INVOICE_STATUSES = Object.freeze([
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    serviceType: {
      type: String,
      enum: ['NEW_CONSULTATION', 'FOLLOW_UP_CONSULTATION', 'ONLINE_CONSULTATION', 'PROCEDURE', 'INVESTIGATION', 'OTHER'],
      required: true,
    },
    fee: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', default: null },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    discountAmount: { type: Number, min: 0, default: 0 },
    // = (unitPrice * quantity) - discountAmount, computed server-side.
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 60 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Optional context links — an invoice is often generated off a
    // specific visit, but stands alone (e.g. a procedure billed
    // without a formal appointment record).
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter', default: null },

    items: {
      type: [invoiceItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An invoice must have at least one item.',
      },
    },

    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'BDT' },

    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balanceDue: { type: Number, required: true, min: 0 },

    status: { type: String, enum: INVOICE_STATUSES, default: 'ISSUED', index: true },

    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    issuedDate: { type: Date, default: Date.now, index: true },
    dueDate: { type: Date, default: null },

    notes: { type: String, trim: true, maxlength: 1000, default: '' },

    cancellationReason: { type: String, trim: true, maxlength: 500, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },

    history: { type: [historyEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

invoiceSchema.index({ patientProfile: 1, status: 1 });
invoiceSchema.index({ patientProfile: 1, issuedDate: -1 });
invoiceSchema.index({ status: 1, issuedDate: -1 });

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
