import apiClient from './apiClient.js';

/**
 * `GET /users` runs `.lean()` on the backend
 * (`modules/users/services/user.service.js`'s `listUsers`), which
 * skips Mongoose's `id` virtual and returns only `_id` — same
 * normalization shim `rolesService.js`/`staffService.js` already
 * apply for the same reason. Not needed before now because the only
 * caller (`OwnerDashboard`'s counts) never read `.id` off the items —
 * added for the all-accounts admin list, which does.
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}) };
};

/**
 * FET-05 — thin wrapper around the real backend admin user-management
 * endpoints (`server/src/modules/users/routes/user.routes.js`,
 * `users:read`/`users:write`). No mock data, no fake endpoints — see
 * master prompt section 69/§79.
 */
export const listUsers = async (params = {}) => {
  const { data } = await apiClient.get('/users', { params });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination };
};

export const getUser = async (id) => {
  const { data } = await apiClient.get(`/users/${id}`);
  return data.data;
};

/**
 * Administrator-provisioned account creation (never `PATIENT`, never
 * `SOFTWARE_OWNER` — enforced server-side by `blockProtectedRoleTarget`
 * and `ADMIN_ASSIGNABLE_ROLES`). No password is ever supplied by the
 * caller — the backend emails a password-setup link.
 */
export const createUser = async (payload) => {
  const { data } = await apiClient.post('/users', payload);
  return data.data;
};

export const updateUser = async (id, payload) => {
  const { data } = await apiClient.patch(`/users/${id}`, payload);
  return data.data;
};

export const changeUserRole = async (id, role) => {
  const { data } = await apiClient.patch(`/users/${id}/role`, { role });
  return data.data;
};

export const setUserStatus = async (id, status) => {
  const { data } = await apiClient.patch(`/users/${id}/status`, { status });
  return data.data;
};

/**
 * Admin-initiated password reset. Sends only `newPassword` — the
 * backend hashes it with Argon2id. The old password is NEVER read,
 * NEVER sent, and NEVER returned. All active sessions are revoked
 * server-side after a successful reset.
 */
export const resetUserPassword = async (id, newPassword) => {
  const { data } = await apiClient.post(`/users/${id}/reset-password`, {
    newPassword,
  });
  return data.data;
};

/**
 * Soft-delete: marks isDeleted=true, sets INACTIVE, revokes sessions.
 * For all roles — the record is archived but visible to Owner/SuperAdmin.
 */
export const deleteUser = async (id) => {
  const { data } = await apiClient.delete(`/users/${id}`);
  return data.data;
};

/**
 * Hard-delete (permanent): physically removes the user document from MongoDB.
 * Backend enforces this is only allowed for SOFTWARE_OWNER and SUPER_ADMIN.
 */
export const hardDeleteUser = async (id) => {
  const { data } = await apiClient.delete(`/users/${id}?hardDelete=true`);
  return data.data;
};

/**
 * Restore a soft-deleted user account.
 * Backend enforces this is only allowed for SOFTWARE_OWNER and SUPER_ADMIN.
 */
export const restoreUser = async (id) => {
  const { data } = await apiClient.post(`/users/${id}/restore`);
  return data.data;
};
