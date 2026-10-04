import { IntegrationLog } from '../models/integration-log.model.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-16 Checkpoint 4 — Integration logging + failure handling.
 *
 * `recordIntegrationEvent` never throws — a logging failure (e.g. a
 * momentary DB hiccup) must never break the webhook handler that
 * called it, mirroring the "never fail the caller" convention already
 * used by `integrations/sms/sms.service.js` and
 * `integrations/whatsapp/whatsapp.service.js` for send failures.
 */
/**
 * FET-19 gap closure — shared recipient-masking helper for outbound
 * send logging (email/mailer.js, sms/sms.service.js,
 * whatsapp/whatsapp.service.js). Same masking convention already
 * established by `whatsapp.integration.js#describe()` for
 * phoneNumberId/businessAccountId (`slice(0, 4) + '****'`) — a
 * recipient address/number is enough to spot-check "did the right
 * person's message fail" without this collection ever storing a full
 * contact identifier, consistent with this model's own "metadata
 * only, never raw content" rule.
 */
export const maskRecipient = (value) => {
  const str = String(value || '').trim();
  if (!str) return '';
  return str.length <= 4 ? `${str.slice(0, 1)}***` : `${str.slice(0, 4)}****`;
};

export const recordIntegrationEvent = async ({
  integrationKey,
  direction,
  eventType = '',
  status,
  httpStatus = null,
  reason = '',
  metadata = {},
  ipAddress = '',
}) => {
  try {
    await IntegrationLog.create({
      integrationKey,
      direction,
      eventType,
      status,
      httpStatus,
      reason,
      metadata,
      ipAddress,
    });
  } catch (error) {
    logger.error(
      { err: error, integrationKey, direction, status },
      'Failed to persist integration log entry.',
    );
  }
};

export const listIntegrationLogs = async ({
  integrationKey,
  status,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = {};
  if (integrationKey) filter.integrationKey = String(integrationKey).toUpperCase();
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    IntegrationLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    IntegrationLog.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};
