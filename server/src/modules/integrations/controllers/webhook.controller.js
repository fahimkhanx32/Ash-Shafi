import { whatsappIntegration } from '../services/providers/whatsapp.integration.js';
import { recordIntegrationEvent } from '../services/integration-log.service.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-16 Checkpoint 4 — Inbound WhatsApp webhook.
 *
 * Two responsibilities, matching Meta's Cloud API webhook contract:
 *  - `GET` — one-time verification handshake performed by Meta when
 *    the webhook URL is registered in the App dashboard.
 *  - `POST` — actual event delivery (message status updates, inbound
 *    messages). Every POST is signature-verified before its contents
 *    are trusted, exactly like `payment.controller.js`'s
 *    `webhookController` already does for payment gateway callbacks.
 *
 * Failure handling (master prompt §55/§56, this checkpoint's
 * "Integration failure handling"): this handler never throws to
 * Express's default error handler and never leaks internals in its
 * response — every branch returns a small, safe JSON body and logs
 * the outcome via `recordIntegrationEvent`, which itself never throws.
 * A malformed/unverified webhook gets logged as `REJECTED`/`FAILURE`
 * and a fast 401/400, not a 500 or a stack trace.
 */

export const verifyWhatsAppWebhookController = async (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!whatsappIntegration.isWebhookConfigured()) {
    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'INBOUND_WEBHOOK',
      eventType: 'VERIFY_HANDSHAKE',
      status: 'REJECTED',
      httpStatus: 503,
      reason: 'WEBHOOK_NOT_CONFIGURED',
      ipAddress: req.ip,
    });
    return res.status(503).json({ success: false, message: 'Webhook is not configured.' });
  }

  if (whatsappIntegration.verifyWebhookChallenge({ mode, verifyToken })) {
    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'INBOUND_WEBHOOK',
      eventType: 'VERIFY_HANDSHAKE',
      status: 'SUCCESS',
      httpStatus: 200,
      ipAddress: req.ip,
    });
    return res.status(200).send(challenge);
  }

  await recordIntegrationEvent({
    integrationKey: 'WHATSAPP',
    direction: 'INBOUND_WEBHOOK',
    eventType: 'VERIFY_HANDSHAKE',
    status: 'REJECTED',
    httpStatus: 403,
    reason: 'VERIFY_TOKEN_MISMATCH',
    ipAddress: req.ip,
  });
  return res.status(403).json({ success: false, message: 'Verification failed.' });
};

export const receiveWhatsAppWebhookController = async (req, res) => {
  try {
    if (!whatsappIntegration.isWebhookConfigured()) {
      await recordIntegrationEvent({
        integrationKey: 'WHATSAPP',
        direction: 'INBOUND_WEBHOOK',
        eventType: 'EVENT',
        status: 'REJECTED',
        httpStatus: 503,
        reason: 'WEBHOOK_NOT_CONFIGURED',
        ipAddress: req.ip,
      });
      // Still ack with 200 is wrong here — nothing is configured to
      // process this, so tell the caller plainly instead of silently
      // swallowing a webhook we can never act on.
      return res.status(503).json({ success: false, message: 'Webhook is not configured.' });
    }

    const signature = req.headers['x-hub-signature-256'];
    const verified = whatsappIntegration.verifyWebhookSignature(req.rawBody, signature);

    if (!verified) {
      await recordIntegrationEvent({
        integrationKey: 'WHATSAPP',
        direction: 'INBOUND_WEBHOOK',
        eventType: 'EVENT',
        status: 'REJECTED',
        httpStatus: 401,
        reason: 'INVALID_SIGNATURE',
        ipAddress: req.ip,
      });
      return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
    }

    // Only a small, non-secret summary is ever logged — never the
    // raw payload (which can contain message text/PII) verbatim.
    const entryCount = Array.isArray(req.body?.entry) ? req.body.entry.length : 0;
    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'INBOUND_WEBHOOK',
      eventType: 'EVENT',
      status: 'SUCCESS',
      httpStatus: 200,
      metadata: { entryCount },
      ipAddress: req.ip,
    });

    // Meta requires a fast 200 ack regardless of what downstream
    // processing does with the event. Actual message-handling
    // (routing an inbound patient WhatsApp reply into the messaging
    // module) is intentionally out of scope for this checkpoint —
    // acknowledging, verifying, and logging the event is what
    // "Webhooks"/"Integration logging"/"Integration failure handling"
    // call for here.
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Unhandled error while processing WhatsApp webhook.');
    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'INBOUND_WEBHOOK',
      eventType: 'EVENT',
      status: 'FAILURE',
      httpStatus: 500,
      reason: 'UNHANDLED_ERROR',
      ipAddress: req.ip,
    });
    // Never leak internals (master prompt §55/§56) even on an
    // unexpected error — safe generic body only.
    return res.status(500).json({ success: false, message: 'Webhook processing failed.' });
  }
};
