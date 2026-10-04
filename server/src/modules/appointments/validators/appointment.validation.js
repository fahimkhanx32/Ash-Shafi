import Joi from 'joi';

import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_VISIT_TYPES,
  APPOINTMENT_CONSULTATION_MODES,
} from '../models/appointment.model.js';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const appointmentIdParamSchema = Joi.object({ id: mongoIdSchema.required() });

export const bookAppointmentSchema = Joi.object({
  patientProfileId: mongoIdSchema.allow(null),
  doctorId: mongoIdSchema.required(),
  scheduledStart: Joi.date().iso().required(),
  visitType: Joi.string().valid(...APPOINTMENT_VISIT_TYPES),
  consultationMode: Joi.string().valid(...APPOINTMENT_CONSULTATION_MODES),
  reasonForVisit: Joi.string().trim().max(500).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});

export const rescheduleAppointmentSchema = Joi.object({
  scheduledStart: Joi.date().iso().required(),
  reason: Joi.string().trim().max(500).allow(''),
});

export const cancelAppointmentSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

export const noShowAppointmentSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

export const listAppointmentsQuerySchema = Joi.object({
  doctorId: mongoIdSchema.allow(''),
  patientProfileId: mongoIdSchema.allow(''),
  status: Joi.string().valid(...APPOINTMENT_STATUSES).allow(''),
  from: Joi.date().iso().allow(''),
  to: Joi.date().iso().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const myAppointmentsQuerySchema = Joi.object({
  status: Joi.string().valid(...APPOINTMENT_STATUSES).allow(''),
  from: Joi.date().iso().allow(''),
  to: Joi.date().iso().allow(''),
});
