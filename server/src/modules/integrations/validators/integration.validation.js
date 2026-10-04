import Joi from 'joi';

export const keyParamSchema = Joi.object({
  key: Joi.string().trim().min(1).max(50).required(),
});

export const listLogsQuerySchema = Joi.object({
  integrationKey: Joi.string().trim().max(50),
  status: Joi.string().valid('SUCCESS', 'FAILURE', 'REJECTED'),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});
