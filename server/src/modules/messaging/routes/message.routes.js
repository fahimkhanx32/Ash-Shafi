import express from 'express';

import {
  deleteMessageController,
  downloadMessageAttachmentController,
} from '../controllers/message.controller.js';
import * as messageValidation from '../validators/message.validation.js';
import { validateParams } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * Message-level (not conversation-nested) actions. A message id
 * uniquely identifies its conversation internally
 * (`message.service.js` re-derives and re-authorizes conversation
 * membership from the message itself), so these deliberately don't
 * need to be nested under `/conversations/:id/messages/:messageId` —
 * mirrors why `report.routes.js`'s `/:id/download` isn't nested
 * under a patient id either.
 */
const router = express.Router();

router.use(authenticate);

router.delete(
  '/:id',
  authorize(PERMISSIONS.MESSAGING_WRITE),
  validateParams(messageValidation.messageIdParamSchema),
  deleteMessageController,
);

router.get(
  '/:id/attachment',
  authorize(PERMISSIONS.MESSAGING_READ),
  validateParams(messageValidation.messageIdParamSchema),
  downloadMessageAttachmentController,
);

export default router;
