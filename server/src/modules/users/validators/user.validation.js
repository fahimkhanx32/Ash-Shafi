import Joi from 'joi';

import { USER_ROLES, USER_STATUSES } from '../../../users/user.model.js';
import { ADMIN_ASSIGNABLE_ROLES } from '../services/user.service.js';

// Follows the same Mongo-id / query-pagination conventions already
// established in `modules/roles/validators` and
// `modules/staff/validators`.
const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({
    'string.pattern.base': 'Invalid identifier.',
  });

const usernameSchema = Joi.string()
  .trim()
  .lowercase()
  .min(3)
  .max(50)
  .pattern(/^[a-z0-9._-]+$/)
  .messages({
    'string.pattern.base':
      'Username may only contain letters, numbers, dots, underscores, and hyphens.',
  });

export const createUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().lowercase().email().required(),
  username: usernameSchema.required(),
  role: Joi.string()
    .valid(...ADMIN_ASSIGNABLE_ROLES)
    .required(),
  password: Joi.string().min(8).max(128).optional(),
});

export const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  email: Joi.string().trim().lowercase().email().optional(),
  username: usernameSchema.optional(),
}).min(1);

export const changeUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...ADMIN_ASSIGNABLE_ROLES)
    .required(),
});

export const setUserStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...USER_STATUSES)
    .required(),
});

export const userIdParamsSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const listUsersQuerySchema = Joi.object({
  role: Joi.string()
    .valid(...USER_ROLES)
    .optional(),
  status: Joi.string()
    .valid(...USER_STATUSES)
    .optional(),
  search: Joi.string().trim().max(150).optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  includeDeleted: Joi.boolean().optional(),
  onlyDeleted: Joi.boolean().optional(),
});

export const deleteUserQuerySchema = Joi.object({
  hardDelete: Joi.boolean().optional(),
});

/**
 * Admin-initiated password reset — the administrator supplies a NEW
 * password (or a generated temporary one from the frontend). The OLD
 * password is NEVER requested, NEVER returned, and NEVER stored
 * anywhere other than its Argon2id hash. The frontend must confirm
 * the action before calling this endpoint; the backend records an
 * audit event on every successful reset.
 *
 * Minimum strength mirrors the self-service reset validation already
 * in `auth/auth.validation.js` — keep both in sync when changing.
 */
export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters.',
      'string.max': 'Password must not exceed 128 characters.',
      'any.required': 'New password is required.',
    }),
});
