import env from '../../../../config/env.js';
import { nativeWebrtcProvider } from './native-webrtc.provider.js';
import { AppError } from '../../../../middlewares/error.middleware.js';

/**
 * BET-14.1 — Video provider registry (master prompt §32).
 *
 * `video-session.service.js` never imports a concrete provider file
 * directly — it always goes through `getVideoProvider()`, which
 * resolves `env.video.provider` ('native' by default) to the matching
 * `VideoProvider` implementation. Adding a real hosted gateway later
 * means adding a new file next to `native-webrtc.provider.js` and one
 * new entry in this map — no change to the service layer, the
 * controller, or the routes.
 */
const PROVIDERS = Object.freeze({
  native: nativeWebrtcProvider,
});

export const getVideoProvider = () => {
  const provider = PROVIDERS[env.video.provider];

  if (!provider) {
    throw new AppError(`Unknown video provider "${env.video.provider}".`, 500, {
      code: 'VIDEO_PROVIDER_UNKNOWN',
    });
  }

  if (typeof provider.isConfigured === 'function' && !provider.isConfigured()) {
    throw new AppError('The video consultation provider is not configured.', 503, {
      code: 'VIDEO_PROVIDER_NOT_CONFIGURED',
    });
  }

  return provider;
};

export { PROVIDERS };
