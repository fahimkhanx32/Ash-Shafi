import Joi from 'joi';

import { FEE_SERVICE_TYPES } from '../models/fee.model.js';
import { INVOICE_STATUSES } from '../models/invoice.model.js';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const idParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

// ---- Fees ----

export const createFeeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  serviceType: Joi.string().valid(...FEE_SERVICE_TYPES).required(),
  description: Joi.string().trim().max(500).allow(''),
  amount: Joi.number().min(0).required(),
  currency: Joi.string().trim().length(3).uppercase(),
});

export const updateFeeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().max(500).allow(''),
  amount: Joi.number().min(0),
  currency: Joi.string().trim().length(3).uppercase(),
}).min(1);

export const listFeesQuerySchema = Joi.object({
  serviceType: Joi.string().valid(...FEE_SERVICE_TYPES),
  includeInactive: Joi.string().valid('true', 'false'),
});

// ---- Invoices ----

const invoiceItemSchema = Joi.object({
  description: Joi.string().trim().min(1).max(200).required(),
  serviceType: Joi.string().valid(...FEE_SERVICE_TYPES).required(),
  feeId: mongoIdSchema.allow(null, ''),
  unitPrice: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(1).default(1),
  discountAmount: Joi.number().min(0).default(0),
});

export const createInvoiceSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  items: Joi.array().items(invoiceItemSchema).min(1).required(),
  appointmentId: mongoIdSchema.allow(null, ''),
  encounterId: mongoIdSchema.allow(null, ''),
  dueDate: Joi.date().iso().allow(null),
  notes: Joi.string().trim().max(1000).allow(''),
  // Set when this invoice is being issued off a doctor's earlier
  // ChargeSuggestion (see charge-suggestion.validation below) — marks
  // that suggestion INVOICED and links it to the resulting invoice.
  // Never trusted to change what's actually charged; purely a
  // resolution link.
  chargeSuggestionId: mongoIdSchema.allow(null, ''),
});

export const applyDiscountSchema = Joi.object({
  itemId: mongoIdSchema.required(),
  discountAmount: Joi.number().min(0).required(),
});

// Same shape as one entry of `createInvoiceSchema.items` — a single
// line added to an invoice that already exists.
export const addInvoiceItemSchema = invoiceItemSchema;

export const invoiceItemIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
  itemId: mongoIdSchema.required(),
});

export const cancelInvoiceSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

export const listInvoicesQuerySchema = Joi.object({
  patientProfileId: mongoIdSchema,
  status: Joi.string().valid(...INVOICE_STATUSES),
  search: Joi.string().trim().max(50).allow(''),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const myInvoicesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// ---- Charge suggestions ----
// A doctor's lightweight "charge the patient for X" flag — see
// `models/charge-suggestion.model.js` for the full rationale.

export const createChargeSuggestionSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  serviceType: Joi.string().valid(...FEE_SERVICE_TYPES).required(),
  feeId: mongoIdSchema.allow(null, ''),
  appointmentId: mongoIdSchema.allow(null, ''),
  encounterId: mongoIdSchema.allow(null, ''),
  prescriptionId: mongoIdSchema.allow(null, ''),
  note: Joi.string().trim().max(500).allow(''),
});

export const listChargeSuggestionsQuerySchema = Joi.object({
  patientProfileId: mongoIdSchema,
  status: Joi.string().valid('PENDING', 'INVOICED', 'DISMISSED'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const dismissChargeSuggestionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});
