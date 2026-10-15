import * as labRequisitionService from '../services/lab-requisition.service.js';
import { TEST_CATALOG, TEST_GROUPS } from '../models/test-catalog.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';

// ── Catalog ──────────────────────────────────────────────────────────────────

export const getTestCatalogController = (_req, res) => {
  return sendSuccess(res, {
    message: 'Test catalog retrieved successfully.',
    data: { tests: TEST_CATALOG, groups: TEST_GROUPS },
  });
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const createLabRequisitionController = async (req, res, next) => {
  try {
    const requisition = await labRequisitionService.createRequisition(req.body, req.user);
    return sendSuccess(res, {
      statusCode: 201,
      message:    'Lab requisition created successfully.',
      data:       requisition,
      requestId:  req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateLabRequisitionController = async (req, res, next) => {
  try {
    const requisition = await labRequisitionService.updateRequisition(req.params.id, req.body, req.user);
    return sendSuccess(res, {
      message:   'Lab requisition updated successfully.',
      data:      requisition,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getLabRequisitionController = async (req, res, next) => {
  try {
    const requisition = await labRequisitionService.getRequisitionById(req.params.id, req.user);
    return sendSuccess(res, {
      message:   'Lab requisition retrieved successfully.',
      data:      requisition,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listLabRequisitionsController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await labRequisitionService.listRequisitions(req.query);
    return sendPaginated(res, {
      message:   'Lab requisitions retrieved successfully.',
      items, page, limit, total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyLabRequisitionsController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await labRequisitionService.getMyRequisitions(req.user, req.query);
    return sendPaginated(res, {
      message:   'Lab requisitions retrieved successfully.',
      items, page, limit, total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const issueLabRequisitionController = async (req, res, next) => {
  try {
    const requisition = await labRequisitionService.issueRequisition(req.params.id, req.user);
    return sendSuccess(res, {
      message:   'Lab requisition issued successfully.',
      data:      requisition,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelLabRequisitionController = async (req, res, next) => {
  try {
    const requisition = await labRequisitionService.cancelRequisition(
      req.params.id,
      req.body?.reason || '',
      req.user,
    );
    return sendSuccess(res, {
      message:   'Lab requisition cancelled.',
      data:      requisition,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listReferringDoctorsController = async (req, res, next) => {
  try {
    const doctors = await labRequisitionService.listReferringDoctors();
    return sendSuccess(res, {
      message:   'Referring doctors retrieved successfully.',
      data:      doctors,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
