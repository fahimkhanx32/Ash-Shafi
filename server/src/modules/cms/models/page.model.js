import mongoose from 'mongoose';

/**
 * BET-16 — Website CMS pages (master prompt §39/§40: Home, About,
 * Doctor, Services, Appointment, Schedule, Location, FAQ, Blog,
 * Contact, Privacy, Terms, custom sections).
 *
 * A single flexible `Page` model backs every one of those content
 * types rather than a separate model per page type — `pageType`
 * distinguishes them, `blocks` gives editors a controlled set of
 * content-block primitives instead of a free-form HTML field. Every
 * `body`-bearing block is sanitized in `page.service.js` at
 * create/update time (never trusted as-is from the client) using the
 * same `sanitizeHtmlContent` helper the rest of the project already
 * has in `security/sanitization.js` — this is the "prevent XSS,
 * script injection, iframe abuse" requirement from master prompt §40,
 * enforced at the service layer, not merely by the frontend.
 */

const BLOCK_TYPES = Object.freeze(['HEADING', 'PARAGRAPH', 'IMAGE', 'CTA', 'QUOTE']);

const contentBlockSchema = new mongoose.Schema(
  {
    type: { type: String, enum: BLOCK_TYPES, required: true },
    // Sanitized rich text (PARAGRAPH/QUOTE) or plain heading text.
    // Sanitization happens in the service layer before this is ever
    // persisted — this schema only bounds the length.
    body: { type: String, trim: true, maxlength: 5000, default: '' },
    // IMAGE blocks reference a Media library asset by URL — never a
    // raw uploaded file or embedded HTML — so there is no path for a
    // block to smuggle in a script/iframe via this field.
    imageUrl: { type: String, trim: true, maxlength: 500, default: '' },
    imageAlt: { type: String, trim: true, maxlength: 200, default: '' },
    // CTA blocks.
    ctaLabel: { type: String, trim: true, maxlength: 80, default: '' },
    ctaHref: { type: String, trim: true, maxlength: 300, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const PAGE_TYPES = Object.freeze([
  'HOME',
  'ABOUT',
  'DOCTOR',
  'SERVICES',
  'APPOINTMENT',
  'SCHEDULE',
  'LOCATION',
  'FAQ',
  'BLOG',
  'CONTACT',
  'PRIVACY',
  'TERMS',
  'CUSTOM',
]);

const PAGE_STATUSES = Object.freeze(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 160,
    },
    pageType: { type: String, enum: PAGE_TYPES, default: 'CUSTOM', index: true },
    status: { type: String, enum: PAGE_STATUSES, default: 'DRAFT', index: true },

    excerpt: { type: String, trim: true, maxlength: 300, default: '' },
    blocks: { type: [contentBlockSchema], default: [] },

    featuredImage: {
      url: { type: String, trim: true, default: '' },
      cloudinaryPublicId: { type: String, trim: true, default: '' },
      altText: { type: String, trim: true, maxlength: 200, default: '' },
    },

    seo: {
      title: { type: String, trim: true, maxlength: 70, default: '' },
      description: { type: String, trim: true, maxlength: 200, default: '' },
      ogImage: { type: String, trim: true, default: '' },
    },

    // Optional public-nav placement — the frontend nav can query
    // published pages filtered on this rather than the CMS needing a
    // second "menu" concept.
    showInNav: { type: Boolean, default: false },
    navOrder: { type: Number, default: 0 },

    publishedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

pageSchema.index({ status: 1, pageType: 1 });
pageSchema.index({ status: 1, showInNav: 1, navOrder: 1 });
pageSchema.index({ title: 'text', excerpt: 'text' });

export const PAGE_TYPE_VALUES = PAGE_TYPES;
export const PAGE_STATUS_VALUES = PAGE_STATUSES;
export const BLOCK_TYPE_VALUES = BLOCK_TYPES;

export const Page = mongoose.model('Page', pageSchema, 'website_pages');
