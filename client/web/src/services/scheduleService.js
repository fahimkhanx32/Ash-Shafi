import apiClient from './apiClient.js';

/**
 * FET-09 — thin wrapper around the real backend schedule endpoints
 * (`server/src/modules/appointments/routes/schedule.routes.js`,
 * BET-10.1/10.2/10.3/10.7). Field names copied exactly from
 * `schedule.validation.js` — do not rename.
 */

// Mounted at the distinct top-level `/api/v1/schedules` prefix on the
// backend (`app.js`) — deliberately not nested under `/appointments`
// (a literal `/schedules` path segment would otherwise collide with
// `GET /appointments/:id`).
export const getDoctorSchedule = async (doctorId) => {
  const { data } = await apiClient.get(`/schedules/${doctorId}`);
  return data.data;
};

export const upsertDoctorSchedule = async (doctorId, payload) => {
  const { data } = await apiClient.put(`/schedules/${doctorId}`, payload);
  return data.data;
};

export const deactivateDoctorSchedule = async (doctorId) => {
  const { data } = await apiClient.post(`/schedules/${doctorId}/deactivate`);
  return data.data;
};

// `{ date, slots: [{ start, end, available }], reason }` — `reason`
// is a machine-readable code (e.g. `BLOCKED_DATE`, `NO_SCHEDULE`)
// explaining an empty `slots` array; see availability.service.js.
export const getAvailableSlots = async (doctorId, date) => {
  const { data } = await apiClient.get(`/schedules/${doctorId}/available-slots`, {
    params: { date },
  });
  return data.data;
};

export const listBlockedDates = async (params = {}) => {
  const { data } = await apiClient.get('/schedules/blocked-dates', { params });
  return data.data || [];
};

export const createBlockedDate = async ({ date, doctorId = null, reason = '', isRecurringYearly = false }) => {
  const { data } = await apiClient.post('/schedules/blocked-dates', {
    date,
    doctorId,
    reason,
    isRecurringYearly,
  });
  return data.data;
};

export const removeBlockedDate = async (id) => {
  const { data } = await apiClient.delete(`/schedules/blocked-dates/${id}`);
  return data.data;
};
