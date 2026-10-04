import Joi from 'joi';

import { PERMISSIONS } from '../../../security/permissions.js';

const ALL_PERMISSION_VALUES = Object.values(PERMISSIONS);

const permissionsSchema = Joi.array()
  .items(Joi.string().valid(...ALL_PERMISSION_VALUES))
  .unique()
  .default([]);

export const createRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(500).allow('').optional(),
  permissions: permissionsSchema,
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  description: Joi.string().trim().max(500).allow('').optional(),
  permissions: Joi.array()
    .items(Joi.string().valid(...ALL_PERMISSION_VALUES))
    .unique()
    .optional(),
}).min(1);

export const roleIdParamsSchema = Joi.object({
  id: Joi.string()
    .trim()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'Invalid role identifier.',
    }),
});

export const listRolesQuerySchema = Joi.object({
  includeInactive: Joi.string().valid('true', 'false').optional(),
});
