import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import env from '../config/env.js';
import { getRedisClient } from '../config/redis.js';

const commonOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message:
          'Too many requests. Please try again later.',
      },
    });
  },
};

const createStore = () => {
  if (!env.redis.enabled) {
    return undefined;
  }

  const client = getRedisClient();

  if (!client) {
    throw new Error(
      'Redis is enabled but the Redis client is not initialized.',
    );
  }

  if (!client.isReady) {
    throw new Error(
      'Redis is enabled but the Redis client is not ready.',
    );
  }

  return new RedisStore({
    sendCommand: (...args) => client.sendCommand(args),
  });
};

const store = createStore();

export const generalRateLimiter = rateLimit({
  ...commonOptions,

  windowMs: env.security.rateLimitWindowMs,

  limit: env.security.rateLimitMaxRequests,

  skip: (req) => {
    return req.path === '/health';
  },

  ...(store ? { store } : {}),
});

export const authRateLimiter = rateLimit({
  ...commonOptions,

  windowMs: env.security.rateLimitWindowMs,

  limit: env.security.authRateLimitMaxRequests,

  ...(store ? { store } : {}),
});

export const passwordResetRateLimiter = rateLimit({
  ...commonOptions,

  windowMs: env.security.rateLimitWindowMs,

  limit:
    env.security.passwordResetRateLimitMaxRequests,

  ...(store ? { store } : {}),
});

/**
 * Report intake (patient self-submission / staff upload on behalf).
 * Each accepted request stores a file of up to `reports.maxDocumentSizeMb`
 * and starts an OCR job, so it is far more expensive than an ordinary
 * API call. Keyed per authenticated user (falls back to IP) so one
 * patient cannot exhaust the OCR budget, while a front-desk user
 * uploading for many patients is limited on their own account only.
 */
export const reportIntakeRateLimiter = rateLimit({
  ...commonOptions,

  windowMs: 60 * 60 * 1000,

  limit: 60,

  keyGenerator: (req) =>
    req.user?._id ? `intake:${String(req.user._id)}` : ipKeyGenerator(req.ip),

  ...(store ? { store } : {}),
});
