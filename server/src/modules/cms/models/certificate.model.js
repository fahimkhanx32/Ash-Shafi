import mongoose from 'mongoose';

/**
 * Public-website certificates/accreditations grid (FET-16 homepage
 * "Certified Care & Compliance" section). Modeled on service.model.js's
 * shape 1:1 (title/order/isActive collection with an image), since it's
 * the same "admin-managed logo grid" pattern already established there.
 */
const certificateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    image: {
      url: { type: String, trim: true, default: '' },
      cloudinaryPublicId: { type: String, trim: true, default: '' },
    },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

certificateSchema.index({ isActive: 1, order: 1 });

export const Certificate = mongoose.model('Certificate', certificateSchema, 'website_certificates');
