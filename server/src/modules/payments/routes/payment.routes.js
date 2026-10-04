import express from 'express';

import {
  initiatePaymentController,
  recordManualPaymentController,
  webhookController,
  getPaymentController,
  listPaymentsController,
  getMyPaymentsController,
  refundPaymentController,
  listRefundsController,
  getPaymentReceiptController,
  cancelPaymentController,
} from '../controllers/payment.controller.js';
import * as paymentValidation from '../validators/payment.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-15.2 — Payment routes. Mounted at `/api/v1/payments` in
 * `app.js`.
 *
 * `POST /webhook` is deliberately the one route in this file with no
 * `authenticate` — the gateway itself calls it, not a logged-in user;
 * its trust boundary is entirely the HMAC signature check inside
 * `payment.service.js`'s `handleWebhook`, run against the raw request
 * bytes `app.js` already captures onto `req.rawBody` for exactly this
 * purpose (see the comment on `express.json()`'s `verify` option
 * there). `POST /initiate` needs no route-level `authorize()` either —
 * `payment.service.js`'s `assertCanInitiatePayment` already branches
 * on role internally (a `PATIENT` may pay their own invoice; anyone
 * else needs `BILLING_WRITE`), matching the reasoning
 * `modules/billing/routes/billing.routes.js` uses for keeping
 * resource-ownership checks in the service layer.
 *
 * `GET /:id` and `GET /:id/receipt` use `authorizeReadOrSelf` — the
 * same pattern BET-12's `report.routes.js` established (`authorizeReadOrSelf`
 * there), and the fix this session also applied to
 * `billing.routes.js`'s `/invoices/me/:id` (see that file's comment):
 * a `PATIENT` is let through to the service layer unconditionally,
 * which then enforces true ownership (`assertCanAccessAsSelf`);
 * every other role must hold `BILLING_READ`. Without this gate, a
 * staff role that does *not* hold `BILLING_READ` (e.g.
 * `RECEPTIONIST`, `STAFF`) could otherwise reach `getPaymentById` —
 * whose ownership check trivially passes for any non-`PATIENT`
 * actor, by design, since the general `/` list route is the one
 * meant to be permission-gated — and read or print the receipt for
 * *any* patient's payment by guessing/enumerating ids, bypassing the
 * permission system entirely.
 */

const router = express.Router();

const authorizeReadOrSelf = (req, res, next) => {
  if (req.user.role === 'PATIENT') return next();
  return authorize(PERMISSIONS.BILLING_READ)(req, res, next);
};

// Public — no `authenticate`. Must be registered before `router.use(authenticate)`
// below so an unauthenticated gateway callback can actually reach it.
router.post('/webhook', webhookController);

router.use(authenticate);

// ---- Self-service ----

router.get(
  '/me',
  validateQuery(paymentValidation.myPaymentsQuerySchema),
  getMyPaymentsController,
);

// ---- Initiate / record ----

router.post(
  '/initiate',
  validateBody(paymentValidation.initiatePaymentSchema),
  initiatePaymentController,
);

router.post(
  '/manual',
  authorize(PERMISSIONS.BILLING_WRITE),
  validateBody(paymentValidation.recordManualPaymentSchema),
  recordManualPaymentController,
);

// ---- List / detail ----

router.get(
  '/',
  authorize(PERMISSIONS.BILLING_READ),
  validateQuery(paymentValidation.listPaymentsQuerySchema),
  listPaymentsController,
);

router.get(
  '/:id',
  authorizeReadOrSelf,
  validateParams(paymentValidation.idParamSchema),
  getPaymentController,
);

router.get(
  '/:id/receipt',
  authorizeReadOrSelf,
  validateParams(paymentValidation.idParamSchema),
  getPaymentReceiptController,
);

// A PENDING online-checkout payment (abandoned/never completed) can
// be cancelled by its own initiating patient, or by staff holding
// BILLING_WRITE (cancelling is a write action, unlike GET /:id/
// GET /:id/receipt above which only need BILLING_READ for staff) —
// paymentService.cancelPendingPayment still does the real ownership
// enforcement (assertCanAccessAsSelf) once the route lets the
// request through, same defense-in-depth shape as every other
// single-payment route here.
const authorizeCancelOrSelf = (req, res, next) => {
  if (req.user.role === 'PATIENT') return next();
  return authorize(PERMISSIONS.BILLING_WRITE)(req, res, next);
};

router.post(
  '/:id/cancel',
  authorizeCancelOrSelf,
  validateParams(paymentValidation.idParamSchema),
  validateBody(paymentValidation.cancelPaymentSchema),
  cancelPaymentController,
);

// ---- Refunds ----

router.post(
  '/:id/refund',
  authorize(PERMISSIONS.BILLING_WRITE),
  validateParams(paymentValidation.idParamSchema),
  validateBody(paymentValidation.refundPaymentSchema),
  refundPaymentController,
);

router.get(
  '/:id/refunds',
  authorize(PERMISSIONS.BILLING_READ),
  validateParams(paymentValidation.idParamSchema),
  listRefundsController,
);

export default router;
