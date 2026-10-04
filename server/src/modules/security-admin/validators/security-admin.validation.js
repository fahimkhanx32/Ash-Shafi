import Joi from 'joi';

import { SECURITY_EVENT_TYPES } from '../../../auth/security-event.model.js';

const objectId = () => Joi.string().hex().length(24);

export const listSessionsAdminQuerySchema = Joi.object({
  userId: objectId().optional(),
  search: Joi.string().trim().max(200).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const sessionIdParamsSchema = Joi.object({
  sessionId: objectId().required(),
});

export const revokeSessionAdminBodySchema = Joi.object({
  reason: Joi.string().trim().min(10).max(500).required(),
});

export const userIdParamsSchema = Joi.object({
  userId: objectId().required(),
});

export const unlockAccountBodySchema = Joi.object({
  reason: Joi.string().trim().min(10).max(500).required(),
});

export const securityEventsAdminQuerySchema = Joi.object({
  userId: objectId().optional(),
  type: Joi.string()
    .valid(...Object.values(SECURITY_EVENT_TYPES))
    .optional(),
  ipAddress: Joi.string().trim().max(100).optional(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
