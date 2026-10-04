import mongoose from 'mongoose';

import { NavbarItem } from '../models/navbar-item.model.js';
import { Certificate } from '../models/certificate.model.js';
import { HeroBanner } from '../models/hero-banner.model.js';
import { HomepageSection } from '../models/homepage-section.model.js';
import { uploadMediaFile, deleteMediaFile } from './media-storage.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { sanitizeHtmlContent, sanitizeString } from '../../../security/sanitization.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Same allowed-tag policy as page.service.js's PARAGRAPH/QUOTE blocks —
// CUSTOM homepage sections are edited by trusted CMS staff, so basic
// formatting/links are fine, but scripts/iframes/event handlers are
// always stripped regardless of author intent.
const BLOCK_BODY_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u',
  'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'a',
];
const BLOCK_BODY_ALLOWED_ATTRIBUTES = { a: ['href', 'target', 'rel'] };

const sanitizeSectionBlocks = (blocks = []) =>
  blocks.map((block) => ({
    ...block,
    body:
      block.type === 'PARAGRAPH' || block.type === 'QUOTE'
        ? sanitizeHtmlContent(block.body || '', {
            allowedTags: BLOCK_BODY_ALLOWED_TAGS,
            allowedAttributes: BLOCK_BODY_ALLOWED_ATTRIBUTES,
          })
        : sanitizeString(block.body || ''),
  }));

// ---------------------------------------------------------------------
// Navbar items
// ---------------------------------------------------------------------

// Public read: active items only, top-level first with their active
// children nested — the shape the Next.js navbar renders directly.
export const listPublicNavbarItems = async () => {
  const items = await NavbarItem.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
  const byParent = new Map();
  for (const item of items) {
    const key = item.parentId ? String(item.parentId) : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  }
  const attachChildren = (item) => ({
    ...item,
    children: (byParent.get(String(item._id)) || []).map(attachChildren),
  });
  return (byParent.get(null) || []).map(attachChildren);
};

// Admin read: every item, flat, so the dashboard table can show
// hidden items too and let the admin manage parent/child assignment.
export const listAllNavbarItems = async () =>
  NavbarItem.find().sort({ order: 1, createdAt: 1 });

export const createNavbarItem = async (data, actor) => {
  if (data.parentId) {
    if (!isValidObjectId(data.parentId)) {
      throw new AppError('Invalid parent navbar item id.', 400, { code: 'INVALID_PARENT_ID' });
    }
    const parent = await NavbarItem.findById(data.parentId);
    if (!parent) {
      throw new AppError('Parent navbar item not found.', 404, { code: 'PARENT_NOT_FOUND' });
    }
    if (parent.parentId) {
      throw new AppError('Navbar dropdowns only support one level.', 400, {
        code: 'NAVBAR_DEPTH_EXCEEDED',
      });
    }
  }

  const item = await NavbarItem.create({
    ...data,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  logger.info(
    { event: 'website_navbar_item_created', navbarItemId: item._id.toString(), actor: String(actor._id) },
    'Website navbar item created.',
  );

  return item;
};

export const updateNavbarItem = async (id, updates, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid navbar item id.', 400, { code: 'INVALID_ID' });
  }
  const item = await NavbarItem.findById(id);
  if (!item) {
    throw new AppError('Navbar item not found.', 404, { code: 'NAVBAR_ITEM_NOT_FOUND' });
  }

  if (updates.parentId) {
    if (!isValidObjectId(updates.parentId)) {
      throw new AppError('Invalid parent navbar item id.', 400, { code: 'INVALID_PARENT_ID' });
    }
    if (String(updates.parentId) === String(item._id)) {
      throw new AppError('A navbar item cannot be its own parent.', 400, {
        code: 'NAVBAR_SELF_PARENT',
      });
    }
    const parent = await NavbarItem.findById(updates.parentId);
    if (!parent) {
      throw new AppError('Parent navbar item not found.', 404, { code: 'PARENT_NOT_FOUND' });
    }
    if (parent.parentId) {
      throw new AppError('Navbar dropdowns only support one level.', 400, {
        code: 'NAVBAR_DEPTH_EXCEEDED',
      });
    }
  }

  Object.assign(item, updates, { updatedBy: actor._id });
  await item.save();
  return item;
};

export const reorderNavbarItems = async (orderedIds, actor) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError('orderedIds must be a non-empty array.', 400, { code: 'INVALID_ORDER' });
  }
  const ops = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index, updatedBy: actor._id } },
    },
  }));
  await NavbarItem.bulkWrite(ops);
  return listAllNavbarItems();
};

export const deleteNavbarItem = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid navbar item id.', 400, { code: 'INVALID_ID' });
  }
  const deleted = await NavbarItem.findByIdAndDelete(id);
  if (!deleted) {
    throw new AppError('Navbar item not found.', 404, { code: 'NAVBAR_ITEM_NOT_FOUND' });
  }
  // Orphan any children of a deleted top-level item back to top-level
  // rather than leaving a dangling parentId pointing at nothing.
  await NavbarItem.updateMany({ parentId: deleted._id }, { $set: { parentId: null } });
  return deleted;
};

// ---------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------

export const listActiveCertificates = async () =>
  Certificate.find({ isActive: true }).sort({ order: 1, createdAt: 1 });

export const listAllCertificates = async () => Certificate.find().sort({ order: 1, createdAt: 1 });

export const createCertificate = async (data, actor) => {
  const certificate = await Certificate.create({
    ...data,
    createdBy: actor._id,
    updatedBy: actor._id,
  });
  logger.info(
    { event: 'website_certificate_created', certificateId: certificate._id.toString(), actor: String(actor._id) },
    'Website certificate created.',
  );
  return certificate;
};

export const updateCertificate = async (id, updates, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid certificate id.', 400, { code: 'INVALID_ID' });
  }
  const certificate = await Certificate.findById(id);
  if (!certificate) {
    throw new AppError('Certificate not found.', 404, { code: 'CERTIFICATE_NOT_FOUND' });
  }
  Object.assign(certificate, updates, { updatedBy: actor._id });
  await certificate.save();
  return certificate;
};

export const reorderCertificates = async (orderedIds, actor) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError('orderedIds must be a non-empty array.', 400, { code: 'INVALID_ORDER' });
  }
  const ops = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index, updatedBy: actor._id } },
    },
  }));
  await Certificate.bulkWrite(ops);
  return listAllCertificates();
};

export const deleteCertificate = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid certificate id.', 400, { code: 'INVALID_ID' });
  }
  const certificate = await Certificate.findById(id);
  if (!certificate) {
    throw new AppError('Certificate not found.', 404, { code: 'CERTIFICATE_NOT_FOUND' });
  }
  if (certificate.image?.cloudinaryPublicId) {
    await deleteMediaFile({
      cloudinaryPublicId: certificate.image.cloudinaryPublicId,
      cloudinaryResourceType: 'image',
    });
  }
  await certificate.deleteOne();
  return certificate;
};

// ---------------------------------------------------------------------
// Hero banner (singleton)
// ---------------------------------------------------------------------

const HERO_SINGLETON_ID = 'homepage-hero';

export const getHeroBanner = async () => HeroBanner.findById(HERO_SINGLETON_ID);

export const upsertHeroBanner = async (data, actor) => {
  const banner = await HeroBanner.findByIdAndUpdate(
    HERO_SINGLETON_ID,
    { ...data, updatedBy: actor._id },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return banner;
};

// Accepts either an image or a video file (dashboard request: "can
// upload bg image or video in banner"). Replaces and deletes any
// previously uploaded banner asset so old media doesn't pile up in
// storage.
const BANNER_MIME_TO_RESOURCE_TYPE = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
};

export const uploadHeroBannerMedia = async (file, actor) => {
  if (!file) {
    throw new AppError('No file was uploaded.', 400, { code: 'FILE_REQUIRED' });
  }
  const resourceType = BANNER_MIME_TO_RESOURCE_TYPE[file.mimetype];
  if (!resourceType) {
    throw new AppError('Only JPEG, PNG, WebP images or MP4 video may be used as the banner background.', 400, {
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  }

  const existing = await HeroBanner.findById(HERO_SINGLETON_ID);

  const uploaded = await uploadMediaFile({
    buffer: file.buffer,
    storageFilename: file.storageFilename,
    resourceType,
  });

  const banner = await HeroBanner.findByIdAndUpdate(
    HERO_SINGLETON_ID,
    {
      backgroundMedia: {
        url: uploaded.url,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        resourceType,
      },
      updatedBy: actor._id,
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  if (existing?.backgroundMedia?.cloudinaryPublicId) {
    await deleteMediaFile({
      cloudinaryPublicId: existing.backgroundMedia.cloudinaryPublicId,
      cloudinaryResourceType: existing.backgroundMedia.resourceType || 'image',
    });
  }

  logger.info(
    { event: 'website_hero_banner_media_uploaded', actor: String(actor._id), resourceType },
    'Website hero banner background media uploaded.',
  );

  return banner;
};

// ---------------------------------------------------------------------
// Homepage sections (layout registry: order, visibility, CUSTOM content)
// ---------------------------------------------------------------------

const BUILT_IN_SECTION_SEEDS = [
  { key: 'hero', type: 'HERO', order: 0 },
  { key: 'services', type: 'SERVICES', order: 1 },
  { key: 'certificates', type: 'CERTIFICATES', order: 2 },
  { key: 'stats', type: 'STATS', order: 3 },
  { key: 'about', type: 'ABOUT', order: 4 },
  // Placement rows only — same rationale as the five above, added so
  // these can finally be hidden/reordered from the dashboard instead
  // of being permanently fixed after the registry-driven block. Order
  // continues the exact sequence `page.tsx` rendered them in before
  // this change (Women's Health, Office, Support, Video, Testimonials).
  { key: 'women_health', type: 'WOMEN_HEALTH', order: 5 },
  { key: 'office', type: 'OFFICE', order: 6 },
  { key: 'support', type: 'SUPPORT', order: 7 },
  { key: 'video', type: 'VIDEO', order: 8 },
  { key: 'testimonials', type: 'TESTIMONIALS', order: 9 },
];

// Idempotently ensures the ten built-in section rows exist so a
// freshly-deployed site has a sensible default layout even before an
// admin has visited the dashboard. Safe to call on every server start
// (upsert, never overwrites an admin's existing order/isActive).
export const ensureBuiltInSectionsSeeded = async () => {
  for (const seed of BUILT_IN_SECTION_SEEDS) {
    await HomepageSection.updateOne(
      { key: seed.key },
      { $setOnInsert: { ...seed, isActive: true, isDeletable: false } },
      { upsert: true },
    );
  }
};

export const listPublicSections = async () =>
  HomepageSection.find({ isActive: true }).sort({ order: 1 });

export const listAllSections = async () => HomepageSection.find().sort({ order: 1 });

export const createCustomSection = async (data, actor) => {
  const key = slugify(data.key || data.title);
  if (!key) {
    throw new AppError('A section key or title is required.', 400, { code: 'SECTION_KEY_REQUIRED' });
  }
  const existing = await HomepageSection.findOne({ key });
  if (existing) {
    throw new AppError('A section with this key already exists.', 409, {
      code: 'SECTION_KEY_TAKEN',
    });
  }

  const highestOrder = await HomepageSection.findOne().sort({ order: -1 }).select('order');

  const section = await HomepageSection.create({
    ...data,
    key,
    type: 'CUSTOM',
    isDeletable: true,
    blocks: sanitizeSectionBlocks(data.blocks || []),
    order: Number.isFinite(data.order) ? data.order : (highestOrder?.order ?? 0) + 1,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  logger.info(
    { event: 'website_section_created', sectionId: section._id.toString(), key, actor: String(actor._id) },
    'Custom homepage section created.',
  );

  return section;
};

export const updateSection = async (id, updates, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid section id.', 400, { code: 'INVALID_ID' });
  }
  const section = await HomepageSection.findById(id);
  if (!section) {
    throw new AppError('Section not found.', 404, { code: 'SECTION_NOT_FOUND' });
  }

  // Built-in sections (type !== CUSTOM) may only have their placement
  // changed (order/isActive/title override) — their content still
  // lives in, and must be edited via, their own collection/endpoint.
  const patch = { ...updates, updatedBy: actor._id };
  if (section.type !== 'CUSTOM') {
    delete patch.blocks;
    delete patch.backgroundMedia;
    delete patch.type;
  } else if (patch.blocks) {
    patch.blocks = sanitizeSectionBlocks(patch.blocks);
  }

  Object.assign(section, patch);
  await section.save();
  return section;
};

export const reorderSections = async (orderedIds, actor) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError('orderedIds must be a non-empty array.', 400, { code: 'INVALID_ORDER' });
  }
  const ops = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index, updatedBy: actor._id } },
    },
  }));
  await HomepageSection.bulkWrite(ops);
  return listAllSections();
};

export const deleteSection = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid section id.', 400, { code: 'INVALID_ID' });
  }
  const section = await HomepageSection.findById(id);
  if (!section) {
    throw new AppError('Section not found.', 404, { code: 'SECTION_NOT_FOUND' });
  }
  if (!section.isDeletable) {
    throw new AppError('Built-in sections cannot be deleted — hide them instead.', 409, {
      code: 'SECTION_NOT_DELETABLE',
    });
  }
  if (section.backgroundMedia?.cloudinaryPublicId) {
    await deleteMediaFile({
      cloudinaryPublicId: section.backgroundMedia.cloudinaryPublicId,
      cloudinaryResourceType: section.backgroundMedia.resourceType || 'image',
    });
  }
  await section.deleteOne();
  return section;
};

export const uploadSectionBackgroundMedia = async (id, file, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid section id.', 400, { code: 'INVALID_ID' });
  }
  const section = await HomepageSection.findById(id);
  if (!section) {
    throw new AppError('Section not found.', 404, { code: 'SECTION_NOT_FOUND' });
  }
  if (section.type !== 'CUSTOM') {
    throw new AppError('Only custom sections support a background upload here.', 400, {
      code: 'SECTION_NOT_CUSTOM',
    });
  }
  if (!file) {
    throw new AppError('No file was uploaded.', 400, { code: 'FILE_REQUIRED' });
  }
  const resourceType = BANNER_MIME_TO_RESOURCE_TYPE[file.mimetype];
  if (!resourceType) {
    throw new AppError('Only JPEG, PNG, WebP images or MP4 video may be uploaded.', 400, {
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  }

  const previous = section.backgroundMedia?.cloudinaryPublicId ? { ...section.backgroundMedia } : null;

  const uploaded = await uploadMediaFile({
    buffer: file.buffer,
    storageFilename: file.storageFilename,
    resourceType,
  });

  section.backgroundMedia = {
    url: uploaded.url,
    cloudinaryPublicId: uploaded.cloudinaryPublicId,
    resourceType,
  };
  section.updatedBy = actor._id;
  await section.save();

  if (previous) {
    await deleteMediaFile({
      cloudinaryPublicId: previous.cloudinaryPublicId,
      cloudinaryResourceType: previous.resourceType || 'image',
    });
  }

  return section;
};
