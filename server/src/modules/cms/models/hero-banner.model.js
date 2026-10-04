import mongoose from 'mongoose';

/**
 * Public-website homepage hero/banner (FET-16). Singleton document
 * (one document, fixed `_id`), same pattern as about-content.model.js
 * — there's exactly one homepage banner. Admin can set either an image
 * OR a video as the background (dashboard request: "can upload bg
 * image or video in banner"); `backgroundMedia.resourceType`
 * distinguishes which, and the Next.js site picks the right tag
 * (`<img>`/`<video>`) accordingly.
 */
const heroBannerSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'homepage-hero' },

    eyebrow: { type: String, trim: true, maxlength: 80, default: '' },
    heading: { type: String, required: true, trim: true, maxlength: 200 },
    // Optional accent word/phrase rendered in the gold accent color
    // within the heading (e.g. "Womanhood") — kept separate from the
    // main heading string so the frontend can style it distinctly
    // without parsing markup out of free text.
    headingAccent: { type: String, trim: true, maxlength: 60, default: '' },
    description: { type: String, trim: true, maxlength: 400, default: '' },

    ctaPrimaryLabel: { type: String, trim: true, maxlength: 60, default: '' },
    ctaPrimaryHref: { type: String, trim: true, maxlength: 300, default: '' },
    ctaSecondaryLabel: { type: String, trim: true, maxlength: 60, default: '' },
    ctaSecondaryHref: { type: String, trim: true, maxlength: 300, default: '' },

    backgroundMedia: {
      url: { type: String, trim: true, default: '' },
      cloudinaryPublicId: { type: String, trim: true, default: '' },
      resourceType: { type: String, enum: ['image', 'video', ''], default: '' },
    },
    // 0-100, how dark the overlay over the background media is —
    // admin-tunable so text stays readable regardless of what image/
    // video they upload.
    overlayOpacity: { type: Number, min: 0, max: 100, default: 30 },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export const HeroBanner = mongoose.model('HeroBanner', heroBannerSchema, 'website_hero_banner');
