import apiClient from './apiClient.js';

const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, orderedBy, patient, ...rest } = doc;
  return {
    ...rest,
    ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}),
    ...(orderedBy ? { orderedBy: withId(orderedBy) } : {}),
    ...(patient ? { patient: withId(patient) } : {}),
  };
};

export const getTestCatalog = async () => {
  const { data } = await apiClient.get('/lab-requisitions/catalog');
  return data.data; // { tests, groups }
};

export const createRequisition = async (payload) => {
  const { data } = await apiClient.post('/lab-requisitions', payload);
  return withId(data.data);
};

export const updateRequisition = async (id, payload) => {
  const { data } = await apiClient.patch(`/lab-requisitions/${id}`, payload);
  return withId(data.data);
};

export const listReferringDoctors = async () => {
  const { data } = await apiClient.get('/lab-requisitions/referring-doctors');
  return data.data || []; // [{ id, name, qualifications, bmdc, chamberAddress, phone, specialization }]
};

export const getRequisition = async (id) => {
  const { data } = await apiClient.get(`/lab-requisitions/${id}`);
  return withId(data.data);
};

export const listRequisitions = async (params = {}) => {
  const { data } = await apiClient.get('/lab-requisitions', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || null,
  };
};

export const getMyRequisitions = async (params = {}) => {
  const { data } = await apiClient.get('/lab-requisitions/me', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || null,
  };
};

export const issueRequisition = async (id) => {
  const { data } = await apiClient.post(`/lab-requisitions/${id}/issue`);
  return withId(data.data);
};

export const cancelRequisition = async (id, reason = '') => {
  const { data } = await apiClient.post(`/lab-requisitions/${id}/cancel`, { reason });
  return withId(data.data);
};

export const listRequisitionsByPatient = async (patientProfileId, params = {}) => {
  const { data } = await apiClient.get('/lab-requisitions', {
    params: { patient: patientProfileId, ...params },
  });
  return (data.data || []).map(withId);
};

