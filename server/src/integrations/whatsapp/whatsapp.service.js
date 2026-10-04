import env from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { recordIntegrationEvent, maskRecipient } from '../../modules/integrations/services/integration-log.service.js';

/**
 * WhatsApp provider abstraction (BET-13, master prompt §33 —
 * "WhatsApp Business/API where officially supported"; §33/§80 forbid
 * unofficial WhatsApp automation).
 *
 * Targets the official Meta WhatsApp Business Cloud API
 * (`graph.facebook.com/<version>/<phoneNumberId>/messages`) using a
 * configured access token — never an unofficial/reverse-engineered
 * client. Optional in this environment (every `WHATSAPP_*` env var
 * defaults to an empty string — see `config/env.js`); when not
 * configured this never throws and never blocks the caller, mirroring
 * `integrations/email/mailer.js` and `integrations/sms/sms.service.js`.
 *
 * Only plain-text session messages are sent here. WhatsApp's Cloud
 * API requires an approved message *template* to initiate contact
 * outside a 24-hour customer-service window; template management is
 * an administrative configuration concern (master prompt §33 — "the
 * doctor/admin can configure integration credentials through secure
 * settings") left for a future integrations-admin task, not
 * something this notification-dispatch layer should assume exists.
 *
 * FET-19 gap closure — every attempt now also writes an
 * `OUTBOUND_SEND` row via `recordIntegrationEvent` (see
 * `integrations/email/mailer.js` for the fuller rationale — same
 * pattern applied here). This is a distinct writer from
 * `webhook.controller.js`'s `INBOUND_WEBHOOK` rows for the same
 * `WHATSAPP` key — the Integrations admin screen's log table already
 * has a Direction column to tell them apart.
 */

export const isWhatsAppConfigured = Boolean(
  env.whatsapp.provider &&
    env.whatsapp.accessToken &&
    env.whatsapp.phoneNumberId,
);

const graphApiUrl = () => {
  const base = env.whatsapp.apiUrl || 'https://graph.facebook.com/v19.0';

  return `${base.replace(/\/$/, '')}/${env.whatsapp.phoneNumberId}/messages`;
};

/**
 * Sends a WhatsApp text message. Never throws — callers (notification
 * dispatch) must not fail a request just because WhatsApp delivery
 * failed.
 *
 * @param {{ to: string, message: string }} params
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export const sendWhatsAppMessage = async ({ to, message }) => {
  if (!isWhatsAppConfigured) {
    logger.warn({ to }, 'WhatsApp message not sent: WhatsApp is not configured.');

    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'OUTBOUND_SEND',
      eventType: 'WHATSAPP_SEND',
      status: 'REJECTED',
      reason: 'WHATSAPP_NOT_CONFIGURED',
      metadata: { to: maskRecipient(to) },
    });

    return { sent: false, reason: 'WHATSAPP_NOT_CONFIGURED' };
  }

  if (!to || !message) {
    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'OUTBOUND_SEND',
      eventType: 'WHATSAPP_SEND',
      status: 'REJECTED',
      reason: 'MISSING_RECIPIENT_OR_MESSAGE',
      metadata: { to: maskRecipient(to) },
    });

    return { sent: false, reason: 'MISSING_RECIPIENT_OR_MESSAGE' };
  }

  try {
    const response = await fetch(graphApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const error = new Error(`WhatsApp API responded with status ${response.status}.`);
      error.httpStatus = response.status;
      throw error;
    }

    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'OUTBOUND_SEND',
      eventType: 'WHATSAPP_SEND',
      status: 'SUCCESS',
      httpStatus: response.status,
      metadata: { to: maskRecipient(to) },
    });

    return { sent: true };
  } catch (error) {
    logger.error({ err: error, to }, 'Failed to send WhatsApp message.');

    await recordIntegrationEvent({
      integrationKey: 'WHATSAPP',
      direction: 'OUTBOUND_SEND',
      eventType: 'WHATSAPP_SEND',
      status: 'FAILURE',
      httpStatus: error.httpStatus ?? null,
      reason: 'SEND_FAILED',
      metadata: { to: maskRecipient(to) },
    });

    return { sent: false, reason: 'SEND_FAILED' };
  }
};

export default { sendWhatsAppMessage, isWhatsAppConfigured };
