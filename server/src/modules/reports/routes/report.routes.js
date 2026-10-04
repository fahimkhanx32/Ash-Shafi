import express from 'express';
import multer from 'multer';

import {
  uploadReportController,
  getReportController,
  getMyReportsController,
  listReportsController,
  retryExtractionController,
  manualEntryController,
  reviewParameterController,
  setInterpretationController,
  verifyReportController,
  finalizeReportController,
  amendFinalizedReportController,
  cancelReportController,
  rejectReportController,
  acknowledgeDuplicateController,
  downloadReportController,
  submitReportController,
  listIntakeController,
  intakeSummaryController,
  reviewIntakeController,
  shareReportController,
} from '../controllers/report.controller.js';
import * as reportValidation from '../validators/report.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize, authorizeAny } from '../../../middlewares/auth.middleware.js';
import { reportIntakeRateLimiter } from '../../../middlewares/rate-limit.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { validateUploadedFile, generateStorageFilename } from '../../../security/file-security.js';
import env from '../../../config/env.js';
import { AppError } from '../../../middlewares/error.middleware.js';

const router = express.Router();

const maxFileSize = Math.floor((env.reports.maxDocumentSizeMb || 25) * 1024 * 1024);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    try {
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        'application/msword', 'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.mimetype)) {
        return cb(new AppError('Unsupported medical report file type.', 400, { code: 'UNSUPPORTED_FILE_TYPE' }));
      }
      return cb(null, true);
    } catch (error) {
      return cb(error);
    }
  },
});

const receiveReportFile = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Medical report file exceeds the configured size limit.', 413, {
          code: 'FILE_TOO_LARGE',
        }));
      }
      if (error.name === 'MulterError') {
        return next(new AppError('Medical report upload could not be processed.', 400, {
          code: 'UPLOAD_ERROR',
        }));
      }
      return next(error);
    }

    if (!req.file) {
      return next(new AppError('A medical report file is required.', 400, { code: 'FILE_REQUIRED' }));
    }

    try {
      const storageFilename = generateStorageFilename(req.file.originalname);
      validateUploadedFile({
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        maxSizeBytes: maxFileSize,
        buffer: req.file.buffer,
      });
      req.file.storageFilename = storageFilename;
      return next();
    } catch (validationError) {
      return next(new AppError(validationError.message, 400, { code: 'INVALID_UPLOAD' }));
    }
  });
};

const authorizeReadOrSelf = (req, res, next) => {
  if (req.user.role === 'PATIENT') return next();
  return authorize(PERMISSIONS.REPORTS_READ)(req, res, next);
};

router.use(authenticate);

/** Patient self-service */
router.get(
  '/me',
  validateQuery(reportValidation.myReportsQuerySchema),
  getMyReportsController,
);

/**
 * Report intake. Registered before every `/:id` route so the literal
 * `/intake` segment is never swallowed by it.
 *
 *  - POST /intake            a PATIENT submits their own report to a
 *                            doctor (REPORTS_SUBMIT), or staff upload a
 *                            document for any patient (REPORTS_UPLOAD).
 *  - GET  /intake            the doctor's inbox of submissions.
 *  - GET  /intake/summary    pending count (badge).
 *  - POST /intake/:id/review accept / reject a submission. Accepting
 *                            does not verify the report.
 */
router.post(
  '/intake',
  authorizeAny([PERMISSIONS.REPORTS_SUBMIT, PERMISSIONS.REPORTS_UPLOAD]),
  reportIntakeRateLimiter,
  receiveReportFile,
  validateBody(reportValidation.intakeSubmitBodySchema),
  submitReportController,
);

router.get(
  '/intake',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateQuery(reportValidation.intakeListQuerySchema),
  listIntakeController,
);

router.get(
  '/intake/summary',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateQuery(reportValidation.intakeSummaryQuerySchema),
  intakeSummaryController,
);

router.post(
  '/intake/:id/review',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.intakeReviewSchema),
  reviewIntakeController,
);

router.post(
  '/intake/:id/share',
  authorizeAny([PERMISSIONS.REPORTS_SUBMIT, PERMISSIONS.REPORTS_UPLOAD, PERMISSIONS.REPORTS_WRITE]),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.intakeShareSchema),
  shareReportController,
);

router.post(
  '/:id/share',
  authorizeAny([PERMISSIONS.REPORTS_SUBMIT, PERMISSIONS.REPORTS_UPLOAD, PERMISSIONS.REPORTS_WRITE]),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.intakeShareSchema),
  shareReportController,
);

/** Upload / write */
router.post(
  '/',
  authorize(PERMISSIONS.REPORTS_WRITE),
  receiveReportFile,
  validateBody(reportValidation.uploadReportBodySchema),
  uploadReportController,
);

/**
 * Staff/doctor/admin search and roster. This route has no
 * `:patientProfileId` URL segment — `patientProfileId` is an
 * *optional* filter carried on the query string (see
 * `listReportsQuerySchema`) and applied by `listReports()` in
 * `report.service.js`. It previously also ran
 * `validateParams(reportValidation.patientProfileIdParamSchema)`,
 * which requires `patientProfileId` in `req.params` — since this path
 * has no such param, `req.params` is always `{}` and every request
 * failed Joi's `.required()` check with a 400 before ever reaching
 * the controller (BET-12 audit fix, 2026-08-13). The dedicated
 * `/patient/:patientProfileId` route below is the one that actually
 * uses that param schema.
 */
router.get(
  '/',
  authorize(PERMISSIONS.REPORTS_READ),
  validateQuery(reportValidation.listReportsQuerySchema),
  listReportsController,
);

router.get(
  '/patient/:patientProfileId',
  authorize(PERMISSIONS.REPORTS_READ),
  validateParams(reportValidation.patientProfileIdParamSchema),
  validateQuery(reportValidation.listReportsQuerySchema),
  listReportsController,
);

/** Single report access */
router.get(
  '/:id',
  authorizeReadOrSelf,
  validateParams(reportValidation.reportIdParamSchema),
  getReportController,
);

router.get(
  '/:id/download',
  authorizeReadOrSelf,
  validateParams(reportValidation.reportIdParamSchema),
  downloadReportController,
);

/** Extraction / manual entry */
router.post(
  '/:id/retry-extraction',
  authorize(PERMISSIONS.REPORTS_WRITE),
  validateParams(reportValidation.reportIdParamSchema),
  retryExtractionController,
);

router.post(
  '/:id/manual-entry',
  authorize(PERMISSIONS.REPORTS_WRITE),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.manualEntrySchema),
  manualEntryController,
);

/** Clinical verification */
router.patch(
  '/:id/parameters/:parameterId/review',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateParams(reportValidation.reportParameterParamSchema),
  validateBody(reportValidation.reviewParameterSchema),
  reviewParameterController,
);

router.patch(
  '/:id/interpretation',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.interpretationSchema),
  setInterpretationController,
);

router.post(
  '/:id/verify',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateParams(reportValidation.reportIdParamSchema),
  verifyReportController,
);

router.post(
  '/:id/finalize',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateParams(reportValidation.reportIdParamSchema),
  finalizeReportController,
);

/** Post-finalization amendment and administrative closure */
router.post(
  '/:id/amend',
  authorize(PERMISSIONS.REPORTS_VERIFY),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.amendReportSchema),
  amendFinalizedReportController,
);

router.post(
  '/:id/cancel',
  authorize(PERMISSIONS.REPORTS_WRITE),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.reasonSchema),
  cancelReportController,
);

router.post(
  '/:id/reject',
  authorize(PERMISSIONS.REPORTS_WRITE),
  validateParams(reportValidation.reportIdParamSchema),
  validateBody(reportValidation.reasonSchema),
  rejectReportController,
);

router.post(
  '/:id/duplicate-review',
  authorize(PERMISSIONS.REPORTS_WRITE),
  validateParams(reportValidation.reportIdParamSchema),
  acknowledgeDuplicateController,
);

export default router;
