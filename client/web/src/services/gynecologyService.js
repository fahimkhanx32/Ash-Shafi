import apiClient from './apiClient.js';

/**
 * FET-07 — thin wrapper around the real backend gynecology endpoints
 * (server/src/modules/gynecology, BET-07). No client-side mock data,
 * no duplicated authorization logic — every call still goes through
 * the backend's `SENSITIVE_RECORDS_READ`/`WRITE` + provider-based
 * access checks; a 403 here always means the backend actually denied
 * it, not a UI-only gate.
 */

export const getMyGynecologyRecord = async () => {
  const { data } = await apiClient.get('/gynecology/me');
  return data.data;
};

export const getGynecologyRecordByPatientProfileId = async (patientProfileId) => {
  const { data } = await apiClient.get(`/gynecology/patient/${patientProfileId}`);
  return data.data;
};

export const createGynecologyRecord = async (patientProfileId, payload) => {
  const { data } = await apiClient.post('/gynecology', { patientProfileId, ...payload });
  return data.data;
};

export const updateGynecologyRecord = async (id, payload) => {
  const { data } = await apiClient.patch(`/gynecology/${id}`, payload);
  return data.data;
};

const arraySection = (path) => ({
  add: async (id, payload) => {
    const { data } = await apiClient.post(`/gynecology/${id}/${path}`, payload);
    return data.data;
  },
  update: async (id, itemId, payload) => {
    const { data } = await apiClient.patch(`/gynecology/${id}/${path}/${itemId}`, payload);
    return data.data;
  },
  remove: async (id, itemId) => {
    const { data } = await apiClient.delete(`/gynecology/${id}/${path}/${itemId}`);
    return data.data;
  },
});

export const conditions = arraySection('conditions');
export const contraception = arraySection('contraception');
export const stiHistory = arraySection('sti-history');
export const cervicalScreenings = arraySection('cervical-screenings');
export const breastRecords = arraySection('breast-records');
export const procedures = arraySection('procedures');
