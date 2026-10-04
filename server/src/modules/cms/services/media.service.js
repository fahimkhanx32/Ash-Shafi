import mongoose from 'mongoose';

import { Media } from '../models/media.model.js';
import { Page } from '../models/page.model.js';
import { uploadMediaFile, deleteMediaFile } from './media-storage.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Website media is image-only (master prompt §39 media/§8 wallpaper
// validation principles) — the shared upload middleware validates
// file signature/size for a broader set of mime types (documents,
// audio, video) used by other modules, so this is an additional,
// narrower gate specific to this module.
const ALLOWED_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadMedia = async (file, actor, { altText = '' } = {}) => {
  if (!file) {
    throw new AppError('No file was uploaded.', 400, { code: 'FILE_REQUIRED' });
  }

  if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype)) {
    throw new AppError('Only JPEG, PNG, or WebP images may be uploaded to the media library.', 400, {
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  }

  const uploaded = await uploadMediaFile({
    buffer: file.buffer,
    storageFilename: file.storageFilename,
  });

  const media = await Media.create({
    filename: file.originalname,
    url: uploaded.url,
    cloudinaryPublicId: uploaded.cloudinaryPublicId,
    cloudinaryResourceType: uploaded.cloudinaryResourceType,
    mimeType: file.mimetype,
    size: file.size,
    width: uploaded.width,
    height: uploaded.height,
    altText,
    uploadedBy: actor._id,
  });

  logger.info(
    { event: 'website_media_uploaded', mediaId: media._id.toString(), actor: String(actor._id) },
    'Website media uploaded.',
  );

  return media;
};

export const listMedia = async ({ search, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (search) {
    filter.filename = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Media.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

export const deleteMedia = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid media id.', 400, { code: 'INVALID_ID' });
  }

  const media = await Media.findById(id);
  if (!media) {
    throw new AppError('Media not found.', 404, { code: 'MEDIA_NOT_FOUND' });
  }

  // Refuse to delete media that a page is still actively using as its
  // featured image — a silent delete would leave that page with a
  // broken image reference (master prompt §81/§84's "no destructive
  // changes" principle, applied here to website content rather than
  // clinical data). Block usage inside page content blocks isn't
  // checked (a free-text `imageUrl` string, not a hard reference) —
  // documented as a known limitation, not a silent gap.
  const inUse = await Page.exists({ 'featuredImage.cloudinaryPublicId': media.cloudinaryPublicId });
  if (inUse) {
    throw new AppError('This image is set as a page\'s featured image and cannot be deleted.', 409, {
      code: 'MEDIA_IN_USE',
    });
  }

  await deleteMediaFile({
    cloudinaryPublicId: media.cloudinaryPublicId,
    cloudinaryResourceType: media.cloudinaryResourceType,
  });
  await media.deleteOne();

  return media;
};
