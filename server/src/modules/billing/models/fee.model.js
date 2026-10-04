import mongoose from 'mongoose';

/**
 * BET-15.1 — Configurable service pricing (master prompt §35: "Ash-Shāfī/
 * admin can configure prices"). A `Fee` is a priced service catalog
 * entry — deliberately separate from `Invoice` (the actual bill),
 * mirroring the `Investigation` (order/definition) vs `MedicalReport`
 * (artifact) split BET-12 already established: one collection is the
 * reusable, editable price list; a different collection is the
 * immutable-once-issued record of what a specific patient was charged.
 */
export const FEE_SERVICE_TYPES = Object.freeze([
  'NEW_CONSULTATION',
  'FOLLOW_UP_CONSULTATION',
  'ONLINE_CONSULTATION',
  'PROCEDURE',
  'INVESTIGATION',
  'OTHER',
]);

const feeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    serviceType: { type: String, enum: FEE_SERVICE_TYPES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },

    // Stored in the smallest currency unit's decimal form (e.g. 1500.00
    // BDT), never negative. Client-supplied amounts are always
    // re-validated (Joi `min(0)`) before reaching this schema — see
    // `validators/billing.validation.js`.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'BDT' },

    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

feeSchema.index({ serviceType: 1, isActive: 1 });
feeSchema.index({ name: 'text' });

export const Fee = mongoose.models.Fee || mongoose.model('Fee', feeSchema);
