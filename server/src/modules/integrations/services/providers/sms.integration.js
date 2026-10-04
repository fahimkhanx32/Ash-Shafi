import env from '../../../../config/env.js';
import { isSmsConfigured } from '../../../../integrations/sms/sms.service.js';

/**
 * BET-16 Checkpoint 3 — wraps the existing generic-HTTP SMS service
 * (`integrations/sms/sms.service.js`, built in BET-13) as an
 * `IntegrationProvider`. No new sending capability; status only.
 */
export const smsIntegration = {
  key: 'SMS',
  label: 'SMS Gateway',
  isConfigured: () => isSmsConfigured,
  describe: () => ({
    provider: env.sms.provider || null,
    configured: isSmsConfigured,
    senderId: env.sms.senderId || null,
  }),
};
