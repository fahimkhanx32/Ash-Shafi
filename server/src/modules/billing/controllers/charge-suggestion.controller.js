import * as chargeSuggestionService from '../services/charge-suggestion.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const createChargeSuggestionController = async (req, res, next) => {
  try {
    const suggestion = await chargeSuggestionService.createChargeSuggestion(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.INVOICE_CREATE,
      resourceType: 'ChargeSuggestion',
      resourceId: suggestion?._id,
      patientId: suggestion?.patientProfile?._id ?? suggestion?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Charge suggestion recorded.',
      data: suggestion,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listChargeSuggestionsController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await chargeSuggestionService.listChargeSuggestions(
      req.query,
      req.user,
    );

    return sendPaginated(res, {
      message: 'Charge suggestions retrieved successfully.',
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

export const dismissChargeSuggestionController = async (req, res, next) => {
  try {
    const suggestion = await chargeSuggestionService.dismissChargeSuggestion(
      req.params.id,
      req.body,
      req.user,
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVOICE_CANCEL,
      resourceType: 'ChargeSuggestion',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Charge suggestion dismissed.',
      data: suggestion,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
