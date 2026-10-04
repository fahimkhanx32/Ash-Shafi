import apiClient from './apiClient.js';

/**
 * FET-07 — thin wrapper around the real backend obstetric/pregnancy
 * endpoints (server/src/modules/obstetrics, BET-08). Same access
 * model as gynecologyService.js — backend is authoritative.
 */

export const getMyPregnancyRecords = async () => {
  const { data } = await apiClient.get('/obstetrics/me');
  return data.data;
};

export const listPregnancyRecordsByPatientProfileId = async (patientProfileId) => {
  const { data } = await apiClient.get(`/obstetrics/patient/${patientProfileId}`);
  return data.data;
};

export const getPregnancyRecordById = async (id) => {
  const { data } = await apiClient.get(`/obstetrics/${id}`);
  return data.data;
};

export const createPregnancyRecord = async (patientProfileId, payload) => {
  const { data } = await apiClient.post('/obstetrics', { patientProfileId, ...payload });
  return data.data;
};

export const updatePregnancyRecord = async (id, payload) => {
  const { data } = await apiClient.patch(`/obstetrics/${id}`, payload);
  return data.data;
};

export const updateDelivery = async (id, payload) => {
  const { data } = await apiClient.patch(`/obstetrics/${id}/delivery`, payload);
  return data.data;
};

export const updatePostpartum = async (id, payload) => {
  const { data } = await apiClient.patch(`/obstetrics/${id}/postpartum`, payload);
  return data.data;
};

const arraySection = (path) => ({
  add: async (id, payload) => {
    const { data } = await apiClient.post(`/obstetrics/${id}/${path}`, payload);
    return data.data;
  },
  update: async (id, itemId, payload) => {
    const { data } = await apiClient.patch(`/obstetrics/${id}/${path}/${itemId}`, payload);
    return data.data;
  },
  remove: async (id, itemId) => {
    const { data } = await apiClient.delete(`/obstetrics/${id}/${path}/${itemId}`);
    return data.data;
  },
});

export const antenatalVisits = arraySection('antenatal-visits');
export const fetalObservations = arraySection('fetal-observations');
export const complications = arraySection('complications');
