import Joi from 'joi';

import { PAYMENT_METHODS, PAYMENT_STATUSES } from '../models/payment.model.js';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const idParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

const ONLINE_METHODS = ['CARD', 'MOBILE_FINANCIAL_SERVICE', 'ONLINE_GATEWAY'];
const MANUAL_METHODS = ['CASH', 'BANK_TRANSFER'];

// ---- Payments ----

export const initiatePaymentSchema = Joi.object({
  invoiceId: mongoIdSchema.required(),
  method: Joi.string().valid(...ONLINE_METHODS).required(),
  // Optional — lets a client safely retry an interrupted `initiate`
  // call without risking a second, duplicate transaction (see
  // `payment.service.js`'s idempotency-key replay handling).
  idempotencyKey: Joi.string().trim().max(100),
});

export const recordManualPaymentSchema = Joi.object({
  invoiceId: mongoIdSchema.required(),
  amount: Joi.number().positive().required(),
  method: Joi.string().valid(...MANUAL_METHODS).required(),
  reference: Joi.string().trim().max(200).allow(''),
  notes: Joi.string().trim().max(500).allow(''),
});

export const refundPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: Joi.string().trim().min(1).max(500).required(),
});

export const cancelPaymentSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

export const listPaymentsQuerySchema = Joi.object({
  patientProfileId: mongoIdSchema,
  invoiceId: mongoIdSchema,
  status: Joi.string().valid(...PAYMENT_STATUSES),
  method: Joi.string().valid(...PAYMENT_METHODS),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const myPaymentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
