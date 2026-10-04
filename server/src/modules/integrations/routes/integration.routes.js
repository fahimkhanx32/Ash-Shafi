import express from 'express';

import {
  listIntegrationsController,
  getIntegrationController,
  listIntegrationLogsController,
} from '../controllers/integration.controller.js';
import {
  verifyWhatsAppWebhookController,
  receiveWhatsAppWebhookController,
} from '../controllers/webhook.controller.js';
import * as integrationValidation from '../validators/integration.validation.js';
import { validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-16 — External integrations.
 *
 * Checkpoint 3: read-only status (`GET /`, `GET /:key`), gated on
 * `WEBSITE_MANAGE`.
 *
 * Checkpoint 4 adds:
 *  - `GET /webhooks/whatsapp` / `POST /webhooks/whatsapp` — the
 *    inbound WhatsApp webhook. Deliberately the one pair of routes in
 *    this file with no `authenticate`/`authorize` — Meta calls these,
 *    not a logged-in user. Its trust boundary is entirely the
 *    verify-token handshake (GET) / HMAC signature check (POST)
 *    inside `webhook.controller.js`, exactly mirroring how
 *    `payment.routes.js` keeps `POST /webhook` outside `authenticate`
 *    and relies on `payment.service.js`'s signature check instead.
 *    Registered before any router-wide `authenticate` so an
 *    unauthenticated webhook call can actually reach it (there is no
 *    router-wide `authenticate` here — every other route below is
 *    gated individually — but the ordering comment is kept for the
 *    same reason `payment.routes.js` keeps its).
 *  - `GET /logs` — integration event log (Checkpoint 4 "Integration
 *    logging"), gated on `WEBSITE_MANAGE` same as every other admin
 *    read here ("Integration authorization" for this checkpoint means
 *    only privileged staff can view integration/webhook activity,
 *    not a new permission — see `integration-registry.service.js`'s
 *    file header for why no new permission was introduced).
 *
 * Mounted at `/api/v1/integrations` in `app.js`. The webhook path is
 * therefore `/api/v1/integrations/webhooks/whatsapp` — this exact URL
 * is what gets registered in the Meta App dashboard.
 */
const router = express.Router();

router.get('/webhooks/whatsapp', verifyWhatsAppWebhookController);
router.post('/webhooks/whatsapp', receiveWhatsAppWebhookController);

router.get('/', authenticate, authorize(PERMISSIONS.WEBSITE_MANAGE), listIntegrationsController);
router.get(
  '/logs',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateQuery(integrationValidation.listLogsQuerySchema),
  listIntegrationLogsController,
);
router.get(
  '/:key',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(integrationValidation.keyParamSchema),
  getIntegrationController,
);

export default router;
