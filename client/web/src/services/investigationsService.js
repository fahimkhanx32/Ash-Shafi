import apiClient from './apiClient.js';

/**
 * FET-11 — thin wrapper around the real backend investigation
 * endpoints (`server/src/modules/investigations/routes/investigation.routes.js`,
 * BET-12), mounted at `/api/v1/investigations`. The order/schedule/
 * sample-collected/result-pending/cancel/reject lifecycle lives
 * entirely on the backend (`investigation.service.js`) — this file
 * never guesses what transition is allowed, it just calls the
 * matching endpoint and lets a rejection surface through
 * `extractApiError`, same convention `prescriptionsService.js`
 * (FET-10) established.
 *
 * `list`/`getMy` run `.lean()` on the backend, so `_id` → `id`
 * normalization is applied here (same pattern `prescriptionsService.js`/
 * `medicinesService.js` already use).
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, orderedBy, ...rest } = doc;
  return {
    ...rest,
    ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}),
    ...(orderedBy ? { orderedBy: withId(orderedBy) } : {}),
  };
};

export const orderInvestigation = async (patientProfileId, payload) => {
  const { data } = await apiClient.post('/investigations', { patientProfileId, ...payload });
  return withId(data.data);
};

export const listInvestigations = async (params = {}) => {
  const { data } = await apiClient.get('/investigations', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || null,
  };
};

export const listInvestigationsByPatient = async (patientProfileId) => {
  const { items } = await listInvestigations({ patientProfileId, limit: 100 });
  return items;
};

export const getMyInvestigations = async (params = {}) => {
  const { data } = await apiClient.get('/investigations/me', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || null,
  };
};

export const getInvestigation = async (id) => {
  const { data } = await apiClient.get(`/investigations/${id}`);
  return withId(data.data);
};

export const scheduleInvestigation = async (id, payload) => {
  const { data } = await apiClient.post(`/investigations/${id}/schedule`, payload);
  return withId(data.data);
};

export const markSampleCollected = async (id, reason = '') => {
  const { data } = await apiClient.post(`/investigations/${id}/sample-collected`, { reason });
  return withId(data.data);
};

export const markResultPending = async (id, reason = '') => {
  const { data } = await apiClient.post(`/investigations/${id}/result-pending`, { reason });
  return withId(data.data);
};

export const cancelInvestigation = async (id, reason = '') => {
  const { data } = await apiClient.post(`/investigations/${id}/cancel`, { reason });
  return withId(data.data);
};

export const rejectInvestigation = async (id, reason = '') => {
  const { data } = await apiClient.post(`/investigations/${id}/reject`, { reason });
  return withId(data.data);
};
