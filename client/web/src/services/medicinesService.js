import apiClient from './apiClient.js';

/**
 * FET-10 — thin wrapper around the real backend medicine-catalog
 * endpoints (`server/src/modules/medicines/routes/medicine.routes.js`,
 * BET-11), mounted at `/api/v1/medicines`. `listMedicines` runs
 * `.lean()` on the backend for list-query performance (same reason
 * `departmentsService.js`/`rolesService.js` normalize `_id` → `id`
 * themselves) — `getMedicine`/`createMedicine`/`updateMedicine` return
 * a full Mongoose document, which already serializes an `id` virtual,
 * but `withId` is applied everywhere anyway so every call site can
 * rely on `.id` unconditionally. No mock data — every field mirrors
 * `medicine.model.js` exactly (dosage forms/routes/verification
 * statuses are read from `constants/prescriptions.js`, itself copied
 * from that model, never hardcoded a second time).
 */
const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, ...(doc.id ? { id: doc.id } : _id ? { id: String(_id) } : {}) };
};

export const listMedicines = async (params = {}) => {
  const { data } = await apiClient.get('/medicines', { params });
  return {
    items: (data.data || []).map(withId),
    pagination: data.meta?.pagination || { page: 1, limit: 20, total: 0 },
  };
};

export const getMedicine = async (id) => {
  const { data } = await apiClient.get(`/medicines/${id}`);
  return withId(data.data);
};

export const createMedicine = async (payload) => {
  const { data } = await apiClient.post('/medicines', payload);
  return withId(data.data);
};

export const updateMedicine = async (id, payload) => {
  const { data } = await apiClient.patch(`/medicines/${id}`, payload);
  return withId(data.data);
};

export const deactivateMedicine = async (id) => {
  const { data } = await apiClient.post(`/medicines/${id}/deactivate`);
  return withId(data.data);
};

export const reactivateMedicine = async (id) => {
  const { data } = await apiClient.post(`/medicines/${id}/reactivate`);
  return withId(data.data);
};

export const softDeleteMedicine = async (id) => {
  const { data } = await apiClient.post(`/medicines/${id}/delete`);
  return withId(data.data);
};

export const hardDeleteMedicine = async (id) => {
  const { data } = await apiClient.delete(`/medicines/${id}`);
  return withId(data.data);
};

export const restoreMedicine = async (id) => {
  const { data } = await apiClient.post(`/medicines/${id}/restore`);
  return withId(data.data);
};

/**
 * Prescription-writing autocomplete — backs `MedicineRxBuilder.jsx`'s
 * search box. Separate from `listMedicines` (the admin catalog table):
 * hits `GET /medicines/autocomplete`, a prefix-ranked, tightly-capped
 * query tuned for typing speed rather than `listMedicines`' paginated
 * substring search.
 */
export const autocompleteMedicines = async (q, limit = 10) => {
  if (!q || !q.trim()) return [];
  const { data } = await apiClient.get('/medicines/autocomplete', { params: { q, limit } });
  return (data.data || []).map(withId);
};

/**
 * Bulk medicine-database import (spec item 4). Accepts either a plain
 * JSON payload (`{ origin, sourceVersion, records: [...] }`) or a File
 * object (CSV/JSON), in which case it's sent as multipart form-data.
 * Restricted server-side to Software Owner/Super Admin.
 */
export const importMedicines = async ({ origin, sourceVersion, records, file } = {}) => {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    if (origin) formData.append('origin', origin);
    if (sourceVersion) formData.append('sourceVersion', sourceVersion);
    const { data } = await apiClient.post('/medicines/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  }
  const { data } = await apiClient.post('/medicines/import', { origin, sourceVersion, records });
  return data.data;
};

