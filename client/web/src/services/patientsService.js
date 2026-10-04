import apiClient from './apiClient.js';

/**
 * FET-06 — thin wrapper around the real backend patient endpoints
 * (`server/src/modules/patients/routes/patient.routes.js`, BET-06).
 * No mock data, no fake endpoints, no client-side business logic —
 * every call goes straight through to `PATIENTS_READ`/`WRITE` and
 * `MEDICAL_RECORDS_READ`/`WRITE` authorization on the backend, and
 * the `medicalHistoryRedacted` flag on a returned profile always
 * reflects a real server-side redaction
 * (`modules/patients/utils/patient-access.util.js`), not a UI guess.
 */

export const listPatients = async (params = {}) => {
  const { data } = await apiClient.get('/patients', { params });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

export const getPatient = async (id, { includeUser = false } = {}) => {
  const { data } = await apiClient.get(`/patients/${id}`, {
    params: includeUser ? { includeUser: 'true' } : undefined,
  });
  return data.data;
};

export const getPatientByPatientId = async (patientId) => {
  const { data } = await apiClient.get(`/patients/patient-id/${patientId}`);
  return data.data;
};

export const getMyPatientProfile = async () => {
  const { data } = await apiClient.get('/patients/me');
  return data.data;
};

export const createMyPatientProfile = async (payload) => {
  const { data } = await apiClient.post('/patients/me', payload);
  return data.data;
};

export const updateMyPatientProfile = async (payload) => {
  const { data } = await apiClient.patch('/patients/me', payload);
  return data.data;
};

export const createPatient = async (payload) => {
  const { data } = await apiClient.post('/patients', payload);
  return data.data;
};

export const updatePatient = async (id, payload) => {
  const { data } = await apiClient.patch(`/patients/${id}`, payload);
  return data.data;
};

export const deactivatePatient = async (id) => {
  const { data } = await apiClient.delete(`/patients/${id}`);
  return data.data;
};

export const reactivatePatient = async (id) => {
  const { data } = await apiClient.patch(`/patients/${id}/reactivate`);
  return data.data;
};

/**
 * One add/update/remove trio per medical-history sub-resource,
 * matching the exact sub-paths `patient.routes.js` exposes — same
 * `arraySection` shape already established by `gynecologyService.js`
 * / `pregnancyService.js` so `ArrayRecordSection` can drive all of
 * them identically.
 */
const arraySection = (path) => ({
  add: async (id, payload) => {
    const { data } = await apiClient.post(`/patients/${id}/${path}`, payload);
    return data.data;
  },
  update: async (id, itemId, payload) => {
    const { data } = await apiClient.patch(`/patients/${id}/${path}/${itemId}`, payload);
    return data.data;
  },
  remove: async (id, itemId) => {
    const { data } = await apiClient.delete(`/patients/${id}/${path}/${itemId}`);
    return data.data;
  },
});

export const allergies = arraySection('allergies');
export const chronicConditions = arraySection('chronic-conditions');
export const surgeryHistory = arraySection('surgeries');
export const medicationHistory = arraySection('medications');
export const familyHistory = arraySection('family-history');
export const vaccinationHistory = arraySection('vaccinations');

// Social history is a single embedded object, not a list — one PATCH,
// no add/remove.
export const updateSocialHistory = async (id, payload) => {
  const { data } = await apiClient.patch(`/patients/${id}/social-history`, payload);
  return data.data;
};
