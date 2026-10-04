import Joi from 'joi';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const appointmentIdParamSchema = Joi.object({
  appointmentId: mongoIdSchema.required(),
});

export const sessionIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const endSessionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});
