import apiClient from './apiClient.js';

/**
 * FET-12 (Patient Portal) — thin wrapper around the real backend
 * payment endpoints (`server/src/modules/payments/routes/payment.routes.js`,
 * BET-15.2), mounted at `/api/v1/payments`. Never invents a
 * "payment successful" state client-side — `status` on a returned
 * `Payment` is only ever what the server last wrote (staff manual
 * confirmation or a signature-verified gateway webhook).
 */

const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: doc.id || (_id ? String(_id) : undefined) };
};

/**
 * `method` must be one of the *online* methods (`CARD`,
 * `MOBILE_FINANCIAL_SERVICE`, `ONLINE_GATEWAY`) — `CASH`/
 * `BANK_TRANSFER` are staff-recorded only (`recordManualPayment`
 * below), matching `initiatePaymentSchema`'s own enum split.
 * `idempotencyKey` defaults to a fresh UUID per call so a dropped
 * response and a user-initiated retry never risk a duplicate
 * transaction against the same invoice.
 */
export const initiatePayment = async (invoiceId, method, idempotencyKey = crypto.randomUUID()) => {
  const { data } = await apiClient.post('/payments/initiate', { invoiceId, method, idempotencyKey });
  return {
    payment: withId(data.data?.payment),
    checkout: data.data?.checkout || null,
  };
};

/** Staff-only (`BILLING_WRITE`) — records a CASH/BANK_TRANSFER receipt. */
export const recordManualPayment = async (payload) => {
  const { data } = await apiClient.post('/payments/manual', payload);
  return withId(data.data);
};

export const getMyPayments = async ({ page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/payments/me', { params: { page, limit } });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination || null };
};

export const listPayments = async (params = {}) => {
  const { data } = await apiClient.get('/payments', { params });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination || null };
};

export const getPayment = async (id) => {
  const { data } = await apiClient.get(`/payments/${id}`);
  return withId(data.data);
};

export const cancelPendingPayment = async (id, { reason = '' } = {}) => {
  const { data } = await apiClient.post(`/payments/${id}/cancel`, { reason });
  return withId(data.data);
};

export const refundPayment = async (id, { amount, reason }) => {
  const { data } = await apiClient.post(`/payments/${id}/refund`, { amount, reason });
  return withId(data.data);
};

export const listRefunds = async (id) => {
  const { data } = await apiClient.get(`/payments/${id}/refunds`);
  return (data.data || []).map(withId);
};

/**
 * The receipt PDF is streamed with `Content-Disposition: inline`, so
 * it needs the auth header a bare `<a href>` can't attach — same
 * authenticated-blob pattern `prescriptionsService.js`'s
 * `getPrescriptionPdfBlobUrl` already established. Caller owns the
 * object URL's lifetime.
 */
export const getPaymentReceiptBlobUrl = async (id) => {
  const { data } = await apiClient.get(`/payments/${id}/receipt`, { responseType: 'blob' });
  return URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
};
