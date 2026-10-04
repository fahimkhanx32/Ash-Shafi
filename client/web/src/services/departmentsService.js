import apiClient from './apiClient.js';

/**
 * `GET /departments` runs `.lean()` on the backend
 * (`modules/departments/services/department.service.js`) for
 * list-query performance, which skips Mongoose's `id` virtual and
 * returns only `_id` — same normalization shim `rolesService.js`/
 * `staffService.js` already apply for the exact same reason.
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, headOfDepartment, ...rest } = doc;
  return {
    ...rest,
    ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}),
    ...(headOfDepartment ? { headOfDepartment: withId(headOfDepartment) } : {}),
  };
};

/**
 * Thin wrapper around `server/src/modules/departments`
 * (`users:read`/`users:write` — reused, see that module's route
 * file for why). Closes the "Departments as a real entity" gap
 * flagged in FET-04/05: an admin can now define, rename, and
 * deactivate departments here, rather than departments only ever
 * existing as free-text on a staff profile.
 */
export const listDepartments = async (params = {}) => {
  const { data } = await apiClient.get('/departments', { params });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination };
};

export const getDepartment = async (id) => {
  const { data } = await apiClient.get(`/departments/${id}`);
  return withId(data.data);
};

export const createDepartment = async (payload) => {
  const { data } = await apiClient.post('/departments', payload);
  return withId(data.data);
};

export const updateDepartment = async (id, payload) => {
  const { data } = await apiClient.patch(`/departments/${id}`, payload);
  return withId(data.data);
};

export const deactivateDepartment = async (id) => {
  const { data } = await apiClient.post(`/departments/${id}/deactivate`);
  return withId(data.data);
};

export const reactivateDepartment = async (id) => {
  const { data } = await apiClient.post(`/departments/${id}/reactivate`);
  return withId(data.data);
};
