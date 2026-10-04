import Joi from 'joi';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({
    'string.pattern.base': 'Invalid identifier.',
  });

export const requestAccountDeletionSchema = Joi.object({
  password: Joi.string().required(),
  reason: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const cancelAccountDeletionSchema = Joi.object({
  notes: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const processAccountDeletionSchema = Joi.object({
  approve: Joi.boolean().required(),
  notes: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const deletionRequestIdParamsSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const listDeletionRequestsQuerySchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'CANCELLED', 'APPROVED', 'REJECTED')
    .optional(),
  search: Joi.string().trim().max(150).optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
