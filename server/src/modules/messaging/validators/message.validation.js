import Joi from 'joi';
import { CLIENT_MESSAGE_TYPES } from '../models/message.model.js';

const mongoIdSchema = Joi.string().hex().length(24);

export const conversationIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const messageIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const createConversationBodySchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  doctorId: mongoIdSchema.required(),
});

export const listMyConversationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const adminListConversationsQuerySchema = Joi.object({
  patientProfileId: mongoIdSchema,
  doctorId: mongoIdSchema,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const listMessagesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(30),
});

/**
 * Validated against the `multipart/form-data` text fields only —
 * the attachment file itself is handled and cross-checked against
 * `messageType` separately in `routes/message.routes.js`'s
 * `receiveMessageAttachment` middleware (mirrors
 * `modules/reports/routes/report.routes.js`'s `receiveReportFile`),
 * since Joi has no clean way to validate "was a file uploaded"
 * against a sibling multer-populated field.
 */
export const sendMessageBodySchema = Joi.object({
  messageType: Joi.string().valid(...CLIENT_MESSAGE_TYPES).required(),
  content: Joi.string().trim().max(4000).allow(''),
  durationSeconds: Joi.number().integer().min(0).max(3600).allow(null),
});
