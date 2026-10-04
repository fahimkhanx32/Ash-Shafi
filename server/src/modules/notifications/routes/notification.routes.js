import express from 'express';

import {
  listMyNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  updateMyPreferencesController,
  createBroadcastNotificationController,
} from '../controllers/notification.controller.js';
import * as notificationValidation from '../validators/notification.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

router.use(authenticate);

/**
 * Self-service — every authenticated user may always read/manage
 * their own notifications and preferences, no permission beyond
 * authentication needed (master prompt §43: "notification
 * preferences" is a per-user setting, not an administrative one).
 */
router.get(
  '/me',
  validateQuery(notificationValidation.listMyNotificationsQuerySchema),
  listMyNotificationsController,
);

router.patch(
  '/me/read-all',
  markAllNotificationsReadController,
);

router.patch(
  '/me/preferences',
  validateBody(notificationValidation.updatePreferencesBodySchema),
  updateMyPreferencesController,
);

router.patch(
  '/:id/read',
  validateParams(notificationValidation.notificationIdParamSchema),
  markNotificationReadController,
);

/** Administrative broadcast — NOTIFICATIONS_MANAGE only. */
router.post(
  '/broadcast',
  authorize(PERMISSIONS.NOTIFICATIONS_MANAGE),
  validateBody(notificationValidation.broadcastBodySchema),
  createBroadcastNotificationController,
);

export default router;
