import apiClient from './apiClient.js';

/**
 * FET-03 — thin wrapper over the real `PATCH /auth/me/preferences`
 * endpoint (server/src/auth). No client-side mock — a preference
 * change made while offline/unauthenticated only ever lands in
 * localStorage (see `ThemeProvider.jsx`), never faked as "saved".
 */
export const updateMyPreferences = async (updates) => {
  const { data } = await apiClient.patch('/auth/me/preferences', updates);
  return data.data.user;
};
