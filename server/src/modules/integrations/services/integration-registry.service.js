import { AppError } from '../../../middlewares/error.middleware.js';
import { whatsappIntegration } from './providers/whatsapp.integration.js';
import { smsIntegration } from './providers/sms.integration.js';
import { emailIntegration } from './providers/email.integration.js';

/**
 * BET-16 Checkpoint 3 — External integrations registry (master prompt
 * §33/§34 "official integrations architecture" / "provider
 * abstraction").
 *
 * A single place that lists every integration this system supports
 * and reports its live configuration status, without ever exposing a
 * credential. Backed entirely by the existing BET-03/BET-13 provider
 * services (`integrations/email`, `integrations/sms`,
 * `integrations/whatsapp`) — this registry adds no new external
 * network calls of its own, it only surfaces status for the admin
 * integrations screen (master prompt §60/§88 — Super Admin manages
 * "integrations").
 *
 * Deliberately scoped to messaging/communication channels here.
 * Payment providers already have their own dedicated abstraction and
 * admin surface (`modules/payments/services/providers/`, BET-15) and
 * Google Drive backup has its own dedicated task (BET-18) — this
 * registry is not a replacement for either and does not duplicate
 * them.
 *
 * Webhooks, integration-specific authorization beyond the existing
 * `WEBSITE_MANAGE` gate, integration event logging, and integration
 * failure handling are Checkpoint 4 of this task and are
 * intentionally NOT implemented here.
 */

const REGISTRY = Object.freeze([whatsappIntegration, smsIntegration, emailIntegration]);

export const listIntegrations = () =>
  REGISTRY.map((integration) => ({
    key: integration.key,
    label: integration.label,
    configured: integration.isConfigured(),
    ...integration.describe(),
  }));

export const getIntegrationByKey = (key) => {
  const integration = REGISTRY.find((entry) => entry.key === String(key || '').toUpperCase());
  if (!integration) {
    throw new AppError('Unknown integration.', 404, { code: 'INTEGRATION_NOT_FOUND' });
  }
  return {
    key: integration.key,
    label: integration.label,
    configured: integration.isConfigured(),
    ...integration.describe(),
  };
};
