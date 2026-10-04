import Joi from 'joi';
import { ROLES } from '../../../security/permissions.js';

const mongoIdSchema = Joi.string().hex().length(24);

export const notificationIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const listMyNotificationsQuerySchema = Joi.object({
  unreadOnly: Joi.boolean().default(false),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const updatePreferencesBodySchema = Joi.object({
  email: Joi.boolean(),
  sms: Joi.boolean(),
  whatsapp: Joi.boolean(),
}).min(1);

export const broadcastBodySchema = Joi.object({
  recipientIds: Joi.array().items(mongoIdSchema).min(1),
  role: Joi.string().valid(...Object.values(ROLES)),
  title: Joi.string().trim().min(2).max(200).required(),
  body: Joi.string().trim().min(2).max(500).required(),
})
  .xor('recipientIds', 'role')
  .messages({
    'object.missing': 'Either recipientIds or role is required.',
    'object.xor': 'Provide either recipientIds or role, not both.',
  });
