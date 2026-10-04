import * as investigationService from '../services/investigation.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordClinicalAccess, recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

const requestMetaFrom = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

export const orderInvestigationController = async (req, res, next) => {
  try {
    const investigation = await investigationService.orderInvestigation(
      req.body,
      req.user,
      requestMetaFrom(req),
    );

    await recordCreation(req, {
      action: AUDIT_ACTIONS.INVESTIGATION_ORDER_CREATE,
      resourceType: 'Investigation',
      resourceId: investigation?._id,
      patientId: investigation?.patientProfile ?? req.body?.patientProfileId ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Investigation ordered successfully.',
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getInvestigationController = async (req, res, next) => {
  try {
    const investigation = await investigationService.getInvestigationById(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );

    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.INVESTIGATION_VIEW,
      resourceType: 'Investigation',
      resourceId: req.params.id,
      patientId: investigation?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Investigation retrieved successfully.',
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listInvestigationsController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await investigationService.listInvestigations(
      req.query,
      req.user,
    );

    return sendPaginated(res, {
      message: 'Investigations retrieved successfully.',
      items,
      page,
      limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyInvestigationsController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await investigationService.getMyInvestigations(
      req.user,
      req.query,
    );

    return sendPaginated(res, {
      message: 'Investigations retrieved successfully.',
      items,
      page,
      limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const scheduleInvestigationController = async (req, res, next) => {
  try {
    const investigation = await investigationService.scheduleInvestigation(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVESTIGATION_SCHEDULE,
      resourceType: 'Investigation',
      resourceId: req.params.id,
      patientId: investigation?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Investigation scheduled successfully.',
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const markSampleCollectedController = async (req, res, next) => {
  try {
    const investigation = await investigationService.markSampleCollected(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVESTIGATION_SAMPLE_COLLECTED,
      resourceType: 'Investigation',
      resourceId: req.params.id,
      patientId: investigation?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Investigation marked as sample/procedure completed.',
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const markResultPendingController = async (req, res, next) => {
  try {
    const investigation = await investigationService.markResultPending(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVESTIGATION_RESULT_PENDING,
      resourceType: 'Investigation',
      resourceId: req.params.id,
      patientId: investigation?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Investigation marked as result pending.',
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelInvestigationController = async (req, res, next) => {
  try {
    const investigation = await investigationService.cancelInvestigation(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVESTIGATION_CANCEL,
      resourceType: 'Investigation',
      resourceId: req.params.id,
      patientId: investigation?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Investigation cancelled successfully.',
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const rejectInvestigationController = async (req, res, next) => {
  try {
    const investigation = await investigationService.rejectInvestigation(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVESTIGATION_REJECT,
      resourceType: 'Investigation',
      resourceId: req.params.id,
      patientId: investigation?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Investigation rejected.',
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
