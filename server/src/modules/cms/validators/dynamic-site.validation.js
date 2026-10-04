import Joi from 'joi';

import { idParamSchema } from './cms.validation.js';

export { idParamSchema };

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

// --- Navbar items ---

export const createNavbarItemSchema = Joi.object({
  label: Joi.string().trim().min(1).max(60).required(),
  href: Joi.string().trim().min(1).max(300).required(),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  openInNewTab: Joi.boolean(),
  parentId: mongoIdSchema.allow(null),
});

export const updateNavbarItemSchema = createNavbarItemSchema
  .fork(['label', 'href'], (s) => s.optional())
  .min(1);

export const reorderSchema = Joi.object({
  orderedIds: Joi.array().items(mongoIdSchema.required()).min(1).required(),
});

// --- Certificates ---

const certificateImageSchema = Joi.object({
  url: Joi.string().trim().max(500).allow(''),
  cloudinaryPublicId: Joi.string().trim().allow(''),
});

export const createCertificateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  image: certificateImageSchema,
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
});

export const updateCertificateSchema = createCertificateSchema.fork(['name'], (s) => s.optional()).min(1);

// --- Hero banner ---

export const upsertHeroBannerSchema = Joi.object({
  eyebrow: Joi.string().trim().max(80).allow(''),
  heading: Joi.string().trim().min(1).max(200).required(),
  headingAccent: Joi.string().trim().max(60).allow(''),
  description: Joi.string().trim().max(400).allow(''),
  ctaPrimaryLabel: Joi.string().trim().max(60).allow(''),
  ctaPrimaryHref: Joi.string().trim().max(300).allow(''),
  ctaSecondaryLabel: Joi.string().trim().max(60).allow(''),
  ctaSecondaryHref: Joi.string().trim().max(300).allow(''),
  overlayOpacity: Joi.number().min(0).max(100),
});

// --- Homepage sections ---

const SECTION_BLOCK_TYPES = ['HEADING', 'PARAGRAPH', 'IMAGE', 'CTA', 'QUOTE'];

const sectionBlockSchema = Joi.object({
  type: Joi.string().valid(...SECTION_BLOCK_TYPES).required(),
  body: Joi.string().trim().max(5000).allow(''),
  imageUrl: Joi.string().trim().max(500).allow(''),
  imageAlt: Joi.string().trim().max(200).allow(''),
  ctaLabel: Joi.string().trim().max(80).allow(''),
  ctaHref: Joi.string().trim().max(300).allow(''),
  order: Joi.number().integer().min(0),
});

export const createSectionSchema = Joi.object({
  key: Joi.string().trim().min(1).max(80),
  title: Joi.string().trim().min(1).max(150).required(),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  blocks: Joi.array().items(sectionBlockSchema).max(50),
});

// Built-in sections (HERO/SERVICES/CERTIFICATES/STATS/ABOUT) may only
// have placement fields patched — see dynamic-site.service.js's
// updateSection, which strips blocks/backgroundMedia/type server-side
// for those rows regardless of what's sent; this schema still allows
// them here since the same PATCH route serves both built-in and
// CUSTOM sections.
export const updateSectionSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  blocks: Joi.array().items(sectionBlockSchema).max(50),
}).min(1);
