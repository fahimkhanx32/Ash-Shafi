import express from 'express';

import {
  listPublicServicesController,
  listAllServicesController,
  createServiceController,
  updateServiceController,
  deleteServiceController,
  listPublicStatsController,
  listAllStatsController,
  createStatController,
  updateStatController,
  deleteStatController,
  getPublicAboutController,
  upsertAboutController,
} from '../controllers/cms.controller.js';
import {
  createPageController,
  listPagesController,
  getPageController,
  updatePageController,
  deletePageController,
  publishPageController,
  unpublishPageController,
  archivePageController,
  listPublishedPagesController,
  getPublishedPageBySlugController,
} from '../controllers/page.controller.js';
import {
  uploadMediaController,
  listMediaController,
  deleteMediaController,
} from '../controllers/media.controller.js';
import * as cmsValidation from '../validators/cms.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { uploadSingle } from '../../../middlewares/upload.middleware.js';

/**
 * BET-16 (Website CMS) — services, homepage stats, and about-clinic
 * content for the public site (client/website). Reads are
 * intentionally unauthenticated (`router.get` with no `authenticate`)
 * — this is public marketing content, same as any other page on
 * ash-shafi.com; writes require `authenticate` +
 * `WEBSITE_MANAGE`, same pattern as every other admin-write route in
 * this codebase.
 */
const router = express.Router();

// --- Services ---
router.get('/services', listPublicServicesController);
router.get(
  '/services/all',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  listAllServicesController,
);
router.post(
  '/services',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(cmsValidation.createServiceSchema),
  createServiceController,
);
router.patch(
  '/services/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  validateBody(cmsValidation.updateServiceSchema),
  updateServiceController,
);
router.delete(
  '/services/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  deleteServiceController,
);

// --- Homepage stats ---
router.get('/stats', listPublicStatsController);
router.get(
  '/stats/all',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  listAllStatsController,
);
router.post(
  '/stats',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(cmsValidation.createStatSchema),
  createStatController,
);
router.patch(
  '/stats/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  validateBody(cmsValidation.updateStatSchema),
  updateStatController,
);
router.delete(
  '/stats/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  deleteStatController,
);

// --- About content ---
router.get('/about', getPublicAboutController);
router.put(
  '/about',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(cmsValidation.upsertAboutSchema),
  upsertAboutController,
);

/**
 * --- Pages ---
 *
 * Checkpoint 1: plain CRUD + public published-only reads.
 * Checkpoint 2: publish/unpublish/archive below, gated on the
 * narrower `WEBSITE_PUBLISH` permission rather than `WEBSITE_MANAGE`
 * — a content editor can draft/edit without being able to push
 * changes live (see `security/permissions.js`).
 */
router.get(
  '/pages',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateQuery(cmsValidation.listPagesQuerySchema),
  listPagesController,
);
router.get(
  '/pages/public',
  validateQuery(cmsValidation.listPublishedPagesQuerySchema),
  listPublishedPagesController,
);
router.get(
  '/pages/public/:slug',
  validateParams(cmsValidation.slugParamSchema),
  getPublishedPageBySlugController,
);
router.post(
  '/pages',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(cmsValidation.createPageSchema),
  createPageController,
);
router.get(
  '/pages/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  getPageController,
);
router.patch(
  '/pages/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  validateBody(cmsValidation.updatePageSchema),
  updatePageController,
);
router.delete(
  '/pages/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  deletePageController,
);
router.post(
  '/pages/:id/publish',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_PUBLISH),
  validateParams(cmsValidation.idParamSchema),
  publishPageController,
);
router.post(
  '/pages/:id/unpublish',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_PUBLISH),
  validateParams(cmsValidation.idParamSchema),
  unpublishPageController,
);
router.post(
  '/pages/:id/archive',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_PUBLISH),
  validateParams(cmsValidation.idParamSchema),
  archivePageController,
);

// --- Media (Checkpoint 1 scope) ---
router.get(
  '/media',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateQuery(cmsValidation.listMediaQuerySchema),
  listMediaController,
);
router.post(
  '/media',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  uploadSingle('file'),
  validateBody(cmsValidation.uploadMediaSchema),
  uploadMediaController,
);
router.delete(
  '/media/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(cmsValidation.idParamSchema),
  deleteMediaController,
);

export default router;
