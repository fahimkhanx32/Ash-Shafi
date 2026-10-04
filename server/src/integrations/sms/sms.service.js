import env from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { recordIntegrationEvent, maskRecipient } from '../../modules/integrations/services/integration-log.service.js';

/**
 * SMS provider abstraction (BET-13, master prompt §33/§43).
 *
 * Mirrors the fail-safe convention already established by
 * `integrations/email/mailer.js`: SMS is optional in this
 * environment (every `SMS_*` env var defaults to an empty string —
 * see `config/env.js`). When it is not configured, this never
 * throws and never blocks the caller (a notification-delivery
 * failure must never fail the request that triggered it) — it just
 * logs a warning and reports `{ sent: false }`.
 *
 * The provider itself is deliberately generic (a configurable HTTP
 * endpoint + API key/secret + sender id) rather than hardwired to
 * one vendor, per master prompt §33's "configurable integration"
 * requirement and the same provider-abstraction shape already used
 * for OCR (`modules/reports/services/ocr.service.js`) and is
 * intended for future payment providers. A specific vendor's exact
 * request/response contract can be swapped in later by editing only
 * `sendViaGenericHttpProvider` below — nothing outside this file
 * needs to change.
 *
 * FET-19 gap closure — every attempt now also writes an
 * `OUTBOUND_SEND` row via `recordIntegrationEvent` (see
 * `integrations/email/mailer.js` for the fuller rationale — same
 * pattern applied here).
 */

export const isSmsConfigured = Boolean(
  env.sms.provider && env.sms.apiUrl && env.sms.apiKey,
);

const sendViaGenericHttpProvider = async ({ to, message }) => {
  const response = await fetch(env.sms.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.sms.apiKey}`,
    },
    body: JSON.stringify({
      to,
      message,
      senderId: env.sms.senderId || undefined,
      apiSecret: env.sms.apiSecret || undefined,
    }),
  });

  if (!response.ok) {
    const error = new Error(`SMS provider responded with status ${response.status}.`);
    error.httpStatus = response.status;
    throw error;
  }

  return response;
};

/**
 * Sends an SMS. Never throws — callers (notification dispatch) must
 * not fail a request just because SMS delivery failed.
 *
 * @param {{ to: string, message: string }} params
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export const sendSms = async ({ to, message }) => {
  if (!isSmsConfigured) {
    logger.warn({ to }, 'SMS not sent: no SMS provider is configured.');

    await recordIntegrationEvent({
      integrationKey: 'SMS',
      direction: 'OUTBOUND_SEND',
      eventType: 'SMS_SEND',
      status: 'REJECTED',
      reason: 'SMS_NOT_CONFIGURED',
      metadata: { to: maskRecipient(to) },
    });

    return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  }

  if (!to || !message) {
    await recordIntegrationEvent({
      integrationKey: 'SMS',
      direction: 'OUTBOUND_SEND',
      eventType: 'SMS_SEND',
      status: 'REJECTED',
      reason: 'MISSING_RECIPIENT_OR_MESSAGE',
      metadata: { to: maskRecipient(to) },
    });

    return { sent: false, reason: 'MISSING_RECIPIENT_OR_MESSAGE' };
  }

  try {
    await sendViaGenericHttpProvider({ to, message });

    await recordIntegrationEvent({
      integrationKey: 'SMS',
      direction: 'OUTBOUND_SEND',
      eventType: 'SMS_SEND',
      status: 'SUCCESS',
      httpStatus: 200,
      metadata: { to: maskRecipient(to) },
    });

    return { sent: true };
  } catch (error) {
    logger.error({ err: error, to }, 'Failed to send SMS.');

    await recordIntegrationEvent({
      integrationKey: 'SMS',
      direction: 'OUTBOUND_SEND',
      eventType: 'SMS_SEND',
      status: 'FAILURE',
      httpStatus: error.httpStatus ?? null,
      reason: 'SEND_FAILED',
      metadata: { to: maskRecipient(to) },
    });

    return { sent: false, reason: 'SEND_FAILED' };
  }
};

export default { sendSms, isSmsConfigured };
