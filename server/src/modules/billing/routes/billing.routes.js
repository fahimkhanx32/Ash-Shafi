import express from 'express';

import {
  createFeeController,
  updateFeeController,
  activateFeeController,
  deactivateFeeController,
  getFeeController,
  listFeesController,
} from '../controllers/fee.controller.js';
import {
  createInvoiceController,
  applyDiscountController,
  addInvoiceItemController,
  removeInvoiceItemController,
  cancelInvoiceController,
  getInvoiceController,
  getMyInvoiceController,
  listInvoicesController,
  getMyInvoicesController,
} from '../controllers/invoice.controller.js';
import {
  createChargeSuggestionController,
  listChargeSuggestionsController,
  dismissChargeSuggestionController,
} from '../controllers/charge-suggestion.controller.js';
import * as billingValidation from '../validators/billing.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize, authorizeAny } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-15.1 — Billing routes: `Fee` (service price catalog) and
 * `Invoice`. Mounted at `/api/v1/billing` in `app.js`.
 *
 * `GET /fees` is open to any authenticated user (master prompt
 * §35/§86 — a patient must see prices before booking); every other
 * fee-catalog route requires `BILLING_WRITE`. Invoice `/me*` routes
 * are identity-resolved self-service (same shape as `/patients/me`,
 * `/appointments/me`, `/investigations/me`); the general
 * `/invoices*` routes require `BILLING_READ`/`WRITE` and are for
 * staff/admin use.
 *
 * BET-15 audit fix (this session): `GET /invoices/me/:id` previously
 * had no permission gate at all, relying solely on
 * `invoice.service.js`'s `assertCanAccessAsSelf` — but that function
 * returns `true` unconditionally for any *non*-`PATIENT` actor (by
 * design, since the general `/invoices/:id` route below is the one
 * meant to enforce `BILLING_READ`). A `PATIENT` never holds
 * `BILLING_READ` in `security/permissions.js`, but `DOCTOR`, `STAFF`,
 * and `RECEPTIONIST` don't hold it either — so any authenticated
 * account in one of those roles could hit the unguarded `/me/:id`
 * shape and read *any* patient's invoice by guessing/enumerating its
 * id, completely bypassing the permission system. Fixed with
 * `authorizeReadOrSelf` below — the same pattern BET-12's
 * `report.routes.js` established for exactly this "self access has
 * no id-ownership signal in the URL" shape.
 */

const router = express.Router();

const authorizeReadOrSelf = (req, res, next) => {
  if (req.user.role === 'PATIENT') return next();
  return authorize(PERMISSIONS.BILLING_READ)(req, res, next);
};

router.use(authenticate);

// ---- Fees ----

router.get(
  '/fees',
  validateQuery(billingValidation.listFeesQuerySchema),
  listFeesController,
);

router.get(
  '/fees/:id',
  validateParams(billingValidation.idParamSchema),
  getFeeController,
);

router.post(
  '/fees',
  authorize(PERMISSIONS.BILLING_WRITE),
  validateBody(billingValidation.createFeeSchema),
  createFeeController,
);

router.patch(
  '/fees/:id',
  authorize(PERMISSIONS.BILLING_WRITE),
  validateParams(billingValidation.idParamSchema),
  validateBody(billingValidation.updateFeeSchema),
  updateFeeController,
);

router.post(
  '/fees/:id/activate',
  authorize(PERMISSIONS.BILLING_WRITE),
  validateParams(billingValidation.idParamSchema),
  activateFeeController,
);

router.post(
  '/fees/:id/deactivate',
  authorize(PERMISSIONS.BILLING_WRITE),
  validateParams(billingValidation.idParamSchema),
  deactivateFeeController,
);

// ---- Invoices ----

router.get(
  '/invoices/me',
  validateQuery(billingValidation.myInvoicesQuerySchema),
  getMyInvoicesController,
);

router.get(
  '/invoices/me/:id',
  authorizeReadOrSelf,
  validateParams(billingValidation.idParamSchema),
  getMyInvoiceController,
);

router.post(
  '/invoices',
  authorizeAny([PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE]),
  validateBody(billingValidation.createInvoiceSchema),
  createInvoiceController,
);

router.get(
  '/invoices',
  authorize(PERMISSIONS.BILLING_READ),
  validateQuery(billingValidation.listInvoicesQuerySchema),
  listInvoicesController,
);

router.get(
  '/invoices/:id',
  authorize(PERMISSIONS.BILLING_READ),
  validateParams(billingValidation.idParamSchema),
  getInvoiceController,
);

router.patch(
  '/invoices/:id/discount',
  authorizeAny([PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE]),
  validateParams(billingValidation.idParamSchema),
  validateBody(billingValidation.applyDiscountSchema),
  applyDiscountController,
);

router.post(
  '/invoices/:id/items',
  authorizeAny([PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE]),
  validateParams(billingValidation.idParamSchema),
  validateBody(billingValidation.addInvoiceItemSchema),
  addInvoiceItemController,
);

router.delete(
  '/invoices/:id/items/:itemId',
  authorizeAny([PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE]),
  validateParams(billingValidation.invoiceItemIdParamSchema),
  removeInvoiceItemController,
);

router.post(
  '/invoices/:id/cancel',
  authorizeAny([PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE]),
  validateParams(billingValidation.idParamSchema),
  validateBody(billingValidation.cancelInvoiceSchema),
  cancelInvoiceController,
);

// ---- Charge suggestions ----
// A doctor's lightweight "charge the patient for X" flag, for billing
// staff to pick up and turn into a real invoice — see
// `models/charge-suggestion.model.js`. Same permission shape as
// invoices: a DOCTOR (INVOICES_WRITE) can create/dismiss their own;
// billing staff (BILLING_WRITE) can also dismiss any, and BILLING_READ
// covers the list (scoped to "my own" for a DOCTOR at the service
// layer, same as `listInvoices`).

router.post(
  '/charge-suggestions',
  authorizeAny([PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE]),
  validateBody(billingValidation.createChargeSuggestionSchema),
  createChargeSuggestionController,
);

router.get(
  '/charge-suggestions',
  authorize(PERMISSIONS.BILLING_READ),
  validateQuery(billingValidation.listChargeSuggestionsQuerySchema),
  listChargeSuggestionsController,
);

router.post(
  '/charge-suggestions/:id/dismiss',
  authorizeAny([PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE]),
  validateParams(billingValidation.idParamSchema),
  validateBody(billingValidation.dismissChargeSuggestionSchema),
  dismissChargeSuggestionController,
);

export default router;
