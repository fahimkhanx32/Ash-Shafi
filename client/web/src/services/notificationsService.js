import apiClient from './apiClient.js';

/**
 * FET-12 (Patient Portal) — thin wrapper around the real backend
 * notification endpoints (`server/src/modules/notifications/routes/
 * notification.routes.js`, BET-13), mounted at `/api/v1/notifications`.
 * Every route here is genuine self-service (`/me*`), reachable by any
 * authenticated user without a special permission — matches the
 * backend's own "notification preferences are a per-user setting, not
 * an administrative one" design.
 *
 * Deliberately no client-side polling/socket logic lives in this
 * file — it is a pure data-access layer. `NotificationsBell.jsx` and
 * `NotificationsPage.jsx` own their own polling interval, same
 * separation `preferencesService.js`/`ThemeProvider.jsx` already use
 * between "how to fetch" and "how often to refresh".
 */

const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: doc.id || (_id ? String(_id) : undefined) };
};

/**
 * `GET /notifications/me` uses the app-wide `sendPaginated`-shaped
 * envelope (`{ data: Notification[], meta: { pagination, unreadCount } }`)
 * — same shape as every other list endpoint in this app
 * (`prescriptionsService.js`, `investigationsService.js`, etc.), not
 * a bespoke `{items, total, unreadCount}` object nested under `data`.
 * `unreadCount` rides in `meta` alongside `pagination` (see the
 * matching fix in `notification.controller.js`'s
 * `listMyNotificationsController`).
 */
export const getMyNotifications = async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
  const { data } = await apiClient.get('/notifications/me', {
    params: { page, limit, ...(unreadOnly ? { unreadOnly: true } : {}) },
  });
  const pagination = data.meta?.pagination || null;
  return {
    items: (data.data || []).map(withId),
    total: pagination?.total ?? 0,
    unreadCount: data.meta?.unreadCount ?? 0,
    pagination,
  };
};

export const markNotificationRead = async (id) => {
  const { data } = await apiClient.patch(`/notifications/${id}/read`);
  return withId(data.data);
};

export const markAllNotificationsRead = async () => {
  const { data } = await apiClient.patch('/notifications/me/read-all');
  return data.data;
};

export const updateNotificationPreferences = async (preferences) => {
  const { data } = await apiClient.patch('/notifications/me/preferences', preferences);
  return data.data;
};
