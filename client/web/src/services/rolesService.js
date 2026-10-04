import apiClient from './apiClient.js';

/**
 * `GET /roles` runs `.lean()` on the backend
 * (`modules/roles/services/role.service.js`'s `listRoles`) for
 * list-query performance, which skips Mongoose's `id` virtual and
 * returns only `_id` — unlike `getRole`/`createRole`/`updateRole`,
 * which return full documents and already have `.id`. Normalized
 * here so every role object the frontend touches has a reliable
 * `.id`, regardless of which endpoint it came from.
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}) };
};

/**
 * FET-05 — thin wrapper around `server/src/modules/roles`
 * (`roles:read`/`roles:write`). System roles (the 8 fixed
 * `ROLES` values) are mirrored into this same collection read-only —
 * `listRoles`/`getRole` return system + custom roles together; only
 * a custom role (`isSystem: false`) can actually be created/edited/
 * deleted through these endpoints (the backend rejects mutation of a
 * system role at the service layer regardless of what the UI shows).
 */
export const listRoles = async ({ includeInactive = false } = {}) => {
  const { data } = await apiClient.get('/roles', {
    params: { includeInactive: includeInactive ? 'true' : 'false' },
  });
  return (data.data || []).map(withId);
};

export const getRole = async (id) => {
  const { data } = await apiClient.get(`/roles/${id}`);
  return data.data;
};

export const createRole = async (payload) => {
  const { data } = await apiClient.post('/roles', payload);
  return data.data;
};

export const updateRole = async (id, payload) => {
  const { data } = await apiClient.patch(`/roles/${id}`, payload);
  return data.data;
};

export const deleteRole = async (id) => {
  const { data } = await apiClient.delete(`/roles/${id}`);
  return data;
};
