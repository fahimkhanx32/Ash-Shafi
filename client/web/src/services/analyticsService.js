import apiClient from './apiClient.js';

/**
 * FET-21 — thin wrapper around the real backend analytics endpoint
 * (`server/src/modules/analytics/routes/analytics.routes.js`,
 * BET-20), mounted at `/api/v1/analytics`. A single parameterized
 * `GET /:domain` call, matching the backend's own "one route, six
 * domains" shape — no client-side aggregation of any kind; every
 * number rendered by `AnalyticsPage.jsx` comes straight from the
 * server's `{summary, breakdown, series}` response.
 *
 * `doctorId` is only meaningful for operational/appointments/queue —
 * passing it for billing/staff/clinical is harmless (the backend
 * simply ignores query params a given domain's service doesn't use)
 * but the caller should omit it there for a cleaner URL. A DOCTOR
 * caller's `doctorId` is always overwritten server-side to their own
 * id regardless of what's sent here (see the controller's own
 * docstring) — this file doesn't need to special-case that.
 */
export const getAnalytics = async (domain, { from, to, granularity, doctorId } = {}) => {
  const { data } = await apiClient.get(`/analytics/${domain}`, {
    params: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(granularity ? { granularity } : {}),
      ...(doctorId ? { doctorId } : {}),
    },
  });
  return data.data;
};
