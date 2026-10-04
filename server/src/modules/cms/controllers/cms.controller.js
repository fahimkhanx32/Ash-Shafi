import * as cmsService from '../services/cms.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification, recordDeletion } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

// --- Services ---

export const listPublicServicesController = async (req, res, next) => {
  try {
    const services = await cmsService.listActiveServices();
    return sendSuccess(res, { data: services, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const listAllServicesController = async (req, res, next) => {
  try {
    const services = await cmsService.listAllServices();
    return sendSuccess(res, { data: services, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const createServiceController = async (req, res, next) => {
  try {
    const service = await cmsService.createService(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.CMS_SERVICE_CREATE,
      resourceType: 'Service',
      resourceId: service?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Service created successfully.',
      data: service,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateServiceController = async (req, res, next) => {
  try {
    const service = await cmsService.updateService(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_SERVICE_UPDATE,
      resourceType: 'Service',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Service updated successfully.',
      data: service,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteServiceController = async (req, res, next) => {
  try {
    await cmsService.deleteService(req.params.id);

    await recordDeletion(req, {
      action: AUDIT_ACTIONS.CMS_SERVICE_DELETE,
      resourceType: 'Service',
      resourceId: req.params.id,
    });

    return sendSuccess(res, { message: 'Service deleted successfully.', requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

// --- Homepage stats ---

export const listPublicStatsController = async (req, res, next) => {
  try {
    const stats = await cmsService.listActiveStats();
    return sendSuccess(res, { data: stats, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const listAllStatsController = async (req, res, next) => {
  try {
    const stats = await cmsService.listAllStats();
    return sendSuccess(res, { data: stats, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const createStatController = async (req, res, next) => {
  try {
    const stat = await cmsService.createStat(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.CMS_STAT_CREATE,
      resourceType: 'HomepageStat',
      resourceId: stat?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Homepage stat created successfully.',
      data: stat,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateStatController = async (req, res, next) => {
  try {
    const stat = await cmsService.updateStat(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_STAT_UPDATE,
      resourceType: 'HomepageStat',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Homepage stat updated successfully.',
      data: stat,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteStatController = async (req, res, next) => {
  try {
    await cmsService.deleteStat(req.params.id);

    await recordDeletion(req, {
      action: AUDIT_ACTIONS.CMS_STAT_DELETE,
      resourceType: 'HomepageStat',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Homepage stat deleted successfully.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// --- About content ---

export const getPublicAboutController = async (req, res, next) => {
  try {
    const about = await cmsService.getAboutContent();
    return sendSuccess(res, { data: about, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const upsertAboutController = async (req, res, next) => {
  try {
    const about = await cmsService.upsertAboutContent(req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_ABOUT_UPDATE,
      resourceType: 'AboutContent',
      resourceId: about?._id,
    });

    return sendSuccess(res, {
      message: 'About content saved successfully.',
      data: about,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
