import mongoose from 'mongoose';

import { Payment, PAYMENT_METHODS } from '../models/payment.model.js';
import { Refund } from '../models/refund.model.js';
import { manualPaymentProvider } from './providers/manual-payment.provider.js';
import { gatewayPaymentProvider } from './providers/gateway-payment.provider.js';
import * as invoiceService from '../../billing/services/invoice.service.js';
import { findInvoiceOrThrow } from '../../billing/services/invoice.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES, PERMISSIONS } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const MANUAL_METHODS = new Set(['CASH', 'BANK_TRANSFER']);

/**
 * Method → provider resolution. `CARD`/`MOBILE_FINANCIAL_SERVICE`/
 * `ONLINE_GATEWAY` all route through the same configurable gateway
 * abstraction (master prompt §36 "PaymentService" tree — Bangladesh
 * mobile-financial-service and card providers are both just
 * "providers" under one interface, distinguished by `method` on the
 * `Payment` record, not by a second code path).
 */
const resolveProvider = (method) =>
  MANUAL_METHODS.has(method) ? manualPaymentProvider : gatewayPaymentProvider;

const pushHistory = (doc, { action, actor, note = '' }) => {
  doc.history.push({ action, actor: actor?._id ?? null, note });
};

const generateReference = async (Model, field, prefix) => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const datedPrefix = `${prefix}-${y}${m}${d}`;

  const latest = await Model.findOne({ [field]: { $regex: `^${datedPrefix}-` } })
    .sort({ [field]: -1 })
    .select(field)
    .lean();

  let nextSequence = 1;
  if (latest?.[field]) {
    const match = latest[field].match(/-(\d{4})$/);
    if (match) nextSequence = parseInt(match[1], 10) + 1;
  }

  return `${datedPrefix}-${String(nextSequence).padStart(4, '0')}`;
};

export const findPaymentOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid payment id.', 400, { code: 'INVALID_ID' });
  }

  const payment = await Payment.findById(id);

  if (!payment) {
    throw new AppError('Payment not found.', 404, { code: 'PAYMENT_NOT_FOUND' });
  }

  return payment;
};

export const assertCanAccessAsSelf = (payment, actor) => {
  if (actor.role !== ROLES.PATIENT) return true;

  return Boolean(payment.patient) && String(payment.patient) === String(actor._id);
};

/**
 * A `PATIENT` may only ever initiate a payment against their own
 * invoice; any other authenticated role must hold `BILLING_WRITE`
 * (e.g. staff taking a phone/card payment on a patient's behalf).
 * Kept as an explicit branch here — rather than a route-level
 * `authorize()` — because `PATIENT` does not, and should not, carry
 * the general `BILLING_WRITE` permission (master prompt §80: the
 * backend decides, never the frontend).
 */
const assertCanInitiatePayment = (invoice, actor, hasPermissionFn) => {
  if (actor.role === ROLES.PATIENT) {
    if (String(invoice.patient?._id ?? invoice.patient) !== String(actor._id)) {
      throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
    }
    return;
  }

  if (!hasPermissionFn(actor.role, PERMISSIONS.BILLING_WRITE)) {
    throw new AppError('You do not have permission to perform this action.', 403, { code: 'FORBIDDEN' });
  }
};

/**
 * Starts an online (`CARD`/`MOBILE_FINANCIAL_SERVICE`/
 * `ONLINE_GATEWAY`) payment against an existing, unpaid/partially-paid
 * invoice. Creates a `PENDING` `Payment` up front — its status is
 * only ever advanced to `SUCCEEDED`/`FAILED` by `handleWebhook`
 * below, never by this function or by anything the client reports
 * back (master prompt §36).
 */
export const initiateOnlinePayment = async (
  invoiceId,
  { method, idempotencyKey },
  actor,
  hasPermissionFn,
) => {
  const invoice = await findInvoiceOrThrow(invoiceId);

  assertCanInitiatePayment(invoice, actor, hasPermissionFn);

  if (invoice.status === 'CANCELLED') {
    throw new AppError('Cannot pay a cancelled invoice.', 409, { code: 'INVOICE_CANCELLED' });
  }

  if (invoice.balanceDue <= 0) {
    throw new AppError('This invoice has no outstanding balance.', 409, { code: 'INVOICE_ALREADY_PAID' });
  }

  if (MANUAL_METHODS.has(method)) {
    throw new AppError(
      'Cash and bank-transfer payments must be recorded by staff, not initiated online.',
      400,
      { code: 'INVALID_PAYMENT_METHOD' },
    );
  }

  // Idempotent replay — a client retrying an initiate request (e.g.
  // after a dropped response) gets the original pending/succeeded
  // payment back instead of creating a duplicate transaction.
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) {
      return { payment: existing, checkout: null };
    }
  }

  const provider = resolveProvider(method);

  if (!provider.isConfigured()) {
    throw new AppError(
      'Online payments are not currently configured for this clinic. Please pay in person or by bank transfer.',
      503,
      { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
    );
  }

  const paymentReference = await generateReference(Payment, 'paymentReference', 'PAY');

  const checkout = await provider.createCheckout({
    amount: invoice.balanceDue,
    currency: invoice.currency,
    invoiceId: String(invoice._id),
    patientId: String(invoice.patient),
  });

  const payment = new Payment({
    paymentReference,
    invoice: invoice._id,
    patientProfile: invoice.patientProfile._id ?? invoice.patientProfile,
    patient: invoice.patient,
    amount: invoice.balanceDue,
    currency: invoice.currency,
    method,
    provider: provider.name,
    providerTransactionId: checkout.providerReference,
    idempotencyKey: idempotencyKey || null,
    status: 'PENDING',
    initiatedBy: actor._id,
    createdBy: actor._id,
  });

  pushHistory(payment, { action: 'INITIATED', actor, note: `Checkout started with ${provider.name}.` });

  await payment.save();

  logger.info({ paymentId: payment._id, invoiceId, method }, 'Online payment initiated.');

  return {
    payment,
    checkout: { redirectUrl: checkout.redirectUrl, clientSecret: checkout.clientSecret },
  };
};

/**
 * A staff-recorded `CASH`/`BANK_TRANSFER` payment. The act of an
 * authenticated, `BILLING_WRITE`-permitted staff member submitting
 * this request *is* the verification — there is no external system
 * to confirm against, so the payment is created and immediately
 * marked `SUCCEEDED`, matching master prompt §36's own description of
 * "administrator-triggered"/manually-reconciled flows.
 *
 * The `Payment` write and the `Invoice.amountPaid`/`balanceDue`/
 * `status` write are two documents in two collections that must never
 * be allowed to drift apart — a payment marked `SUCCEEDED` with the
 * invoice's balance never reduced (or vice versa) is a real financial
 * data-integrity bug, not a cosmetic one. Wrapped in a Mongo
 * transaction (`mongoose.startSession().withTransaction`) so the two
 * writes commit or roll back together; `invoiceService.applyPaymentToInvoice`
 * already accepted a `session` parameter for exactly this purpose, but
 * no caller was actually opening one before this fix — the plumbing
 * existed without the transaction it was built for.
 */
export const recordManualPayment = async (invoiceId, { amount, method, reference, notes }, actor) => {
  const invoice = await findInvoiceOrThrow(invoiceId);

  if (!MANUAL_METHODS.has(method)) {
    throw new AppError('Method must be CASH or BANK_TRANSFER for a manually recorded payment.', 400, {
      code: 'INVALID_PAYMENT_METHOD',
    });
  }

  if (invoice.status === 'CANCELLED') {
    throw new AppError('Cannot record a payment against a cancelled invoice.', 409, { code: 'INVOICE_CANCELLED' });
  }

  if (amount > invoice.balanceDue) {
    throw new AppError('Payment amount exceeds the invoice balance due.', 400, { code: 'AMOUNT_EXCEEDS_BALANCE' });
  }

  const paymentReference = await generateReference(Payment, 'paymentReference', 'PAY');

  const payment = new Payment({
    paymentReference,
    invoice: invoice._id,
    patientProfile: invoice.patientProfile._id ?? invoice.patientProfile,
    patient: invoice.patient,
    amount,
    currency: invoice.currency,
    method,
    provider: 'manual',
    providerTransactionId: reference || null,
    status: 'SUCCEEDED',
    initiatedBy: actor._id,
    verifiedBy: actor._id,
    verifiedAt: new Date(),
    createdBy: actor._id,
  });

  pushHistory(payment, { action: 'RECORDED', actor, note: notes || '' });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await payment.save({ session });
      await invoiceService.applyPaymentToInvoice(invoice._id, amount, actor, session);
    });
  } finally {
    await session.endSession();
  }

  logger.info({ paymentId: payment._id, invoiceId, amount, method }, 'Manual payment recorded.');

  return payment;
};

/**
 * Inbound gateway webhook. Signature-verified before anything in the
 * payload is trusted; idempotent on `providerTransactionId` so a
 * provider's at-least-once delivery retrying the same event can never
 * apply a payment twice (master prompt §36 "duplicate prevention").
 *
 * The idempotency re-check (`payment.status !== 'PENDING'`) and the
 * subsequent `Payment`/`Invoice` writes all happen inside the same
 * transaction, so two near-simultaneous deliveries of the same event
 * (a real possibility with at-least-once webhook delivery) can never
 * both pass the check and both apply the payment — MongoDB's
 * transaction write-conflict detection forces the loser to retry,
 * and on retry it sees the already-updated status and exits cleanly.
 */
export const handleWebhook = async (rawBody, headers) => {
  const provider = gatewayPaymentProvider;

  if (typeof provider.verifyWebhookSignature !== 'function' || !provider.verifyWebhookSignature(rawBody, headers)) {
    throw new AppError('Invalid webhook signature.', 401, { code: 'INVALID_WEBHOOK_SIGNATURE' });
  }

  let payload;
  try {
    payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError('Malformed webhook payload.', 400, { code: 'INVALID_WEBHOOK_PAYLOAD' });
  }

  const event = provider.parseWebhookEvent(payload);

  const session = await mongoose.startSession();
  let payment;
  let unknownTransaction = false;

  try {
    await session.withTransaction(async () => {
      payment = await Payment.findOne({ providerTransactionId: event.providerTransactionId }).session(session);

      if (!payment) {
        unknownTransaction = true;
        return;
      }

      // Idempotent — a payment already in a terminal state is left alone.
      if (payment.status !== 'PENDING') {
        return;
      }

      if (event.status === 'SUCCEEDED') {
        payment.status = 'SUCCEEDED';
        payment.verifiedAt = new Date();
        pushHistory(payment, { action: 'WEBHOOK_CONFIRMED', note: 'Confirmed via provider webhook.' });
        await payment.save({ session });

        await invoiceService.applyPaymentToInvoice(payment.invoice, payment.amount, null, session);
      } else {
        payment.status = 'FAILED';
        payment.failureReason = 'Provider reported a failed transaction.';
        pushHistory(payment, { action: 'WEBHOOK_FAILED', note: payment.failureReason });
        await payment.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }

  if (unknownTransaction) {
    // Unknown transaction — acknowledge without error so the provider
    // stops retrying, but do not fabricate a matching record.
    logger.warn({ providerTransactionId: event.providerTransactionId }, 'Webhook for unknown payment received.');
    return null;
  }

  return payment;
};

export const getPaymentById = async (id, actor) => {
  const payment = await findPaymentOrThrow(id);

  if (!assertCanAccessAsSelf(payment, actor)) {
    throw new AppError('Payment not found.', 404, { code: 'PAYMENT_NOT_FOUND' });
  }

  return payment;
};

export const getMyPayments = async (actor, { page = 1, limit = 20 } = {}) => {
  const filter = { patient: actor._id };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

export const listPayments = async ({ patientProfileId, invoiceId, status, method, page = 1, limit = 20 } = {}) => {
  const filter = {};

  if (patientProfileId) {
    if (!isValidObjectId(patientProfileId)) {
      throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
    }
    filter.patientProfile = patientProfileId;
  }

  if (invoiceId) {
    if (!isValidObjectId(invoiceId)) {
      throw new AppError('Invalid invoice id.', 400, { code: 'INVALID_ID' });
    }
    filter.invoice = invoiceId;
  }

  if (status) filter.status = status;
  if (method) filter.method = method;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

/**
 * Requests and, where possible, immediately processes a refund for a
 * `SUCCEEDED` payment. Manual-method payments are marked `COMPLETED`
 * directly (the refund itself — e.g. handing back cash — happens
 * outside the system, same as the original manual payment); gateway
 * payments call the provider's `processRefund`. Either way, a
 * `Refund` record and the underlying `Payment.status` /
 * `Invoice.amountPaid` are only ever updated here, never by a client
 * asserting a refund succeeded.
 */
export const refundPayment = async (paymentId, { amount, reason }, actor) => {
  const payment = await findPaymentOrThrow(paymentId);

  if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED') {
    throw new AppError('Only a succeeded payment can be refunded.', 409, { code: 'PAYMENT_NOT_REFUNDABLE' });
  }

  const alreadyRefunded = await Refund.aggregate([
    { $match: { payment: payment._id, status: 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const refundedSoFar = alreadyRefunded[0]?.total ?? 0;
  const remaining = payment.amount - refundedSoFar;

  if (amount > remaining) {
    throw new AppError('Refund amount exceeds the remaining refundable balance.', 400, {
      code: 'AMOUNT_EXCEEDS_REFUNDABLE',
    });
  }

  const refundReference = await generateReference(Refund, 'refundReference', 'RFND');

  const refund = new Refund({
    refundReference,
    payment: payment._id,
    invoice: payment.invoice,
    patientProfile: payment.patientProfile,
    amount,
    currency: payment.currency,
    reason,
    status: 'PROCESSING',
    requestedBy: actor._id,
  });

  await refund.save();

  const provider = resolveProvider(payment.method);

  try {
    if (MANUAL_METHODS.has(payment.method) || typeof provider.processRefund !== 'function') {
      refund.status = 'COMPLETED';
      refund.processedAt = new Date();
    } else {
      const result = await provider.processRefund({
        providerTransactionId: payment.providerTransactionId,
        amount,
      });
      refund.providerRefundId = result.providerRefundId;
      refund.status = result.status;
      if (result.status === 'COMPLETED') refund.processedAt = new Date();
    }
  } catch (error) {
    refund.status = 'FAILED';
    refund.failureReason = error.message || 'Refund request to provider failed.';
    await refund.save();
    logger.error({ paymentId, error: error.message }, 'Refund processing failed.');
    throw new AppError('Refund could not be processed at this time.', 502, { code: 'REFUND_PROVIDER_ERROR' });
  }

  await refund.save();

  if (refund.status === 'COMPLETED') {
    const session = await mongoose.startSession();
    try {
      // The external `provider.processRefund` call above is
      // deliberately outside any transaction (holding a DB
      // transaction open across a third-party network call is an
      // anti-pattern — it can hang or time out the transaction). Only
      // the two related, same-database writes that must never drift
      // apart (`Payment.status` and `Invoice.amountPaid`/`balanceDue`)
      // are wrapped here, once the refund's actual outcome is known.
      await session.withTransaction(async () => {
        payment.status = refundedSoFar + amount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        pushHistory(payment, { action: 'REFUNDED', actor, note: `Refund ${refundReference} completed.` });
        await payment.save({ session });

        await invoiceService.applyRefundToInvoice(payment.invoice, amount, actor, session);
      });
    } finally {
      await session.endSession();
    }
  }

  return refund;
};

/**
 * Cancels a `PENDING` online payment (an abandoned/never-completed
 * checkout) — the missing piece of the transaction lifecycle: without
 * this, a `PENDING` payment from an initiated-but-never-finished
 * gateway checkout stayed `PENDING` forever, with no way for the
 * patient to retry cleanly or for staff to write it off. A
 * `SUCCEEDED`/`FAILED`/already-`CANCELLED`/refunded payment can never
 * be cancelled through this path — those are terminal states reached
 * only via `handleWebhook`/`refundPayment`. Never touches the invoice
 * — a `PENDING` payment was never applied to `Invoice.amountPaid` in
 * the first place, so there is nothing to reverse.
 */
export const cancelPendingPayment = async (paymentId, { reason } = {}, actor) => {
  const payment = await findPaymentOrThrow(paymentId);

  if (!assertCanAccessAsSelf(payment, actor)) {
    throw new AppError('Payment not found.', 404, { code: 'PAYMENT_NOT_FOUND' });
  }

  if (payment.status !== 'PENDING') {
    throw new AppError('Only a pending payment can be cancelled.', 409, { code: 'PAYMENT_NOT_CANCELLABLE' });
  }

  payment.status = 'CANCELLED';
  payment.failureReason = reason || 'Cancelled before completion.';
  payment.updatedBy = actor._id;

  pushHistory(payment, { action: 'CANCELLED', actor, note: reason || '' });

  await payment.save();

  logger.info({ paymentId: payment._id }, 'Pending payment cancelled.');

  return payment;
};

export const getRefundsForPayment = (paymentId) => Refund.find({ payment: paymentId }).sort({ createdAt: -1 });

export { PAYMENT_METHODS };
