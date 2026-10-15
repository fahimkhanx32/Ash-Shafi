import express from 'express';

import {
  orderInvestigationController,
  getInvestigationController,
  listInvestigationsController,
  getMyInvestigationsController,
  scheduleInvestigationController,
  markSampleCollectedController,
  markResultPendingController,
  cancelInvestigationController,
  rejectInvestigationController,
} from '../controllers/investigation.controller.js';
import {
  getTestCatalogController,
  createLabRequisitionController,
  listReferringDoctorsController,
  updateLabRequisitionController,
  getLabRequisitionController,
  listLabRequisitionsController,
  getMyLabRequisitionsController,
  issueLabRequisitionController,
  cancelLabRequisitionController,
} from '../controllers/lab-requisition.controller.js';
import * as investigationValidation from '../validators/investigation.validation.js';
import * as labRequisitionValidation from '../validators/lab-requisition.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

const router = express.Router();

router.use(authenticate);

// ── Individual Investigation routes ──────────────────────────────────────────

router.get(
  '/me',
  validateQuery(investigationValidation.myInvestigationsQuerySchema),
  getMyInvestigationsController,
);

router.post(
  '/',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateBody(investigationValidation.orderInvestigationSchema),
  orderInvestigationController,
);

router.get(
  '/',
  authorize(PERMISSIONS.INVESTIGATIONS_READ),
  validateQuery(investigationValidation.listInvestigationsQuerySchema),
  listInvestigationsController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.INVESTIGATIONS_READ),
  validateParams(investigationValidation.investigationIdParamSchema),
  getInvestigationController,
);

router.post(
  '/:id/schedule',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(investigationValidation.investigationIdParamSchema),
  validateBody(investigationValidation.scheduleInvestigationSchema),
  scheduleInvestigationController,
);

router.post(
  '/:id/sample-collected',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(investigationValidation.investigationIdParamSchema),
  validateBody(investigationValidation.investigationTransitionSchema),
  markSampleCollectedController,
);

router.post(
  '/:id/result-pending',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(investigationValidation.investigationIdParamSchema),
  validateBody(investigationValidation.investigationTransitionSchema),
  markResultPendingController,
);

router.post(
  '/:id/cancel',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(investigationValidation.investigationIdParamSchema),
  validateBody(investigationValidation.investigationTransitionSchema),
  cancelInvestigationController,
);

router.post(
  '/:id/reject',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(investigationValidation.investigationIdParamSchema),
  validateBody(investigationValidation.investigationTransitionSchema),
  rejectInvestigationController,
);

export default router;

// ── Lab Requisition sub-router (mounted at /lab-requisitions in server.js) ───

export const labRequisitionRouter = express.Router();

labRequisitionRouter.use(authenticate);

// Catalog — accessible by any authenticated user
labRequisitionRouter.get('/catalog', getTestCatalogController);

// Doctors selectable in the "Referred by" dropdown (declared before `/:id`).
labRequisitionRouter.get(
  '/referring-doctors',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  listReferringDoctorsController,
);

// Patient self-access
labRequisitionRouter.get(
  '/me',
  validateQuery(labRequisitionValidation.myLabRequisitionsQuerySchema),
  getMyLabRequisitionsController,
);

// Staff CRUD
labRequisitionRouter.post(
  '/',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateBody(labRequisitionValidation.createLabRequisitionSchema),
  createLabRequisitionController,
);

labRequisitionRouter.get(
  '/',
  authorize(PERMISSIONS.INVESTIGATIONS_READ),
  validateQuery(labRequisitionValidation.listLabRequisitionsQuerySchema),
  listLabRequisitionsController,
);

labRequisitionRouter.get(
  '/:id',
  validateParams(labRequisitionValidation.labRequisitionIdParamSchema),
  getLabRequisitionController,
);

labRequisitionRouter.patch(
  '/:id',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(labRequisitionValidation.labRequisitionIdParamSchema),
  validateBody(labRequisitionValidation.updateLabRequisitionSchema),
  updateLabRequisitionController,
);

labRequisitionRouter.post(
  '/:id/issue',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(labRequisitionValidation.labRequisitionIdParamSchema),
  issueLabRequisitionController,
);

labRequisitionRouter.post(
  '/:id/cancel',
  authorize(PERMISSIONS.INVESTIGATIONS_WRITE),
  validateParams(labRequisitionValidation.labRequisitionIdParamSchema),
  validateBody(labRequisitionValidation.cancelLabRequisitionSchema),
  cancelLabRequisitionController,
);

