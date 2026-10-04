import mongoose from 'mongoose';

import { Page } from '../models/page.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { sanitizeHtmlContent, sanitizeString } from '../../../security/sanitization.js';
import { getOrSetCache, invalidateCachePrefix } from '../../../utils/cache.util.js';

// BET-23 — cache namespace for public page reads. Every mutation
// below invalidates this whole prefix rather than tracking
// per-entry dependencies (simple and safe for CMS content's low
// write frequency); a no-op when Redis is disabled, per
// `utils/cache.util.js`'s documented contract.
const PUBLIC_PAGE_CACHE_PREFIX = 'cms:pages:public';
const PUBLIC_PAGE_CACHE_TTL_SECONDS = 300;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Slightly wider allowed-tag set than the sanitization module's
// default — page body content is edited by trusted CMS staff (not
// patient-submitted), so headings/links are useful, but scripts,
// iframes, and event-handler attributes are still always stripped.
const PAGE_BODY_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u',
  'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'a',
];
const PAGE_BODY_ALLOWED_ATTRIBUTES = { a: ['href', 'target', 'rel'] };

const sanitizeBlocks = (blocks = []) =>
  blocks.map((block) => ({
    ...block,
    body:
      block.type === 'PARAGRAPH' || block.type === 'QUOTE'
        ? sanitizeHtmlContent(block.body || '', {
            allowedTags: PAGE_BODY_ALLOWED_TAGS,
            allowedAttributes: PAGE_BODY_ALLOWED_ATTRIBUTES,
          })
        : sanitizeString(block.body || ''),
  }));

const sanitizePagePayload = (data) => {
  const sanitized = { ...data };
  if (sanitized.blocks) {
    sanitized.blocks = sanitizeBlocks(sanitized.blocks);
  }
  if (sanitized.excerpt) {
    sanitized.excerpt = sanitizeString(sanitized.excerpt);
  }
  if (sanitized.seo?.description) {
    sanitized.seo.description = sanitizeString(sanitized.seo.description);
  }
  return sanitized;
};

const ensureUniqueSlug = async (slug, excludeId) => {
  const clash = await Page.findOne(
    excludeId ? { slug, _id: { $ne: excludeId } } : { slug },
  );
  if (clash) {
    throw new AppError('A page with this slug already exists.', 409, { code: 'PAGE_SLUG_TAKEN' });
  }
};

// ---------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------

export const createPage = async (data, actor) => {
  const slug = slugify(data.slug || data.title);
  await ensureUniqueSlug(slug);

  const page = await Page.create({
    ...sanitizePagePayload(data),
    slug,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  logger.info(
    { event: 'website_page_created', pageId: page._id.toString(), slug, actor: String(actor._id) },
    'Website page created.',
  );

  await invalidateCachePrefix(PUBLIC_PAGE_CACHE_PREFIX);

  return page;
};

export const getPageById = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid page id.', 400, { code: 'INVALID_ID' });
  }
  const page = await Page.findById(id);
  if (!page) {
    throw new AppError('Page not found.', 404, { code: 'PAGE_NOT_FOUND' });
  }
  return page;
};

export const updatePage = async (id, updates, actor) => {
  const page = await getPageById(id);

  if (updates.slug || updates.title) {
    const nextSlug = slugify(updates.slug || updates.title);
    if (nextSlug !== page.slug) {
      await ensureUniqueSlug(nextSlug, page._id);
      updates.slug = nextSlug;
    } else {
      delete updates.slug;
    }
  }

  Object.assign(page, sanitizePagePayload(updates), { updatedBy: actor._id });
  await page.save();

  await invalidateCachePrefix(PUBLIC_PAGE_CACHE_PREFIX);

  return page;
};

export const deletePage = async (id) => {
  const page = await getPageById(id);
  await page.deleteOne();

  await invalidateCachePrefix(PUBLIC_PAGE_CACHE_PREFIX);

  return page;
};

export const listPages = async ({ status, pageType, search, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (pageType) filter.pageType = pageType;
  if (search) {
    filter.$text = { $search: search };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Page.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Page.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

// ---------------------------------------------------------------------
// Draft / publish / unpublish / archive workflow (master prompt §39)
// ---------------------------------------------------------------------

export const publishPage = async (id, actor) => {
  const page = await getPageById(id);
  page.status = 'PUBLISHED';
  if (!page.publishedAt) {
    page.publishedAt = new Date();
  }
  page.updatedBy = actor._id;
  await page.save();

  logger.info(
    { event: 'website_page_published', pageId: page._id.toString(), actor: String(actor._id) },
    'Website page published.',
  );

  await invalidateCachePrefix(PUBLIC_PAGE_CACHE_PREFIX);

  return page;
};

export const unpublishPage = async (id, actor) => {
  const page = await getPageById(id);
  page.status = 'DRAFT';
  page.updatedBy = actor._id;
  await page.save();

  await invalidateCachePrefix(PUBLIC_PAGE_CACHE_PREFIX);

  return page;
};

export const archivePage = async (id, actor) => {
  const page = await getPageById(id);
  page.status = 'ARCHIVED';
  page.updatedBy = actor._id;
  await page.save();

  await invalidateCachePrefix(PUBLIC_PAGE_CACHE_PREFIX);

  return page;
};

// ---------------------------------------------------------------------
// Public reads — published content only
// ---------------------------------------------------------------------

export const listPublishedPages = async ({ pageType, page = 1, limit = 20 } = {}) => {
  const cacheKey = `${PUBLIC_PAGE_CACHE_PREFIX}:list:${pageType ?? 'all'}:${page}:${limit}`;

  // BET-23 — this is the public website's page-list endpoint, hit by
  // every unauthenticated visitor and unchanged between admin edits.
  // Redis-cached (no-op if Redis is disabled) with a short 5-minute
  // TTL so a publish/unpublish still surfaces quickly even if an
  // invalidation call were ever missed.
  return getOrSetCache(cacheKey, PUBLIC_PAGE_CACHE_TTL_SECONDS, async () => {
    const filter = { status: 'PUBLISHED' };
    if (pageType) filter.pageType = pageType;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Page.find(filter).sort({ navOrder: 1, publishedAt: -1 }).skip(skip).limit(limit).lean(),
      Page.countDocuments(filter),
    ]);

    return { items, page, limit, total };
  });
};

export const getPublishedPageBySlug = async (slug) => {
  const cacheKey = `${PUBLIC_PAGE_CACHE_PREFIX}:slug:${slug}`;

  const page = await getOrSetCache(cacheKey, PUBLIC_PAGE_CACHE_TTL_SECONDS, () =>
    Page.findOne({ slug, status: 'PUBLISHED' }).lean(),
  );

  if (!page) {
    throw new AppError('Page not found.', 404, { code: 'PAGE_NOT_FOUND' });
  }
  return page;
};
