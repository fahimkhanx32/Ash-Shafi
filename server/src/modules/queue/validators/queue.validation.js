import Joi from 'joi';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const doctorIdParamSchema = Joi.object({ doctorId: mongoIdSchema.required() });
export const queueEntryIdParamSchema = Joi.object({ id: mongoIdSchema.required() });
export const appointmentIdParamSchema = Joi.object({ appointmentId: mongoIdSchema.required() });

export const checkInSchema = Joi.object({
  notes: Joi.string().trim().max(500).allow(''),
});

export const noShowSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

export const todayQueueQuerySchema = Joi.object({
  date: Joi.date().iso().allow(''),
});
