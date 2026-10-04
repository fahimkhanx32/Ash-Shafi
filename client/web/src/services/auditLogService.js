import apiClient from './apiClient.js';

/**
 * FET-20 (minimal slice, pulled forward for FET-21) — thin wrapper
 * around `GET /api/v1/audit-logs/me`. Self-scoped only: returns
 * exactly the signed-in user's own recorded actions, nothing
 * cross-user. See `server/src/modules/audit-logs/routes/audit-log.routes.js`
 * for why this deliberately has no `AUDIT_READ` requirement.
 */
export const listMyAuditLogs = async ({ category, action, from, to, page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/audit-logs/me', {
    params: {
      ...(category ? { category } : {}),
      ...(action ? { action } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page,
      limit,
    },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};
