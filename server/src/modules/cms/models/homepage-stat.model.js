import mongoose from 'mongoose';

/**
 * Public-website homepage stats strip ("15+ Years of Excellence",
 * "18,500+ Happy Patients", etc.). `value` is a display string, not a
 * number — these are marketing figures the clinic updates
 * periodically, not derived from live operational data (that's
 * BET-20/FET-21's analytics module, a different concern).
 */
const homepageStatSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 30 },
    icon: { type: String, trim: true, maxlength: 50, default: '' },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

homepageStatSchema.index({ isActive: 1, order: 1 });

export const HomepageStat = mongoose.model(
  'HomepageStat',
  homepageStatSchema,
  'website_homepage_stats',
);
