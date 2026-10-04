import Joi from 'joi';

import { DOSAGE_FORMS, ROUTES, VERIFICATION_STATUSES, MEDICINE_STATUSES } from '../models/medicine.model.js';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const medicineIdParamSchema = Joi.object({ id: mongoIdSchema.required() });

const sourceSchema = Joi.object({
  origin: Joi.string().trim().max(120),
  version: Joi.string().trim().max(60).allow(''),
  importDate: Joi.date().iso().allow(null),
  country: Joi.string().trim().max(60),
});

export const createMedicineSchema = Joi.object({
  genericName: Joi.string().trim().min(1).max(200).required(),
  brandName: Joi.string().trim().max(200).allow(''),
  manufacturer: Joi.string().trim().max(200).allow(''),
  dgdaCode: Joi.string().trim().max(60).allow('', null),
  packSize: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid(...MEDICINE_STATUSES),
  sourceVersion: Joi.string().trim().max(60).allow(''),
  lastSyncedAt: Joi.date().iso().allow(null),
  strength: Joi.string().trim().max(60).allow(''),
  unit: Joi.string().trim().max(20).allow(''),
  dosageForm: Joi.string().valid(...DOSAGE_FORMS),
  route: Joi.string().valid(...ROUTES),
  indications: Joi.array().items(Joi.string().trim().max(300)).max(30),
  contraindications: Joi.array().items(Joi.string().trim().max(300)).max(30),
  warnings: Joi.array().items(Joi.string().trim().max(300)).max(30),
  adverseEffects: Joi.array().items(Joi.string().trim().max(300)).max(30),
  interactions: Joi.array().items(Joi.string().trim().max(300)).max(30),
  alternatives: Joi.array().items(mongoIdSchema).max(20),
  price: Joi.number().min(0).allow(null),
  currency: Joi.string().trim().max(10),
  verificationStatus: Joi.string().valid(...VERIFICATION_STATUSES),
  source: sourceSchema,
  notes: Joi.string().trim().max(1000).allow(''),
});

export const updateMedicineSchema = createMedicineSchema
  .fork(['genericName'], (schema) => schema.optional())
  .min(1);

export const listMedicinesQuerySchema = Joi.object({
  search: Joi.string().trim().max(200).allow(''),
  dosageForm: Joi.string().valid(...DOSAGE_FORMS).allow(''),
  route: Joi.string().valid(...ROUTES).allow(''),
  isActive: Joi.boolean(),
  verificationStatus: Joi.string().valid(...VERIFICATION_STATUSES).allow(''),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

export const autocompleteMedicinesQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(200).required(),
  limit: Joi.number().integer().min(1).max(25).default(10),
});

// Each row of a bulk import — deliberately permissive on required
// fields (only genericName is required, same as createMedicineSchema)
// since real-world registered-drug exports are inconsistently
// populated; rows missing genericName are rejected per-row by the
// import service rather than failing the whole batch.
const importRowSchema = Joi.object({
  dgdaCode: Joi.string().trim().max(60).allow('', null),
  genericName: Joi.string().trim().max(200).allow(''),
  brandName: Joi.string().trim().max(200).allow(''),
  manufacturer: Joi.string().trim().max(200).allow(''),
  strength: Joi.string().trim().max(60).allow(''),
  unit: Joi.string().trim().max(20).allow(''),
  dosageForm: Joi.string().trim().max(60).allow(''),
  route: Joi.string().trim().max(60).allow(''),
  packSize: Joi.string().trim().max(100).allow(''),
  status: Joi.string().trim().max(40).allow(''),
}).unknown(true); // upstream exports commonly carry extra columns we don't model yet — ignored, not rejected

export const importMedicinesBodySchema = Joi.object({
  origin: Joi.string().trim().max(120).default('DGDA import'),
  sourceVersion: Joi.string().trim().max(60).allow('').default(''),
  records: Joi.array().items(importRowSchema).min(1).max(50000),
});

