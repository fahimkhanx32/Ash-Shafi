import mongoose from 'mongoose';

/**
 * Doctor favorite / frequently prescribed medicine templates.
 */
const prescriptionFavoriteSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    brandName: { type: String, trim: true, maxlength: 200, default: '' },
    medicineName: { type: String, trim: true, maxlength: 200, default: '' },
    genericName: { type: String, trim: true, maxlength: 200, default: '' },
    medicineType: { type: String, trim: true, maxlength: 60, default: 'Tablet' },
    strength: { type: String, trim: true, maxlength: 60, default: '' },
    strengthUnit: { type: String, trim: true, maxlength: 40, default: 'mg' },
    dosage: { type: String, trim: true, maxlength: 60, default: '1 + 0 + 0' },
    foodInstruction: { type: String, trim: true, maxlength: 100, default: 'খাবার পরে' },
    durationValue: { type: String, trim: true, maxlength: 40, default: '14' },
    durationUnit: { type: String, trim: true, maxlength: 40, default: 'Days' },
    continuation: { type: String, trim: true, maxlength: 60, default: 'চলবে' },
    specialInstruction: { type: String, trim: true, maxlength: 300, default: '' },
    useCount: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false },
);

prescriptionFavoriteSchema.index({ doctor: 1, genericName: 1, brandName: 1, medicineName: 1 });

export const PrescriptionFavorite = mongoose.model(
  'PrescriptionFavorite',
  prescriptionFavoriteSchema,
  'prescription_favorites',
);
