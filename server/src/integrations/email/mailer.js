import nodemailer from 'nodemailer';

import env from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { recordIntegrationEvent, maskRecipient } from '../../modules/integrations/services/integration-log.service.js';

/**
 * Thin nodemailer wrapper (BET-03 foundation for auth emails).
 *
 * SMTP is optional in this environment (see config/env.js — SMTP_HOST
 * defaults to an empty string). When it is not configured, emails are
 * not sent and callers get `{ sent: false, reason: 'SMTP_NOT_CONFIGURED' }`
 * back instead of the app crashing or silently pretending to send.
 *
 * FET-19 gap closure — every attempt now also writes an
 * `OUTBOUND_SEND` row via `recordIntegrationEvent`, the same
 * `IntegrationLog` collection the inbound WhatsApp webhook already
 * writes to (previously the only writer — Email/SMS's "Sync status"/
 * "Error status" cards had nothing to ever show). `recordIntegrationEvent`
 * itself never throws, so this can't turn a delivery failure into a
 * request failure. Only the masked recipient and subject are logged
 * (`maskRecipient`) — never the email body.
 */

export const isEmailConfigured = Boolean(
  env.email.host && env.email.fromEmail,
);

let transporter = null;

const getTransporter = () => {
  if (!isEmailConfigured) {
    return null;
  }

  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.secure,
    auth: env.email.user
      ? {
          user: env.email.user,
          pass: env.email.password,
        }
      : undefined,
  });

  return transporter;
};

/**
 * Sends an email. Never throws — callers (auth flows) must not fail
 * a request just because notification delivery failed.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} message
 * @returns {Promise<{ sent: boolean, messageId?: string, reason?: string }>}
 */
export const sendMail = async ({ to, subject, text, html }) => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    logger.warn(
      { to, subject },
      'Email not sent: SMTP is not configured.',
    );

    await recordIntegrationEvent({
      integrationKey: 'EMAIL',
      direction: 'OUTBOUND_SEND',
      eventType: 'EMAIL_SEND',
      status: 'REJECTED',
      reason: 'SMTP_NOT_CONFIGURED',
      metadata: { to: maskRecipient(to), subject },
    });

    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    const info = await activeTransporter.sendMail({
      from: `"${env.email.fromName}" <${env.email.fromEmail}>`,
      to,
      subject,
      text,
      html,
    });

    await recordIntegrationEvent({
      integrationKey: 'EMAIL',
      direction: 'OUTBOUND_SEND',
      eventType: 'EMAIL_SEND',
      status: 'SUCCESS',
      metadata: { to: maskRecipient(to), subject, messageId: info.messageId },
    });

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logger.error({ err: error, to, subject }, 'Failed to send email.');

    await recordIntegrationEvent({
      integrationKey: 'EMAIL',
      direction: 'OUTBOUND_SEND',
      eventType: 'EMAIL_SEND',
      status: 'FAILURE',
      reason: 'SEND_FAILED',
      metadata: { to: maskRecipient(to), subject },
    });

    return { sent: false, reason: 'SEND_FAILED' };
  }
};

export default { sendMail, isEmailConfigured };
