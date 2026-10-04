import crypto from 'crypto';

import env from '../../../../config/env.js';
import { isWhatsAppConfigured } from '../../../../integrations/whatsapp/whatsapp.service.js';

/**
 * BET-16 Checkpoint 3 — wraps the existing WhatsApp Cloud API service
 * (`integrations/whatsapp/whatsapp.service.js`, built in BET-13) as an
 * `IntegrationProvider` for the admin integrations registry. This file
 * adds no new sending capability — it only exposes non-secret status.
 *
 * Checkpoint 4 adds `isWebhookConfigured`/`verifyWebhookSignature`/
 * `verifyWebhookChallenge` for the inbound webhook receiver in
 * `webhook.controller.js`. Mirrors the HMAC pattern already
 * established by
 * `modules/payments/services/providers/gateway-payment.provider.js`'s
 * `verifyWebhookSignature`, adapted to Meta's actual header format
 * (`X-Hub-Signature-256: sha256=<hex>`).
 */
export const whatsappIntegration = {
  key: 'WHATSAPP',
  label: 'WhatsApp Business',
  isConfigured: () => isWhatsAppConfigured,
  describe: () => ({
    provider: env.whatsapp.provider || null,
    configured: isWhatsAppConfigured,
    // Non-secret identifiers only — never accessToken/apiUrl auth.
    phoneNumberId: env.whatsapp.phoneNumberId
      ? `${env.whatsapp.phoneNumberId.slice(0, 4)}****`
      : null,
    businessAccountId: env.whatsapp.businessAccountId
      ? `${env.whatsapp.businessAccountId.slice(0, 4)}****`
      : null,
    webhookConfigured: Boolean(env.whatsapp.webhookVerifyToken && env.whatsapp.appSecret),
  }),

  isWebhookConfigured: () =>
    Boolean(env.whatsapp.webhookVerifyToken && env.whatsapp.appSecret),

  // Meta's GET handshake when a webhook is registered in the Meta
  // App dashboard: echoes `hub.challenge` back only if `hub.verify_token`
  // matches what was configured out-of-band.
  verifyWebhookChallenge: ({ mode, verifyToken }) =>
    mode === 'subscribe' &&
    Boolean(env.whatsapp.webhookVerifyToken) &&
    verifyToken === env.whatsapp.webhookVerifyToken,

  // Meta signs every inbound POST body with the app secret
  // (`X-Hub-Signature-256: sha256=<hex-hmac>`). Fails closed: no
  // secret configured or no/malformed header means "not verified",
  // never "assume trusted".
  verifyWebhookSignature: (rawBody, signatureHeader) => {
    if (!env.whatsapp.appSecret || !signatureHeader) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', env.whatsapp.appSecret)
      .update(rawBody)
      .digest('hex');
    const provided = String(signatureHeader).replace(/^sha256=/, '');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      // Length mismatch etc. — never throw out of a security check.
      return false;
    }
  },
};
