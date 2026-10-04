import mongoose from 'mongoose';

/**
 * Homepage layout registry (FET-16 dashboard request: "can create new
 * section as per user's wish ... CRUD operation ... in any section").
 *
 * One document per homepage section slot. For the built-in types
 * (HERO/SERVICES/CERTIFICATES/STATS/ABOUT) a row only carries
 * placement (`order`, `isActive`) — the actual content still lives in
 * that type's own collection (HeroBanner/Service/Certificate/
 * HomepageStat/AboutContent), exactly as before; this registry just
 * decides whether that slot renders and where. For admin-created
 * CUSTOM sections there is no separate collection — the row carries
 * its own content directly via `blocks`, deliberately reusing the same
 * block shape as `page.model.js`'s `contentBlockSchema`
 * (HEADING/PARAGRAPH/IMAGE/CTA/QUOTE) so a brand-new homepage section
 * is built out of the same sanitized, admin-composable primitives as
 * any other CMS page rather than a second free-form content format.
 * `sanitizeHtmlContent` is applied to CUSTOM block bodies in the
 * service layer at create/update time, same as Page blocks.
 */

const SECTION_TYPES = Object.freeze([
  'HERO',
  'SERVICES',
  'CERTIFICATES',
  'STATS',
  'ABOUT',
  // FET-16 completion pass, part 2 — these five were already fully
  // handled by the frontend's `SectionRenderer.tsx` (WOMEN_HEALTH/
  // OFFICE/SUPPORT/VIDEO/TESTIMONIALS cases existed and rendered the
  // real bespoke components) but had no corresponding entry here, so
  // they could never appear in this registry and were instead
  // hardcoded as a fixed block after it in `page.tsx` — un-hideable,
  // un-reorderable from the dashboard. They stay content-fixed (no
  // CMS-editable fields, same as before) — only their placement
  // becomes admin-controlled, exactly like the other built-ins.
  'WOMEN_HEALTH',
  'OFFICE',
  'SUPPORT',
  'VIDEO',
  'TESTIMONIALS',
  'CUSTOM',
]);
const BLOCK_TYPES = Object.freeze(['HEADING', 'PARAGRAPH', 'IMAGE', 'CTA', 'QUOTE']);

const sectionBlockSchema = new mongoose.Schema(
  {
    type: { type: String, enum: BLOCK_TYPES, required: true },
    body: { type: String, trim: true, maxlength: 5000, default: '' },
    imageUrl: { type: String, trim: true, maxlength: 500, default: '' },
    imageAlt: { type: String, trim: true, maxlength: 200, default: '' },
    ctaLabel: { type: String, trim: true, maxlength: 80, default: '' },
    ctaHref: { type: String, trim: true, maxlength: 300, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const homepageSectionSchema = new mongoose.Schema(
  {
    // Stable identifier used by the frontend renderer to pick a
    // component. For built-in types this is fixed ('hero', 'services',
    // 'certificates', 'stats', 'about'); for CUSTOM sections the admin
    // supplies a unique slug when creating it.
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 80,
    },
    type: { type: String, enum: SECTION_TYPES, required: true, index: true },
    // Admin-facing/rendered title. Required for CUSTOM sections
    // (there's no other source of a heading); optional override for
    // built-in types.
    title: { type: String, trim: true, maxlength: 150, default: '' },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },

    // CUSTOM-section-only content. Ignored for built-in types, whose
    // content lives in their own collection.
    blocks: { type: [sectionBlockSchema], default: [] },
    backgroundMedia: {
      url: { type: String, trim: true, default: '' },
      cloudinaryPublicId: { type: String, trim: true, default: '' },
      resourceType: { type: String, enum: ['image', 'video', ''], default: '' },
    },

    // Built-in section rows are seeded once and can be hidden/reordered
    // but not deleted (there is nowhere else for "hero" to point) —
    // admins delete CUSTOM sections freely.
    isDeletable: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

homepageSectionSchema.index({ isActive: 1, order: 1 });

export const SECTION_TYPE_VALUES = SECTION_TYPES;
export const SECTION_BLOCK_TYPE_VALUES = BLOCK_TYPES;

export const HomepageSection = mongoose.model(
  'HomepageSection',
  homepageSectionSchema,
  'website_homepage_sections',
);
