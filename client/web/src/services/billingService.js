import apiClient from './apiClient.js';

/**
 * FET-12 (Patient Portal) — thin wrapper around the real backend
 * billing endpoints (`server/src/modules/billing/routes/billing.routes.js`,
 * BET-15.1), mounted at `/api/v1/billing`. No client-side total
 * computation anywhere in this file — `subtotal`/`discountTotal`/
 * `grandTotal`/`amountPaid`/`balanceDue` are always server-computed
 * (`invoice.service.js`) and only ever read here, never derived.
 */

const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: doc.id || (_id ? String(_id) : undefined) };
};

// ---- Fees (price catalog) ----
// `GET /billing/fees` is open to any authenticated user (a patient
// must see prices before booking/paying) — see fee.routes.js.
export const listFees = async ({ serviceType, includeInactive = false } = {}) => {
  const { data } = await apiClient.get('/billing/fees', {
    params: { ...(serviceType ? { serviceType } : {}), ...(includeInactive ? { includeInactive: 'true' } : {}) },
  });
  return (data.data || []).map(withId);
};

export const createFee = async (payload) => {
  const { data } = await apiClient.post('/billing/fees', payload);
  return withId(data.data);
};

export const updateFee = async (id, payload) => {
  const { data } = await apiClient.patch(`/billing/fees/${id}`, payload);
  return withId(data.data);
};

export const setFeeActive = async (id, active) => {
  const { data } = await apiClient.post(`/billing/fees/${id}/${active ? 'activate' : 'deactivate'}`);
  return withId(data.data);
};

// ---- Invoices — patient self-service ----

export const getMyInvoices = async ({ page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/billing/invoices/me', { params: { page, limit } });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination || null };
};

export const getMyInvoice = async (id) => {
  const { data } = await apiClient.get(`/billing/invoices/me/${id}`);
  return withId(data.data);
};

// ---- Invoices — staff/admin (BILLING_READ/WRITE) ----

export const listInvoices = async (params = {}) => {
  const { data } = await apiClient.get('/billing/invoices', { params });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination || null };
};

export const getInvoice = async (id) => {
  const { data } = await apiClient.get(`/billing/invoices/${id}`);
  return withId(data.data);
};

export const createInvoice = async (payload) => {
  const { data } = await apiClient.post('/billing/invoices', payload);
  return withId(data.data);
};

export const applyDiscount = async (id, { itemId, discountAmount }) => {
  const { data } = await apiClient.patch(`/billing/invoices/${id}/discount`, { itemId, discountAmount });
  return withId(data.data);
};

export const cancelInvoice = async (id, { reason = '' } = {}) => {
  const { data } = await apiClient.post(`/billing/invoices/${id}/cancel`, { reason });
  return withId(data.data);
};

// ---- Charge suggestions ----
// A doctor's lightweight "charge the patient for X" flag for billing
// staff to pick up (BET-15 follow-up) — see the server's
// `charge-suggestion.model.js` for the full rationale. `createInvoice`
// above accepts an optional `chargeSuggestionId` in its payload to
// resolve one of these once the real invoice is issued.

export const createChargeSuggestion = async (payload) => {
  const { data } = await apiClient.post('/billing/charge-suggestions', payload);
  return withId(data.data);
};

export const listChargeSuggestions = async (params = {}) => {
  const { data } = await apiClient.get('/billing/charge-suggestions', { params });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination || null };
};

export const dismissChargeSuggestion = async (id, { reason = '' } = {}) => {
  const { data } = await apiClient.post(`/billing/charge-suggestions/${id}/dismiss`, { reason });
  return withId(data.data);
};
