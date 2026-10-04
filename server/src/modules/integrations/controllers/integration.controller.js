import * as integrationRegistry from '../services/integration-registry.service.js';
import * as integrationLogService from '../services/integration-log.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';

export const listIntegrationsController = async (req, res, next) => {
  try {
    const integrations = integrationRegistry.listIntegrations();
    return sendSuccess(res, { data: integrations, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const getIntegrationController = async (req, res, next) => {
  try {
    const integration = integrationRegistry.getIntegrationByKey(req.params.key);
    return sendSuccess(res, { data: integration, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

// --- Logs (Checkpoint 4 — Integration logging / authorization) ---

export const listIntegrationLogsController = async (req, res, next) => {
  try {
    const { integrationKey, status, page, limit } = req.query;
    const result = await integrationLogService.listIntegrationLogs({
      integrationKey,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendPaginated(res, { ...result, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};
