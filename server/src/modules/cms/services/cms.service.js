import mongoose from 'mongoose';

import { Service } from '../models/service.model.js';
import { HomepageStat } from '../models/homepage-stat.model.js';
import { AboutContent } from '../models/about-content.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// ---------------------------------------------------------------------
// Services (care-service cards)
// ---------------------------------------------------------------------

export const listActiveServices = async () =>
  Service.find({ isActive: true }).sort({ order: 1, createdAt: 1 });

export const listAllServices = async () => Service.find().sort({ order: 1, createdAt: 1 });

export const createService = async (data, actor) => {
  const slug = data.slug ? slugify(data.slug) : slugify(data.title);
  const existing = await Service.findOne({ slug });
  if (existing) {
    throw new AppError('A service with this slug already exists.', 409, {
      code: 'SERVICE_SLUG_TAKEN',
    });
  }

  const service = await Service.create({
    ...data,
    slug,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  logger.info(
    { event: 'website_service_created', serviceId: service._id.toString(), actor: String(actor._id) },
    'Website service created.',
  );

  return service;
};

export const updateService = async (id, updates, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid service id.', 400, { code: 'INVALID_ID' });
  }
  const service = await Service.findById(id);
  if (!service) {
    throw new AppError('Service not found.', 404, { code: 'SERVICE_NOT_FOUND' });
  }

  if (updates.slug) {
    const nextSlug = slugify(updates.slug);
    const clash = await Service.findOne({ slug: nextSlug, _id: { $ne: service._id } });
    if (clash) {
      throw new AppError('A service with this slug already exists.', 409, {
        code: 'SERVICE_SLUG_TAKEN',
      });
    }
    updates.slug = nextSlug;
  }

  Object.assign(service, updates, { updatedBy: actor._id });
  await service.save();
  return service;
};

export const deleteService = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid service id.', 400, { code: 'INVALID_ID' });
  }
  const deleted = await Service.findByIdAndDelete(id);
  if (!deleted) {
    throw new AppError('Service not found.', 404, { code: 'SERVICE_NOT_FOUND' });
  }
  return deleted;
};

// ---------------------------------------------------------------------
// Homepage stats
// ---------------------------------------------------------------------

export const listActiveStats = async () =>
  HomepageStat.find({ isActive: true }).sort({ order: 1, createdAt: 1 });

export const listAllStats = async () => HomepageStat.find().sort({ order: 1, createdAt: 1 });

export const createStat = async (data, actor) =>
  HomepageStat.create({ ...data, createdBy: actor._id, updatedBy: actor._id });

export const updateStat = async (id, updates, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid stat id.', 400, { code: 'INVALID_ID' });
  }
  const stat = await HomepageStat.findById(id);
  if (!stat) {
    throw new AppError('Homepage stat not found.', 404, { code: 'STAT_NOT_FOUND' });
  }
  Object.assign(stat, updates, { updatedBy: actor._id });
  await stat.save();
  return stat;
};

export const deleteStat = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid stat id.', 400, { code: 'INVALID_ID' });
  }
  const deleted = await HomepageStat.findByIdAndDelete(id);
  if (!deleted) {
    throw new AppError('Homepage stat not found.', 404, { code: 'STAT_NOT_FOUND' });
  }
  return deleted;
};

// ---------------------------------------------------------------------
// About-clinic content (singleton)
// ---------------------------------------------------------------------

const ABOUT_SINGLETON_ID = 'homepage-about';

// Returns null rather than a default/placeholder document when nothing
// has been configured yet — the public site must render nothing for
// this section rather than fabricated "About us" copy (master prompt
// §79). Admins create it explicitly via `upsertAboutContent`.
export const getAboutContent = async () => AboutContent.findById(ABOUT_SINGLETON_ID);

export const upsertAboutContent = async (data, actor) => {
  const about = await AboutContent.findByIdAndUpdate(
    ABOUT_SINGLETON_ID,
    { ...data, updatedBy: actor._id },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return about;
};
