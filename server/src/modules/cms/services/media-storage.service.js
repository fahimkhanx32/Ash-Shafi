import { cloudinary, isCloudinaryConfigured } from '../../../config/cloudinary.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-16 — public-website media storage. Mirrors the upload/delete
 * shape `modules/reports/services/report-storage.service.js`
 * established for medical files, but deliberately the opposite
 * access mode: `type: 'upload'` / no `access_mode` restriction, so
 * the public website can render these images directly from their
 * Cloudinary delivery URL (master prompt §58 — separate public media
 * from confidential medical files; §28 — optimize/resize images
 * rather than storing unnecessarily large originals).
 */

const WEBSITE_MEDIA_FOLDER = 'ash-shafi/website/media';

export const uploadMediaFile = async ({ buffer, storageFilename, resourceType = 'image' }) => {
  if (!isCloudinaryConfigured) {
    throw new AppError('File storage is not configured on this server.', 503, {
      code: 'STORAGE_NOT_CONFIGURED',
    });
  }

  const publicId = `${WEBSITE_MEDIA_FOLDER}/${storageFilename}`;

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        type: 'upload',
        overwrite: false,
        unique_filename: false,
        // Cap the longest edge and strip embedded metadata for images
        // — never store an unnecessarily large original (master
        // prompt §28). Not applied to video uploads (transformation
        // would trigger Cloudinary video processing, unnecessary for
        // a background clip played back as-is). FET-16 — extended
        // from image-only to also accept 'video' for the homepage
        // hero/banner and CUSTOM-section background uploads; every
        // pre-existing caller omits this param and keeps its original
        // image-only behavior via the default.
        transformation:
          resourceType === 'image' ? [{ width: 2000, height: 2000, crop: 'limit' }] : undefined,
      },
      (error, uploadResult) => (error ? reject(error) : resolve(uploadResult)),
    );
    uploadStream.end(buffer);
  });

  return {
    url: result.secure_url,
    cloudinaryPublicId: result.public_id,
    cloudinaryResourceType: result.resource_type,
    width: result.width ?? null,
    height: result.height ?? null,
  };
};

export const deleteMediaFile = async ({ cloudinaryPublicId, cloudinaryResourceType }) => {
  if (!isCloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(cloudinaryPublicId, {
      resource_type: cloudinaryResourceType || 'image',
      type: 'upload',
    });
  } catch (error) {
    logger.error({ err: error, cloudinaryPublicId }, 'Failed to delete website media from storage.');
  }
};
