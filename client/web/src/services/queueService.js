import apiClient from './apiClient.js';

/**
 * FET-09 — thin wrapper around the real backend queue endpoints
 * (`server/src/modules/queue/routes/queue.routes.js`, BET-10).
 * Every route on the backend is `staffOnly` (see that file's own
 * doc comment) — a PATIENT actor calling any of these gets a real
 * 403, not a UI-only block, but the queue page itself is also kept
 * out of a patient's nav/routes as a UX courtesy.
 */

export const checkIn = async (appointmentId, { notes = '' } = {}) => {
  const { data } = await apiClient.post(`/queue/check-in/${appointmentId}`, { notes });
  return data.data;
};

// Returns a flat array of today's queue entries for this doctor, in
// token order. Each entry already carries a live-computed `position`
// among WAITING entries (queue.service.js's `getTodayQueue`), never
// a stored counter, so it can't drift out of sync with reality.
export const getTodayQueue = async (doctorId, { date } = {}) => {
  const { data } = await apiClient.get(`/queue/today/${doctorId}`, { params: date ? { date } : {} });
  return data.data || [];
};

/**
 * FET-12 (Patient Portal) — "Queue status" self-service. Unlike
 * every other function in this file, this one route is NOT
 * `staffOnly` on the backend (see `queue.routes.js`'s `/me/:appointmentId`,
 * registered before the router's `staffOnly` gate) — ownership is
 * enforced server-side by re-using `appointment.service.js`'s own
 * access check. Returns `null` when the appointment hasn't been
 * checked in yet, which is a normal state, not an error.
 */
export const getMyQueueStatus = async (appointmentId) => {
  const { data } = await apiClient.get(`/queue/me/${appointmentId}`);
  return data.data || null;
};

export const getQueueEntry = async (id) => {
  const { data } = await apiClient.get(`/queue/${id}`);
  return data.data;
};

export const callPatient = async (id) => {
  const { data } = await apiClient.post(`/queue/${id}/call`);
  return data.data;
};

export const startConsultation = async (id) => {
  const { data } = await apiClient.post(`/queue/${id}/start-consultation`);
  return data.data;
};

export const completeConsultation = async (id) => {
  const { data } = await apiClient.post(`/queue/${id}/complete`);
  return data.data;
};

export const markQueueNoShow = async (id, { reason = '' } = {}) => {
  const { data } = await apiClient.post(`/queue/${id}/no-show`, { reason });
  return data.data;
};
