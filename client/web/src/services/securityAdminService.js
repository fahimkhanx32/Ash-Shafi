import apiClient from './apiClient.js';

/**
 * FET-20 — thin wrapper around the real `modules/security-admin`
 * backend (`server/src/modules/security-admin/routes/security-admin.routes.js`,
 * mounted at `/api/v1/security-admin`). Every function here maps to
 * exactly one real endpoint — no mock data, no fabricated shape (see
 * `modules/security-admin/README.md`'s own note on this).
 *
 * Read endpoints (`getSecurityDashboard`, `listSessions`,
 * `getAccountSecurity`, `listSecurityEvents`, `listSecurityAlerts`)
 * require `AUDIT_READ` server-side (`SECURITY_ADMIN_READ_ROLES` on
 * the frontend). The two mutating calls (`revokeSession`,
 * `unlockAccount`) require the stricter `SYSTEM_ADMIN` server-side —
 * calling them as any other role will 403 regardless of what the UI
 * shows, per this project's standing "UI hiding is UX only, the
 * backend is the real boundary" rule.
 */

export const getSecurityDashboard = async () => {
  const { data } = await apiClient.get('/security-admin/dashboard');
  return data.data;
};

export const listSessions = async ({ userId, search, page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/security-admin/sessions', {
    params: {
      ...(userId ? { userId } : {}),
      ...(search ? { search } : {}),
      page,
      limit,
    },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

/**
 * Revoking another user's session requires a reason (min 10 chars,
 * enforced server-side) — same confirmation-reason contract
 * `modules/backups`' restore endpoint already uses for high-impact
 * actions.
 */
export const revokeSession = async (sessionId, reason) => {
  const { data } = await apiClient.delete(`/security-admin/sessions/${sessionId}`, {
    data: { reason },
  });
  return data.data;
};

export const getAccountSecurity = async (userId) => {
  const { data } = await apiClient.get(`/security-admin/accounts/${userId}/security`);
  return data.data;
};

export const unlockAccount = async (userId, reason) => {
  const { data } = await apiClient.post(`/security-admin/accounts/${userId}/unlock`, { reason });
  return data.data;
};

export const listSecurityEvents = async ({ userId, type, ipAddress, from, to, page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/security-admin/events', {
    params: {
      ...(userId ? { userId } : {}),
      ...(type ? { type } : {}),
      ...(ipAddress ? { ipAddress } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page,
      limit,
    },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

export const listSecurityAlerts = async () => {
  const { data } = await apiClient.get('/security-admin/alerts');
  return data.data;
};
