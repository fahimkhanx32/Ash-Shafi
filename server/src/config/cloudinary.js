import { v2 as cloudinary } from 'cloudinary';

import env from './env.js';

/**
 * Cloudinary configuration (BET-02 foundation).
 *
 * The existing Cloudinary credentials in `.env` are preserved and
 * used exactly as provided (see master prompt sections 11 and 58).
 * This module only wires up the SDK; actual upload/delivery logic
 * for medical files, reports, and media belongs to later tasks
 * (BET-12 File Management, etc.) and must not make confidential
 * medical files publicly accessible.
 */

const isCloudinaryConfigured = Boolean(
  env.cloudinary.cloudName &&
    env.cloudinary.apiKey &&
    env.cloudinary.apiSecret,
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
} else if (env.app.nodeEnv !== 'test') {
  console.warn(
    'Cloudinary is not fully configured; file storage features will be unavailable until credentials are set.',
  );
}

export { cloudinary, isCloudinaryConfigured };
export default cloudinary;
