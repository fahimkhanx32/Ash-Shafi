import Joi from 'joi';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const idParamSchema = Joi.object({ id: mongoIdSchema.required() });

export const createServiceSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
  slug: Joi.string().trim().max(140).allow(''),
  description: Joi.string().trim().min(1).max(500).required(),
  icon: Joi.string().trim().max(50).allow(''),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
});

export const updateServiceSchema = createServiceSchema.fork(
  ['title', 'description'],
  (s) => s.optional(),
).min(1);

export const createStatSchema = Joi.object({
  label: Joi.string().trim().min(1).max(80).required(),
  value: Joi.string().trim().min(1).max(30).required(),
  icon: Joi.string().trim().max(50).allow(''),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
});

export const updateStatSchema = createStatSchema
  .fork(['label', 'value'], (s) => s.optional())
  .min(1);

const highlightSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().min(1).max(300).required(),
  icon: Joi.string().trim().max(50).allow(''),
});

export const upsertAboutSchema = Joi.object({
  heading: Joi.string().trim().min(1).max(150).required(),
  body: Joi.string().trim().min(1).max(1000).required(),
  highlights: Joi.array().items(highlightSchema).max(8),
  ctaLabel: Joi.string().trim().max(60).allow(''),
  ctaHref: Joi.string().trim().max(200).allow(''),
});

// --- Pages ---

const PAGE_TYPES = [
  'HOME', 'ABOUT', 'DOCTOR', 'SERVICES', 'APPOINTMENT', 'SCHEDULE',
  'LOCATION', 'FAQ', 'BLOG', 'CONTACT', 'PRIVACY', 'TERMS', 'CUSTOM',
];
const BLOCK_TYPES = ['HEADING', 'PARAGRAPH', 'IMAGE', 'CTA', 'QUOTE'];

const contentBlockSchema = Joi.object({
  type: Joi.string().valid(...BLOCK_TYPES).required(),
  body: Joi.string().trim().max(5000).allow(''),
  imageUrl: Joi.string().trim().max(500).allow(''),
  imageAlt: Joi.string().trim().max(200).allow(''),
  ctaLabel: Joi.string().trim().max(80).allow(''),
  ctaHref: Joi.string().trim().max(300).allow(''),
  order: Joi.number().integer().min(0),
});

const featuredImageSchema = Joi.object({
  url: Joi.string().trim().max(500).allow(''),
  cloudinaryPublicId: Joi.string().trim().allow(''),
  altText: Joi.string().trim().max(200).allow(''),
});

const seoSchema = Joi.object({
  title: Joi.string().trim().max(70).allow(''),
  description: Joi.string().trim().max(200).allow(''),
  ogImage: Joi.string().trim().max(500).allow(''),
});

export const createPageSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required(),
  slug: Joi.string().trim().max(160).allow(''),
  pageType: Joi.string().valid(...PAGE_TYPES),
  excerpt: Joi.string().trim().max(300).allow(''),
  blocks: Joi.array().items(contentBlockSchema).max(100),
  featuredImage: featuredImageSchema,
  seo: seoSchema,
  showInNav: Joi.boolean(),
  navOrder: Joi.number().integer().min(0),
});

export const updatePageSchema = createPageSchema.fork(['title'], (s) => s.optional()).min(1);

export const listPagesQuerySchema = Joi.object({
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED'),
  pageType: Joi.string().valid(...PAGE_TYPES),
  search: Joi.string().trim().max(150).allow(''),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

export const listPublishedPagesQuerySchema = Joi.object({
  pageType: Joi.string().valid(...PAGE_TYPES),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

export const slugParamSchema = Joi.object({
  slug: Joi.string().trim().min(1).max(160).required(),
});

// --- Media ---

export const uploadMediaSchema = Joi.object({
  altText: Joi.string().trim().max(200).allow(''),
});

export const listMediaQuerySchema = Joi.object({
  search: Joi.string().trim().max(150).allow(''),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

// --- Contact inquiries (FET-16 completion pass — public "Contact" form) ---

export const submitContactInquirySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  email: Joi.string().trim().email().max(200).required(),
  phone: Joi.string().trim().max(30).allow(''),
  subject: Joi.string().trim().max(150).allow(''),
  message: Joi.string().trim().min(1).max(2000).required(),
  // Honeypot field: real users never populate a field named this way
  // (hidden via CSS on the public form). Accepted-but-ignored here so
  // the schema doesn't 400 a bot's own payload before the controller
  // gets a chance to silently drop it — see contact.routes.js.
  website: Joi.string().trim().max(200).allow(''),
});

export const listContactInquiriesQuerySchema = Joi.object({
  status: Joi.string().valid('NEW', 'READ', 'RESOLVED'),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

export const updateContactInquiryStatusSchema = Joi.object({
  status: Joi.string().valid('NEW', 'READ', 'RESOLVED').required(),
});
