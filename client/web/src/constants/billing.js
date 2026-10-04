/**
 * FET-12 (Patient Portal) / FET-15 (Billing & Payments) — mirrors the
 * backend enums exactly (`server/src/modules/billing/models/{invoice,fee}.model.js`,
 * `server/src/modules/payments/models/payment.model.js`) so the UI
 * never invents a status value the backend doesn't recognize —
 * same convention `constants/appointments.js` established.
 *
 * FET-15 — every label helper below now optionally accepts the real
 * `t` from `useTranslation()` and resolves through `billing.status.*`/
 * `billing.method.*`/`billing.serviceType.*`, falling back to the
 * plain English string when `t` is omitted or the key is missing —
 * exactly the `t(key, fallback)` pattern `constants/notifications.js`'s
 * `notificationTypeLabel` already established. Existing call sites
 * that don't pass `t` keep working unchanged.
 *
 * FET-17 — "Localized currency": the amount digits below now come
 * from `lib/numberFormat.js#formatCurrencyAmount` (locale-aware
 * grouping/decimals for en/bn) instead of a bare
 * `.toLocaleString(undefined, …)`, which always used the browser's
 * default locale rather than the app's selected language. The
 * "CODE amount" display shape (`formatMoney`'s existing signature and
 * every one of its 13 call sites) is unchanged.
 */
import { formatCurrencyAmount } from '../lib/numberFormat.js';

export const INVOICE_STATUSES = Object.freeze([
  'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED',
]);

export const PAYMENT_STATUSES = Object.freeze([
  'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED',
]);

export const REFUND_STATUSES = Object.freeze([
  'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED',
]);

export const PAYMENT_METHODS = Object.freeze(['CASH', 'CARD', 'MOBILE_FINANCIAL_SERVICE', 'BANK_TRANSFER', 'ONLINE_GATEWAY']);
export const ONLINE_PAYMENT_METHODS = Object.freeze(['CARD', 'MOBILE_FINANCIAL_SERVICE', 'ONLINE_GATEWAY']);
export const MANUAL_PAYMENT_METHODS = Object.freeze(['CASH', 'BANK_TRANSFER']);

export const FEE_SERVICE_TYPES = Object.freeze([
  'NEW_CONSULTATION', 'FOLLOW_UP_CONSULTATION', 'ONLINE_CONSULTATION', 'PROCEDURE', 'INVESTIGATION', 'OTHER',
]);

const INVOICE_STATUS_LABELS = {
  ISSUED: 'Issued',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
};

const PAYMENT_STATUS_LABELS = {
  PENDING: 'Pending',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
};

const REFUND_STATUS_LABELS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
};

const PAYMENT_METHOD_LABELS = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_FINANCIAL_SERVICE: 'Mobile financial service',
  BANK_TRANSFER: 'Bank transfer',
  ONLINE_GATEWAY: 'Online gateway',
};

const SERVICE_TYPE_LABELS = {
  NEW_CONSULTATION: 'New consultation',
  FOLLOW_UP_CONSULTATION: 'Follow-up consultation',
  ONLINE_CONSULTATION: 'Online consultation',
  PROCEDURE: 'Procedure',
  INVESTIGATION: 'Investigation',
  OTHER: 'Other',
};

export const invoiceStatusLabel = (status, t) => {
  const fallback = INVOICE_STATUS_LABELS[status] || status;
  if (typeof t !== 'function') return fallback;
  return t(`billing.status.invoice.${status}`, fallback);
};

export const paymentStatusLabel = (status, t) => {
  const fallback = PAYMENT_STATUS_LABELS[status] || status;
  if (typeof t !== 'function') return fallback;
  return t(`billing.status.payment.${status}`, fallback);
};

export const refundStatusLabel = (status, t) => {
  const fallback = REFUND_STATUS_LABELS[status] || status;
  if (typeof t !== 'function') return fallback;
  return t(`billing.status.refund.${status}`, fallback);
};

export const paymentMethodLabel = (method, t) => {
  const fallback = PAYMENT_METHOD_LABELS[method] || method;
  if (typeof t !== 'function') return fallback;
  return t(`billing.method.${method}`, fallback);
};

export const serviceTypeLabel = (type, t) => {
  const fallback = SERVICE_TYPE_LABELS[type] || type;
  if (typeof t !== 'function') return fallback;
  return t(`billing.serviceType.${type}`, fallback);
};

export const CHARGE_SUGGESTION_STATUSES = Object.freeze(['PENDING', 'INVOICED', 'DISMISSED']);

const CHARGE_SUGGESTION_STATUS_LABELS = {
  PENDING: 'Pending',
  INVOICED: 'Invoiced',
  DISMISSED: 'Dismissed',
};

export const chargeSuggestionStatusLabel = (status, t) => {
  const fallback = CHARGE_SUGGESTION_STATUS_LABELS[status] || status;
  if (typeof t !== 'function') return fallback;
  return t(`billing.status.chargeSuggestion.${status}`, fallback);
};

export const chargeSuggestionStatusVariant = (status) => {
  if (status === 'INVOICED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'DISMISSED') return 'neutral';
  return 'neutral';
};

export const invoiceStatusVariant = (status) => {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIALLY_PAID') return 'warning';
  if (status === 'ISSUED') return 'info';
  if (status === 'CANCELLED') return 'destructive';
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return 'neutral';
  return 'neutral';
};

export const paymentStatusVariant = (status) => {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'FAILED' || status === 'CANCELLED') return 'destructive';
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return 'neutral';
  return 'neutral';
};

export const refundStatusVariant = (status) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'PENDING' || status === 'PROCESSING') return 'warning';
  if (status === 'FAILED' || status === 'REJECTED') return 'destructive';
  return 'neutral';
};

/** Money is always a plain number in the API (BDT minor-unit-free, per Fee/Invoice models) — format for display only. */
export const formatMoney = (amount, currency = 'BDT') => {
  return `${currency} ${formatCurrencyAmount(amount)}`;
};
