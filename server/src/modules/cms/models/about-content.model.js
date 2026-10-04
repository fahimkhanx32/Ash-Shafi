import mongoose from 'mongoose';

const highlightSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    icon: { type: String, trim: true, maxlength: 50, default: '' },
  },
  { _id: true },
);

/**
 * Public-website "About the clinic" homepage section. Modeled as a
 * singleton (one document, fixed `_id`) rather than a list — there is
 * exactly one homepage About block, unlike Service/HomepageStat which
 * are genuinely repeating collections.
 */
const aboutContentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'homepage-about' },
    heading: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    highlights: { type: [highlightSchema], default: [] },
    ctaLabel: { type: String, trim: true, maxlength: 60, default: '' },
    ctaHref: { type: String, trim: true, maxlength: 200, default: '' },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export const AboutContent = mongoose.model(
  'AboutContent',
  aboutContentSchema,
  'website_about_content',
);
