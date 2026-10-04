import Joi from 'joi';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const departmentIdParamSchema = Joi.object({ id: mongoIdSchema.required() });

export const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().max(500).allow(''),
  headOfDepartment: mongoIdSchema.allow(null),
});

export const updateDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150),
  description: Joi.string().trim().max(500).allow(''),
  headOfDepartment: mongoIdSchema.allow(null),
}).min(1);

export const listDepartmentsQuerySchema = Joi.object({
  search: Joi.string().trim().max(200).allow(''),
  isActive: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});
