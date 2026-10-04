import express from 'express';

import {
  createConversationController,
  getMyConversationsController,
  listConversationsForAdminController,
  getConversationController,
} from '../controllers/conversation.controller.js';
import {
  sendMessageController,
  listMessagesController,
  markConversationReadController,
} from '../controllers/message.controller.js';
import * as messageValidation from '../validators/message.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { isAdminTier } from '../services/conversation-access.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { receiveMessageAttachment } from './message-upload.middleware.js';

const router = express.Router();

router.use(authenticate);

/**
 * `GET /conversations` (the admin filtered roster) must stay
 * restricted to the three admin-tier roles specifically —
 * `PERMISSIONS.MESSAGING_READ` alone is not sufficient here, because
 * `PATIENT`/`DOCTOR` also hold that permission (for their own `/me`
 * conversations) and `listConversationsForAdmin()` trusts whatever
 * `patientProfileId`/`doctorId` filter it is given without re-
 * checking the caller's relationship to that pair. Without this
 * extra guard, an ordinary patient/doctor could pass an arbitrary
 * doctorId/patientProfileId and enumerate other people's
 * conversation metadata (master prompt §30/§80).
 */
const requireAdminTier = (req, res, next) => {
  if (!isAdminTier(req.user.role)) {
    return next(
      new AppError('You do not have permission to perform this action.', 403, {
        code: 'FORBIDDEN',
      }),
    );
  }
  return next();
};

/** Create (or idempotently fetch) a conversation. */
router.post(
  '/',
  authorize(PERMISSIONS.MESSAGING_WRITE),
  validateBody(messageValidation.createConversationBodySchema),
  createConversationController,
);

/** Patient/doctor self-service — their own conversations. */
router.get(
  '/me',
  authorize(PERMISSIONS.MESSAGING_READ),
  validateQuery(messageValidation.listMyConversationsQuerySchema),
  getMyConversationsController,
);

/** Admin-tier filtered roster — support/oversight only. */
router.get(
  '/',
  requireAdminTier,
  validateQuery(messageValidation.adminListConversationsQuerySchema),
  listConversationsForAdminController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.MESSAGING_READ),
  validateParams(messageValidation.conversationIdParamSchema),
  getConversationController,
);

/** Message history within a conversation. */
router.get(
  '/:id/messages',
  authorize(PERMISSIONS.MESSAGING_READ),
  validateParams(messageValidation.conversationIdParamSchema),
  validateQuery(messageValidation.listMessagesQuerySchema),
  listMessagesController,
);

/** Send a message (text, or an image/document/voice attachment). */
router.post(
  '/:id/messages',
  authorize(PERMISSIONS.MESSAGING_WRITE),
  validateParams(messageValidation.conversationIdParamSchema),
  receiveMessageAttachment,
  validateBody(messageValidation.sendMessageBodySchema),
  sendMessageController,
);

/** Mark every unread message addressed to the actor as read. */
router.post(
  '/:id/read',
  authorize(PERMISSIONS.MESSAGING_READ),
  validateParams(messageValidation.conversationIdParamSchema),
  markConversationReadController,
);

export default router;
