import mongoose from 'mongoose';

export const REFUND_STATUSES = Object.freeze([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
]);

const refundSchema = new mongoose.Schema(
  {
    refundReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'BDT' },
    reason: { type: String, trim: true, maxlength: 500, required: true },

    status: { type: String, enum: REFUND_STATUSES, default: 'PENDING', index: true },
    providerRefundId: { type: String, trim: true, maxlength: 200, default: null },
    failureReason: { type: String, trim: true, maxlength: 500, default: '' },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refundSchema.index({ payment: 1, status: 1 });

export const Refund = mongoose.models.Refund || mongoose.model('Refund', refundSchema);
