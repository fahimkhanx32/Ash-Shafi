import Joi from 'joi';

import { CONSULTATION_MODES } from '../models/doctor-schedule.model.js';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const doctorIdParamSchema = Joi.object({ doctorId: mongoIdSchema.required() });
export const blockedDateIdParamSchema = Joi.object({ id: mongoIdSchema.required() });

const timeSchema = Joi.string()
  .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
  .messages({ 'string.pattern.base': 'Time must be in HH:mm 24-hour format.' });

const blockSchema = Joi.object({
  startTime: timeSchema.required(),
  endTime: timeSchema.required(),
});

const dayAvailabilitySchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  isActive: Joi.boolean().default(false),
  blocks: Joi.array().items(blockSchema).max(6).default([]),
});

export const upsertScheduleSchema = Joi.object({
  weeklyAvailability: Joi.array().items(dayAvailabilitySchema).length(7),
  slotDurationMinutes: Joi.number().integer().min(5).max(240),
  bufferMinutes: Joi.number().integer().min(0).max(120),
  consultationModes: Joi.array().items(Joi.string().valid(...CONSULTATION_MODES)).min(1),
  minBookingLeadMinutes: Joi.number().integer().min(0).max(10080),
  maxBookingHorizonDays: Joi.number().integer().min(1).max(365),
  timezone: Joi.string().trim().max(60),
  isActive: Joi.boolean(),
}).min(1);

export const availabilityQuerySchema = Joi.object({
  date: Joi.date().iso().required(),
});

export const createBlockedDateSchema = Joi.object({
  date: Joi.date().iso().required(),
  doctorId: mongoIdSchema.allow(null),
  reason: Joi.string().trim().max(300).allow(''),
  isRecurringYearly: Joi.boolean().default(false),
});

export const listBlockedDatesQuerySchema = Joi.object({
  doctorId: mongoIdSchema.allow(''),
  from: Joi.date().iso().allow(''),
  to: Joi.date().iso().allow(''),
});
