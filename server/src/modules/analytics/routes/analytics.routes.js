import express from 'express';

import { getAnalyticsController } from '../controllers/analytics.controller.js';
import { analyticsParamsSchema, analyticsQuerySchema } from '../validators/analytics.validation.js';
import { validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';

/**
 * BET-20 — Secure Analytics, mounted at `/api/v1/analytics`.
 *
 * A single parameterized route rather than one route per domain —
 * every domain shares the same request/response shape (date-range +
 * granularity in, `{summary, breakdown, series}`-style aggregate
 * out), so the only thing that varies per domain is which permission
 * gates it and which service handles it, both resolved inside the
 * controller (see its own docstring for why that check can't live
 * here as a fixed `authorize(...)`).
 */
const router = express.Router();

router.get(
  '/:domain',
  authenticate,
  validateParams(analyticsParamsSchema),
  validateQuery(analyticsQuerySchema),
  getAnalyticsController,
);

export default router;
