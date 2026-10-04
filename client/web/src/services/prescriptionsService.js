import apiClient from './apiClient.js';

/**
 * Service for communicating with prescription backend endpoints.
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, provider, delegatedStaff, ...rest } = doc;
  return {
    ...rest,
    ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}),
    ...(provider ? { provider: withId(provider) } : {}),
    ...(delegatedStaff ? { delegatedStaff: withId(delegatedStaff) } : {}),
  };
};

export const listPrescriptions = async (params = {}) => {
  const { data } = await apiClient.get('/prescriptions', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta || {},
  };
};

export const listPrescriptionsByPatient = async (patientProfileId) => {
  const { data } = await apiClient.get(`/prescriptions/patient/${patientProfileId}`);
  return (data.data || []).map(withId);
};

export const getMyPrescriptions = async () => {
  const { data } = await apiClient.get('/prescriptions/me');
  return (data.data || []).map(withId);
};

export const getPrescription = async (id) => {
  const { data } = await apiClient.get(`/prescriptions/${id}`);
  return withId(data.data);
};

export const getPrescriptionHistory = async (id) => {
  const { data } = await apiClient.get(`/prescriptions/${id}/history`);
  return (data.data || []).map(withId);
};

export const createPrescription = async (patientProfileId, payload) => {
  const { data } = await apiClient.post('/prescriptions', { patientProfileId, ...payload });
  return withId(data.data);
};

export const updatePrescription = async (id, payload) => {
  const { data } = await apiClient.patch(`/prescriptions/${id}`, payload);
  return withId(data.data);
};

export const finalizePrescription = async (id) => {
  const { data } = await apiClient.post(`/prescriptions/${id}/finalize`);
  return withId(data.data);
};

export const revisePrescription = async (id, reason, payload) => {
  const { data } = await apiClient.post(`/prescriptions/${id}/revise`, { reason, ...payload });
  return withId(data.data);
};

export const copyPrescription = async (id) => {
  const { data } = await apiClient.post(`/prescriptions/${id}/copy`);
  return withId(data.data);
};

export const cancelPrescription = async (id, reason) => {
  const { data } = await apiClient.post(`/prescriptions/${id}/cancel`, { reason });
  return withId(data.data);
};

export const archivePrescription = async (id, reason) => {
  const { data } = await apiClient.post(`/prescriptions/${id}/archive`, { reason });
  return withId(data.data);
};

export const deletePrescription = async (id, { hardDelete = false } = {}) => {
  const { data } = await apiClient.delete(`/prescriptions/${id}${hardDelete ? '?hardDelete=true' : ''}`);
  return data.data;
};

export const verifyPrescriptionToken = async (token) => {
  const { data } = await apiClient.get(`/prescriptions/verify/${token}`);
  return data.data;
};

export const getFavoriteMedicines = async () => {
  const { data } = await apiClient.get('/prescriptions/favorites/medicines');
  return data.data || [];
};

export const saveFavoriteMedicine = async (payload) => {
  const { data } = await apiClient.post('/prescriptions/favorites/medicines', payload);
  return data.data;
};

export const getPrescriptionPdfBlobUrl = async (id) => {
  const { data } = await apiClient.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' });
  return URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
};
