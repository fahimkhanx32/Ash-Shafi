import { AppError } from '../../../middlewares/error.middleware.js';
import * as reportService from '../services/report.service.js';
import * as intakeService from '../services/report-intake.service.js';
import { toPatientView } from '../services/report-patient-view.js';
import { PERMISSIONS, getRolePermissions } from '../../../security/permissions.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

const requestMetaFrom = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

export const uploadReportController = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('A medical report file is required.', 400, { code: 'FILE_REQUIRED' }));
    }

    const report = await reportService.uploadReport(
      req.body,
      req.file,
      req.user,
      requestMetaFrom(req),
    );

    // Access to this report (read) is already logged per-request via
    // `report_access_logs` (BET-12). This additionally records the
    // upload/creation event in the general BET-17 record-creation
    // trail.
    await recordCreation(req, {
      action: AUDIT_ACTIONS.REPORT_CREATE,
      resourceType: 'MedicalReport',
      resourceId: report?._id,
      patientId: report?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Medical report uploaded successfully. Extraction will continue asynchronously.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getReportController = async (req, res, next) => {
  try {
    const report = await reportService.getReportById(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Medical report retrieved successfully.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyReportsController = async (req, res, next) => {
  try {
    const result = await reportService.getMyReports(req.user, req.query);
    return sendPaginated(res, {
      message: 'Your authorized medical reports retrieved successfully.',
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listReportsController = async (req, res, next) => {
  try {
    const query = req.params.patientProfileId
      ? { ...req.query, patientProfileId: req.params.patientProfileId }
      : req.query;
    const result = await reportService.listReports(query, req.user);
    return sendPaginated(res, {
      message: 'Medical reports retrieved successfully.',
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const retryExtractionController = async (req, res, next) => {
  try {
    const report = await reportService.retryExtraction(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      statusCode: 202,
      message: 'Extraction retry accepted.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const manualEntryController = async (req, res, next) => {
  try {
    const report = await reportService.manualEntry(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Manual report result entry saved for verification.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const reviewParameterController = async (req, res, next) => {
  try {
    const report = await reportService.reviewParameter(
      req.params.id,
      req.params.parameterId,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Report parameter review saved.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const setInterpretationController = async (req, res, next) => {
  try {
    const report = await reportService.setInterpretation(
      req.params.id,
      req.body.interpretation,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Doctor interpretation saved.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyReportController = async (req, res, next) => {
  try {
    const report = await reportService.verifyReport(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Medical report verified successfully.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const finalizeReportController = async (req, res, next) => {
  try {
    const report = await reportService.finalizeReport(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Medical report finalized successfully.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const amendFinalizedReportController = async (req, res, next) => {
  try {
    const report = await reportService.amendFinalizedReport(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Finalized medical report amended with historical traceability.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelReportController = async (req, res, next) => {
  try {
    const report = await reportService.cancelReport(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Medical report cancelled.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const rejectReportController = async (req, res, next) => {
  try {
    const report = await reportService.rejectReport(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Medical report rejected.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const acknowledgeDuplicateController = async (req, res, next) => {
  try {
    const report = await reportService.acknowledgeDuplicate(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Duplicate review recorded.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const downloadReportController = async (req, res, next) => {
  try {
    const file = await reportService.downloadReport(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename.replace(/["\\\r\n]/g, '')}"`,
    );
    return res.status(200).send(file.buffer);
  } catch (error) {
    return next(error);
  }
};

// ---------------------------------------------------------------
// Report intake (patient self-submission / staff on behalf)
// ---------------------------------------------------------------
// What the uploader gets back. A patient gets the patient view. Staff who may
// only UPLOAD (e.g. reception) get a receipt: enough to confirm the filing,
// but no document content, history or routing internals — upload does not
// imply read.
export const shapeSubmitResponse = (report, user) => {
  if (user.role === 'PATIENT') return toPatientView(report);
  if (getRolePermissions(user.role).includes(PERMISSIONS.REPORTS_READ)) return report;
  const r = typeof report.toObject === 'function' ? report.toObject() : report;
  return {
    _id: r._id,
    reportReference: r.reportReference,
    title: r.title,
    reportType: r.reportType,
    documentSubType: r.documentSubType ?? null,
    status: r.status,
    uploadDate: r.uploadDate,
  };
};

export const submitReportController = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('A medical report file is required.', 400, { code: 'FILE_REQUIRED' }));
    }

    const { report, routing } = await intakeService.submitReport(
      req.body,
      req.file,
      req.user,
      requestMetaFrom(req),
    );

    await recordCreation(req, {
      action: AUDIT_ACTIONS.REPORT_CREATE,
      resourceType: 'MedicalReport',
      resourceId: report?._id,
      patientId: report?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Report submitted. It will be reviewed by a doctor; text extraction continues in the background.',
      data: { report: shapeSubmitResponse(report, req.user), routing },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listIntakeController = async (req, res, next) => {
  try {
    const result = await intakeService.listIntake(req.query, req.user);
    return sendPaginated(res, {
      message: 'Report submissions retrieved successfully.',
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const intakeSummaryController = async (req, res, next) => {
  try {
    const summary = await intakeService.getIntakeSummary(req.user, req.query);
    return sendSuccess(res, {
      message: 'Report submission summary retrieved successfully.',
      data: summary,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const reviewIntakeController = async (req, res, next) => {
  try {
    const report = await intakeService.reviewIntake(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: req.body.decision === 'ACCEPT' ? 'Submission accepted.' : 'Submission rejected.',
      data: report,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const shareReportController = async (req, res, next) => {
  try {
    const result = await intakeService.shareReport(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Report shared successfully with the selected doctor.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
