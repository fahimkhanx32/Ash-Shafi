import apiClient from './apiClient.js';

/**
 * `GET /staff` and `GET /staff/doctors` run `.lean()` on the backend
 * for list-query performance (`modules/staff/services/staff.service.js`),
 * which — unlike every single-resource staff endpoint — skips
 * Mongoose's `id` virtual and returns only `_id`. Normalizing here
 * (rather than teaching every list consumer to fall back to `_id`)
 * keeps `profile.id`/`profile.user.id` reliable everywhere in the
 * frontend, matching what `getStaffProfile`/`createStaffProfile`
 * already return without this shim.
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, user, ...rest } = doc;
  return {
    ...rest,
    ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}),
    ...(user ? { user: withId(user) } : {}),
  };
};

/**
 * Thin wrapper around the real backend staff endpoint
 * (server/src/modules/staff/routes/staff.routes.js). GET /staff/me
 * is self-service: any authenticated staff member (including a
 * doctor) can fetch their own StaffProfile without needing the
 * broader `users:read` permission.
 */
export const getMyStaffProfile = async () => {
  const { data } = await apiClient.get('/staff/me');
  return data.data;
};

/**
 * PATCH /staff/me — self-service edit of the caller's own
 * StaffProfile (phone/address/gender/DOB, emergency contact, and for
 * doctors, `doctorDetails` including the Bangla name/degrees used on
 * the prescription letterhead). Deliberately narrower than
 * `updateStaffProfile` below — org-assigned fields (designation,
 * department, employment type/status) aren't accepted here and stay
 * admin-only.
 */
export const updateMyStaffProfile = async (payload) => {
  const { data } = await apiClient.patch('/staff/me', payload);
  return data.data;
};

/**
 * FET-05 — administrative staff/HR endpoints (`users:read`/`write`
 * on the backend). Every function here is a direct 1:1 wrapper
 * around a real `modules/staff` route — no client-side business
 * logic, no mock data.
 */
export const listStaffProfiles = async (params = {}) => {
  const { data } = await apiClient.get('/staff', { params });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination };
};

/**
 * Recovery-UI support: users whose `POST /users` (account creation)
 * succeeded but whose follow-up `POST /staff` (profile attach) never
 * did — see `AddStaffDialog`'s own error message and
 * `AttachStaffProfileDialog`. Flat list, no pagination — matches the
 * unpaginated `GET /staff/orphaned-users` backend response shape.
 */
export const listOrphanedStaffUsers = async () => {
  const { data } = await apiClient.get('/staff/orphaned-users');
  return (data.data || []).map(withId);
};

export const getStaffProfile = async (id) => {
  const { data } = await apiClient.get(`/staff/${id}`);
  return data.data;
};

export const createStaffProfile = async (payload) => {
  const { data } = await apiClient.post('/staff', payload);
  return data.data;
};

export const updateStaffProfile = async (id, payload) => {
  const { data } = await apiClient.patch(`/staff/${id}`, payload);
  return data.data;
};

export const setStaffEmploymentStatus = async (id, status) => {
  const { data } = await apiClient.patch(`/staff/${id}/employment-status`, { status });
  return data.data;
};

export const deactivateStaffProfile = async (id) => {
  const { data } = await apiClient.patch(`/staff/${id}/deactivate`);
  return data.data;
};

export const reactivateStaffProfile = async (id) => {
  const { data } = await apiClient.patch(`/staff/${id}/reactivate`);
  return data.data;
};

export const listDoctors = async (params = {}) => {
  const { data } = await apiClient.get('/staff/doctors', { params });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination };
};
