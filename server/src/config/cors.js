import env from './env.js';

/**
 * Centralized CORS configuration (BET-02).
 *
 * The list of allowed origins is sourced from the validated
 * environment configuration (CORS_ORIGINS), never hardcoded here.
 *
 * - Allows requests with no Origin header (server-to-server calls,
 *   curl, mobile app webviews in some configurations, health checks).
 * - Rejects any browser Origin not present in the configured allow-list.
 * - Credentials are enabled because the API issues httpOnly cookies
 *   and/or relies on Authorization headers from authenticated clients.
 */

const allowedOrigins = new Set(env.cors.origins ?? []);

const isDevLocalOrigin = (origin) => {
  if (env.app.nodeEnv !== 'development') {
    return false;
  }
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin) || isDevLocalOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS.'));
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    // FET-04 — carries only an opaque refresh-token id (not the
    // token itself) so GET /auth/sessions can mark which active
    // session is the caller's own current device.
    'X-Current-Token-Id',
  ],

  exposedHeaders: ['X-Request-ID'],

  maxAge: 600,

  optionsSuccessStatus: 204,
};

export default corsOptions;
