import env from '../../../../config/env.js';
import { isEmailConfigured } from '../../../../integrations/email/mailer.js';

/**
 * BET-16 Checkpoint 3 — wraps the existing SMTP mailer
 * (`integrations/email/mailer.js`, built in BET-03) as an
 * `IntegrationProvider`. No new sending capability; status only.
 */
export const emailIntegration = {
  key: 'EMAIL',
  label: 'Email (SMTP)',
  isConfigured: () => isEmailConfigured,
  describe: () => ({
    host: env.email.host || null,
    fromEmail: env.email.fromEmail || null,
    fromName: env.email.fromName || null,
    configured: isEmailConfigured,
  }),
};
