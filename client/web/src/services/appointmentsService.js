import apiClient from './apiClient.js';

/**
 * Thin wrapper around the real backend appointment endpoints
 * (`server/src/modules/appointments/routes/appointment.routes.js`,
 * BET-10). Field names copied exactly from
 * `appointment.validation.js` — do not rename.
 *
 * `listAppointmentsByPatient`/`getMyAppointments` were added in
 * FET-06 for the patient workspace's read-only Appointments tab;
 * everything else below (booking, confirm/cancel/reschedule/
 * no-show, staff list, history) is FET-09 — the full calendar/
 * booking/queue UI.
 */

export const listAppointmentsByPatient = async (patientProfileId, params = {}) => {
  const { data } = await apiClient.get('/appointments', {
    params: { patientProfileId, limit: 50, ...params },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

export const getMyAppointments = async (params = {}) => {
  const { data } = await apiClient.get('/appointments/me', { params });
  return data.data || [];
};

// FET-09 — staff-facing appointment list (calendar/day view), backed
// by `GET /appointments` (`staffOnly` on the backend router — a
// PATIENT actor should use `getMyAppointments` instead).
export const listAppointments = async (params = {}) => {
  const { data } = await apiClient.get('/appointments', { params });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

export const getAppointment = async (id) => {
  const { data } = await apiClient.get(`/appointments/${id}`);
  return data.data;
};

export const getAppointmentHistory = async (id) => {
  const { data } = await apiClient.get(`/appointments/${id}/history`);
  return data.data;
};

// `patientProfileId: null` lets a PATIENT actor book for themselves —
// the backend resolves their own profile in that case
// (`resolvePatientProfileForBooking`).
export const bookAppointment = async ({
  patientProfileId = null,
  doctorId,
  scheduledStart,
  visitType,
  consultationMode,
  reasonForVisit,
  notes,
}) => {
  const { data } = await apiClient.post('/appointments', {
    patientProfileId,
    doctorId,
    scheduledStart,
    visitType,
    consultationMode,
    reasonForVisit,
    notes,
  });
  return data.data;
};

export const confirmAppointment = async (id) => {
  const { data } = await apiClient.post(`/appointments/${id}/confirm`);
  return data.data;
};

export const cancelAppointment = async (id, { reason = '' } = {}) => {
  const { data } = await apiClient.post(`/appointments/${id}/cancel`, { reason });
  return data.data;
};

export const rescheduleAppointment = async (id, { scheduledStart, reason = '' }) => {
  const { data } = await apiClient.post(`/appointments/${id}/reschedule`, { scheduledStart, reason });
  return data.data;
};

export const markNoShow = async (id, { reason = '' } = {}) => {
  const { data } = await apiClient.post(`/appointments/${id}/no-show`, { reason });
  return data.data;
};
