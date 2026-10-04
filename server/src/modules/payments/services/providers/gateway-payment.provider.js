import crypto from 'crypto';
import axios from 'axios';

import env from '../../../../config/env.js';
import { logger } from '../../../../config/logger.js';

/**
 * BET-15.2 — Provider-agnostic online gateway (`CARD`,
 * `MOBILE_FINANCIAL_SERVICE`, `ONLINE_GATEWAY` methods), driven
 * entirely by the existing `.env` `PAYMENT_*` variables (master
 * prompt §11/§82 — never introduce new secrets or hardcode
 * credentials; these were already reserved in `.env`/`.env.example`
 * and wired into `config/env.js` as `env.payment`). Every one of
 * those variables is currently blank in this project's `.env`, so
 * `isConfigured()` correctly reports `false` and
 * `payment.service.js` refuses to fabricate a successful checkout —
 * see master prompt §36: never trust/never fake a "payment
 * successful" response.
 *
 * This deliberately does not hardcode a specific vendor's request/
 * response shape (bKash, Nagad, SSLCommerz, Stripe, etc. all differ).
 * When a specific gateway is chosen, replace the two request bodies
 * below with that gateway's actual API contract — the abstraction
 * boundary (`payment.service.js` only ever calls `createCheckout`/
 * `verifyWebhookSignature`/`parseWebhookEvent`/`processRefund`) does
 * not need to change.
 *
 * @type {import('./payment-provider.interface.js').PaymentProvider}
 */
export const gatewayPaymentProvider = {
  name: env.payment.provider || 'online_gateway',

  isConfigured: () =>
    Boolean(
      env.payment.provider &&
        env.payment.apiUrl &&
        env.payment.apiKey &&
        env.payment.apiSecret,
    ),

  createCheckout: async ({ amount, currency, invoiceId, patientId, metadata = {} }) => {
    if (!gatewayPaymentProvider.isConfigured()) {
      throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
    }

    const response = await axios.post(
      `${env.payment.apiUrl.replace(/\/$/, '')}/checkout`,
      {
        amount,
        currency,
        reference: invoiceId,
        metadata: { invoiceId, patientId, ...metadata },
      },
      {
        headers: {
          Authorization: `Bearer ${env.payment.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    return {
      providerReference: response.data.transactionId || response.data.id,
      redirectUrl: response.data.redirectUrl || null,
      clientSecret: response.data.clientSecret || null,
    };
  },

  /**
   * Signature verification uses a standard HMAC-SHA256-over-raw-body
   * scheme (the common pattern across most gateway webhook designs).
   * `env.payment.webhookSecret` must be set for this to ever return
   * `true` — an unconfigured/blank secret always fails closed.
   */
  verifyWebhookSignature: (rawBody, headers = {}) => {
    const secret = env.payment.webhookSecret;
    const signature = headers['x-payment-signature'] || headers['X-Payment-Signature'];

    if (!secret || !signature) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
    } catch {
      // Length mismatch etc. — never throw out of a security check.
      return false;
    }
  },

  parseWebhookEvent: (payload) => {
    const status = String(payload?.status || '').toUpperCase();

    return {
      providerTransactionId: payload?.transactionId || payload?.id,
      status: status === 'SUCCESS' || status === 'SUCCEEDED' || status === 'PAID' ? 'SUCCEEDED' : 'FAILED',
      amount: Number(payload?.amount ?? 0),
      currency: (payload?.currency || env.payment.currency || 'BDT').toUpperCase(),
    };
  },

  processRefund: async ({ providerTransactionId, amount }) => {
    if (!gatewayPaymentProvider.isConfigured()) {
      throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
    }

    const response = await axios.post(
      `${env.payment.apiUrl.replace(/\/$/, '')}/refunds`,
      { transactionId: providerTransactionId, amount },
      {
        headers: {
          Authorization: `Bearer ${env.payment.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    logger.info({ providerTransactionId }, 'Refund requested from payment gateway.');

    return {
      providerRefundId: response.data.refundId || response.data.id,
      status: response.data.status === 'completed' ? 'COMPLETED' : 'PROCESSING',
    };
  },
};
