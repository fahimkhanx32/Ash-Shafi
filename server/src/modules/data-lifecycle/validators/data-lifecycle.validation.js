import Joi from 'joi';

import { getPurgeEligibleKeys } from '../policy/retention-policy.js';

// Resolved once at module load — the fixed, hand-written
// `PURGE_HANDLERS`/`PREVIEW_HANDLERS` map in the service is the real
// source of truth for what can actually run; this only needs to
// match it closely enough to give a clear 400 instead of a 500 for
// an unsupported category.
const purgeEligibleKeys = getPurgeEligibleKeys();

const categoriesQuerySchema = Joi.string()
  .trim()
  .custom((value, helpers) => {
    const parsed = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      return helpers.error('any.invalid');
    }

    return parsed;
  }, 'comma-separated category list')
  .optional();

export const previewQuerySchema = Joi.object({
  categories: categoriesQuerySchema,
});

export const purgeBodySchema = Joi.object({
  categories: Joi.array()
    .items(Joi.string().valid(...purgeEligibleKeys))
    .min(1)
    .optional()
    .messages({
      'any.only': `Each category must be one of: ${purgeEligibleKeys.join(', ')}.`,
    }),
  reason: Joi.string().trim().min(10).max(1000).required(),
  confirm: Joi.boolean().valid(true).required().messages({
    'any.only': 'confirm must be explicitly set to true to proceed.',
  }),
  password: Joi.string().required(),
});
