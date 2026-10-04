import express from 'express';

import {
  submitContactInquiryController,
  listContactInquiriesController,
  updateContactInquiryStatusController,
} from '../controllers/contact.controller.js';
import * as cmsValidation from '../validators/cms.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { generalRateLimiter } from '../../../middlewares/rate-limit.middleware.js';

/**
 * FET-16 completion pass — public "Contact" page form (master
 * prompt's "Public forms" bullet). Mounted at the same `/api/v1/cms`
 * prefix as cms.routes.js/dynamic-site.routes.js, no path overlap.
 *
 * `POST /contact` is intentionally the only unauthenticated write
 * endpoint in the whole `cms` module — every other write here is
 * `WEBSITE_MANAGE`/`WEBSITE_PUBLISH` gated. Rate-limited with the
 * project's existing `generalRateLimiter` (same limiter already used
 * on other public-facing routes) rather than a bespoke limiter, to
 * blunt basic spam/abuse without inventing new infrastructure.
 */
const router = express.Router();

router.post(
  '/contact',
  generalRateLimiter,
  validateBody(cmsValidation.submitContactInquirySchema),
  submitContactInquiryController,
);

router.get(
  '/contact',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateQuery(cmsValidation.listContactInquiriesQuerySchema),
  listContactInquiriesController,
);

router.patch(
  '/contact/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  validateBody(cmsValidation.updateContactInquiryStatusSchema),
  updateContactInquiryStatusController,
);

export default router;
