import * as notificationService from '../services/notification.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';

export const listMyNotificationsController = async (req, res, next) => {
  try {
    const result = await notificationService.listMyNotifications(req.user, req.query);
    // FET-12 fix: `sendPaginated` only ever builds a `meta.pagination`
    // block, so the `unreadCount` the service already computes (see
    // `notification.service.js`'s `listMyNotifications`) was being
    // silently dropped — the notification bell had no way to render
    // an unread badge without either trusting a locally-derived guess
    // or issuing a second request. Build the envelope by hand instead
    // of via `sendPaginated` so `meta.unreadCount` rides alongside
    // `meta.pagination` in the same response.
    return sendSuccess(res, {
      message: 'Notifications retrieved successfully.',
      data: result.items,
      meta: {
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.limit > 0 ? Math.ceil(result.total / result.limit) : 0,
        },
        unreadCount: result.unreadCount,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const markNotificationReadController = async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationRead(req.params.id, req.user);
    return sendSuccess(res, {
      message: 'Notification marked as read.',
      data: notification,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const markAllNotificationsReadController = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user);
    return sendSuccess(res, {
      message: 'All notifications marked as read.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMyPreferencesController = async (req, res, next) => {
  try {
    const preferences = await notificationService.updateMyNotificationPreferences(req.user, req.body);
    return sendSuccess(res, {
      message: 'Notification preferences updated successfully.',
      data: preferences,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const createBroadcastNotificationController = async (req, res, next) => {
  try {
    const result = await notificationService.createBroadcastNotification(req.body, req.user);
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Broadcast notification dispatched.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
