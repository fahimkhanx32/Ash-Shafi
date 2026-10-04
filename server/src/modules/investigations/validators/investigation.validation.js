import Joi from 'joi';

import {
  INVESTIGATION_CATEGORIES,
  INVESTIGATION_PRIORITIES,
  INVESTIGATION_STATUSES,
} from '../models/investigation.model.js';

/**
 * BET-12 validators. Mirrors `modules/appointments/validators/appointment.validation.js`
 * conventions.
 */

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const investigationIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const orderInvestigationSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  category: Joi.string()
    .valid(...INVESTIGATION_CATEGORIES)
    .required(),
  name: Joi.string().trim().min(2).max(200).required(),
  priority: Joi.string().valid(...INVESTIGATION_PRIORITIES),
  clinicalIndication: Joi.string().trim().max(500).allow(''),
  clinicalNotes: Joi.string().trim().max(1000).allow(''),
  encounterId: mongoIdSchema.allow(null, ''),
  appointmentId: mongoIdSchema.allow(null, ''),
  scheduledDate: Joi.date().iso().allow(null),
});

export const scheduleInvestigationSchema = Joi.object({
  scheduledDate: Joi.date().iso().required(),
  reason: Joi.string().trim().max(500).allow(''),
});

export const investigationTransitionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

export const listInvestigationsQuerySchema = Joi.object({
  patientProfileId: mongoIdSchema,
  doctorId: mongoIdSchema,
  category: Joi.string().valid(...INVESTIGATION_CATEGORIES),
  status: Joi.string().valid(...INVESTIGATION_STATUSES),
  // BET-12.29 — free-text search by investigation name; mirrors `reports`'
  // `search` filter.
  search: Joi.string().trim().max(100).allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const myInvestigationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
