import apiClient from './apiClient.js';

/**
 * FET-11 — thin wrapper around the real backend medical-report
 * endpoints (`server/src/modules/reports/routes/report.routes.js`,
 * BET-12), mounted at `/api/v1/reports`. Upload/OCR/extraction/
 * review/verify/finalize/amend state machine lives entirely on the
 * backend (`report.service.js`) — this file never guesses what
 * transition is allowed, same convention `investigationsService.js`
 * and `prescriptionsService.js` established.
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, orderingDoctor, ...rest } = doc;
  return {
    ...rest,
    ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}),
    ...(orderingDoctor ? { orderingDoctor: withId(orderingDoctor) } : {}),
  };
};

export const uploadReport = async (file, payload) => {
  const form = new FormData();
  form.append('file', file);
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') form.append(key, value);
  });
  const { data } = await apiClient.post('/reports', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return withId(data.data);
};

export const listReports = async (params = {}) => {
  const { data } = await apiClient.get('/reports', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || null,
  };
};

export const listReportsByPatient = async (patientProfileId) => {
  const { data } = await apiClient.get(`/reports/patient/${patientProfileId}`, { params: { limit: 100 } });
  return (data.data || []).map(withId);
};

export const getMyReports = async (params = {}) => {
  const { data } = await apiClient.get('/reports/me', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || null,
  };
};

export const getReport = async (id) => {
  const { data } = await apiClient.get(`/reports/${id}`);
  return withId(data.data);
};

/**
 * Streamed with `Content-Disposition: attachment`, so a plain
 * `<a href>` to the API URL would need the auth header the browser
 * can't attach — fetched as an authenticated blob instead, same
 * reason `prescriptionsService.getPrescriptionPdfBlobUrl` does this.
 * The caller owns the object URL's lifetime.
 */
export const getReportDownloadUrl = async (id) => {
  const { data, headers } = await apiClient.get(`/reports/${id}/download`, { responseType: 'blob' });
  const type = headers?.['content-type'] || 'application/octet-stream';
  return URL.createObjectURL(new Blob([data], { type }));
};

export const retryExtraction = async (id) => {
  const { data } = await apiClient.post(`/reports/${id}/retry-extraction`);
  return withId(data.data);
};

export const manualEntry = async (id, payload) => {
  const { data } = await apiClient.post(`/reports/${id}/manual-entry`, payload);
  return withId(data.data);
};

export const reviewParameter = async (id, parameterId, payload) => {
  const { data } = await apiClient.patch(`/reports/${id}/parameters/${parameterId}/review`, payload);
  return withId(data.data);
};

export const setInterpretation = async (id, interpretation) => {
  const { data } = await apiClient.patch(`/reports/${id}/interpretation`, { interpretation });
  return withId(data.data);
};

export const verifyReport = async (id) => {
  const { data } = await apiClient.post(`/reports/${id}/verify`);
  return withId(data.data);
};

export const finalizeReport = async (id) => {
  const { data } = await apiClient.post(`/reports/${id}/finalize`);
  return withId(data.data);
};

export const amendReport = async (id, payload) => {
  const { data } = await apiClient.post(`/reports/${id}/amend`, payload);
  return withId(data.data);
};

export const cancelReport = async (id, reason = '') => {
  const { data } = await apiClient.post(`/reports/${id}/cancel`, { reason });
  return withId(data.data);
};

export const rejectReport = async (id, reason = '') => {
  const { data } = await apiClient.post(`/reports/${id}/reject`, { reason });
  return withId(data.data);
};

export const acknowledgeDuplicate = async (id) => {
  const { data } = await apiClient.post(`/reports/${id}/duplicate-review`);
  return withId(data.data);
};

export const submitIntakeReport = async (file, payload) => {
  const form = new FormData();
  form.append('file', file);
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') form.append(key, value);
  });
  const { data } = await apiClient.post('/reports/intake', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return {
    report: withId(data.data?.report),
    routing: data.data?.routing || null,
  };
};

export const listIntake = async (params = {}) => {
  const { data } = await apiClient.get('/reports/intake', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || null,
  };
};

export const getIntakeSummary = async (params = {}) => {
  const { data } = await apiClient.get('/reports/intake/summary', { params });
  return data.data;
};

export const reviewIntake = async (id, { decision, note = '' }) => {
  const { data } = await apiClient.post(`/reports/intake/${id}/review`, { decision, note });
  return withId(data.data);
};

export const shareReport = async (id, { targetDoctorId, note = '' }) => {
  const { data } = await apiClient.post(`/reports/intake/${id}/share`, { targetDoctorId, note });
  return {
    report: withId(data.data?.report),
    routing: data.data?.routing || null,
  };
};
