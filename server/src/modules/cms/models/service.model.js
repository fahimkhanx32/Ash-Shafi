import mongoose from 'mongoose';

/**
 * Public-website "care services" content (homepage services grid,
 * and later the standalone /services page — FET-16). `icon` is a
 * free-form string key, not a Joi enum tied to a specific icon
 * library, so the backend content model doesn't get coupled to
 * whichever frontend icon set the website app happens to use;
 * the frontend maps known keys to an icon with a sensible fallback.
 */
const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 140,
    },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, trim: true, maxlength: 50, default: '' },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

serviceSchema.index({ isActive: 1, order: 1 });

export const Service = mongoose.model('Service', serviceSchema, 'website_services');
