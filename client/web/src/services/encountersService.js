import apiClient from './apiClient.js';

/**
 * FET-06/FET-08 — thin wrapper around the real backend encounter
 * endpoints (`server/src/modules/encounters/routes/encounter.routes.js`,
 * BET-09). FET-06 only needed the read paths for the patient
 * workspace's Consultations tab; FET-08 (the full consultation
 * workspace — create, examination/diagnosis/treatment-plan fields,
 * save draft, finalize, amend) adds the write paths here, matching
 * the routes 1:1. No mock data, no client-side business logic — the
 * backend's `MEDICAL_RECORDS_READ`/`WRITE` authorization and the
 * DRAFT→FINALIZED state machine (`encounter.service.js`) remain the
 * sole authority.
 */

export const listEncountersByPatient = async (patientProfileId) => {
  const { data } = await apiClient.get(`/encounters/patient/${patientProfileId}`);
  return data.data || [];
};

export const getMyEncounters = async () => {
  const { data } = await apiClient.get('/encounters/me');
  return data.data || [];
};

export const getEncounter = async (id) => {
  const { data } = await apiClient.get(`/encounters/${id}`);
  return data.data;
};

export const createEncounter = async (patientProfileId, payload) => {
  const { data } = await apiClient.post('/encounters', { patientProfileId, ...payload });
  return data.data;
};

export const updateEncounter = async (id, payload) => {
  const { data } = await apiClient.patch(`/encounters/${id}`, payload);
  return data.data;
};

export const finalizeEncounter = async (id) => {
  const { data } = await apiClient.post(`/encounters/${id}/finalize`);
  return data.data;
};

export const amendEncounter = async (id, reason, payload) => {
  const { data } = await apiClient.post(`/encounters/${id}/amend`, { reason, ...payload });
  return data.data;
};
