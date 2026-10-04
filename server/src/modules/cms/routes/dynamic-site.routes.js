import express from 'express';

import {
  listPublicNavbarController,
  listAllNavbarController,
  createNavbarItemController,
  updateNavbarItemController,
  reorderNavbarController,
  deleteNavbarItemController,
  listPublicCertificatesController,
  listAllCertificatesController,
  createCertificateController,
  updateCertificateController,
  reorderCertificatesController,
  deleteCertificateController,
  getHeroBannerController,
  upsertHeroBannerController,
  uploadHeroBannerMediaController,
  listPublicSectionsController,
  listAllSectionsController,
  createSectionController,
  updateSectionController,
  reorderSectionsController,
  deleteSectionController,
  uploadSectionMediaController,
} from '../controllers/dynamic-site.controller.js';
import * as dynamicSiteValidation from '../validators/dynamic-site.validation.js';
import { validateBody, validateParams } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { uploadBannerMedia } from '../../../middlewares/upload.middleware.js';

/**
 * FET-16 — dashboard-editable public website: navbar items, homepage
 * hero/banner (with image/video background upload), certificates
 * grid, and the homepage section layout registry (reorder/hide/create
 * custom sections). Mounted at the same `/api/v1/cms` prefix as
 * cms.routes.js — same read/write split as every other route there:
 * public GET, `authenticate` + `WEBSITE_MANAGE` for every write.
 */
const router = express.Router();

// --- Navbar items ---
router.get('/navbar', listPublicNavbarController);
router.get('/navbar/all', authenticate, authorize(PERMISSIONS.WEBSITE_MANAGE), listAllNavbarController);
router.post(
  '/navbar',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(dynamicSiteValidation.createNavbarItemSchema),
  createNavbarItemController,
);
router.patch(
  '/navbar/reorder',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(dynamicSiteValidation.reorderSchema),
  reorderNavbarController,
);
router.patch(
  '/navbar/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(dynamicSiteValidation.idParamSchema),
  validateBody(dynamicSiteValidation.updateNavbarItemSchema),
  updateNavbarItemController,
);
router.delete(
  '/navbar/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(dynamicSiteValidation.idParamSchema),
  deleteNavbarItemController,
);

// --- Certificates ---
router.get('/certificates', listPublicCertificatesController);
router.get(
  '/certificates/all',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  listAllCertificatesController,
);
router.post(
  '/certificates',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(dynamicSiteValidation.createCertificateSchema),
  createCertificateController,
);
router.patch(
  '/certificates/reorder',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(dynamicSiteValidation.reorderSchema),
  reorderCertificatesController,
);
router.patch(
  '/certificates/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(dynamicSiteValidation.idParamSchema),
  validateBody(dynamicSiteValidation.updateCertificateSchema),
  updateCertificateController,
);
router.delete(
  '/certificates/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(dynamicSiteValidation.idParamSchema),
  deleteCertificateController,
);

// --- Hero banner ---
router.get('/hero-banner', getHeroBannerController);
router.put(
  '/hero-banner',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(dynamicSiteValidation.upsertHeroBannerSchema),
  upsertHeroBannerController,
);
router.post(
  '/hero-banner/media',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  uploadBannerMedia('file'),
  uploadHeroBannerMediaController,
);

// --- Homepage sections (layout registry) ---
router.get('/sections', listPublicSectionsController);
router.get('/sections/all', authenticate, authorize(PERMISSIONS.WEBSITE_MANAGE), listAllSectionsController);
router.post(
  '/sections',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(dynamicSiteValidation.createSectionSchema),
  createSectionController,
);
router.patch(
  '/sections/reorder',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateBody(dynamicSiteValidation.reorderSchema),
  reorderSectionsController,
);
router.patch(
  '/sections/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(dynamicSiteValidation.idParamSchema),
  validateBody(dynamicSiteValidation.updateSectionSchema),
  updateSectionController,
);
router.post(
  '/sections/:id/media',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(dynamicSiteValidation.idParamSchema),
  uploadBannerMedia('file'),
  uploadSectionMediaController,
);
router.delete(
  '/sections/:id',
  authenticate,
  authorize(PERMISSIONS.WEBSITE_MANAGE),
  validateParams(dynamicSiteValidation.idParamSchema),
  deleteSectionController,
);

export default router;
