import * as pageService from '../services/page.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification, recordDeletion } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

/**
 * BET-16 — Pages.
 *
 * Checkpoint 1 wired plain CRUD + public (published-only) reads.
 * Checkpoint 2 adds the publish/unpublish/archive action endpoints
 * below, gated on `WEBSITE_PUBLISH` (separate from the `WEBSITE_MANAGE`
 * draft/edit permission — see `security/permissions.js`).
 */

// --- Admin ---

export const createPageController = async (req, res, next) => {
  try {
    const page = await pageService.createPage(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.CMS_PAGE_CREATE,
      resourceType: 'Page',
      resourceId: page?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Page created successfully.',
      data: page,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPagesController = async (req, res, next) => {
  try {
    const { status, pageType, search, page, limit } = req.query;
    const result = await pageService.listPages({
      status,
      pageType,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendPaginated(res, { ...result, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const getPageController = async (req, res, next) => {
  try {
    const page = await pageService.getPageById(req.params.id);
    return sendSuccess(res, { data: page, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const updatePageController = async (req, res, next) => {
  try {
    const page = await pageService.updatePage(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_PAGE_UPDATE,
      resourceType: 'Page',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Page updated successfully.',
      data: page,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePageController = async (req, res, next) => {
  try {
    await pageService.deletePage(req.params.id);

    await recordDeletion(req, {
      action: AUDIT_ACTIONS.CMS_PAGE_DELETE,
      resourceType: 'Page',
      resourceId: req.params.id,
    });

    return sendSuccess(res, { message: 'Page deleted successfully.', requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

// --- Publish / unpublish / archive (Checkpoint 2) ---

export const publishPageController = async (req, res, next) => {
  try {
    const page = await pageService.publishPage(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_PAGE_PUBLISH,
      resourceType: 'Page',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Page published successfully.',
      data: page,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const unpublishPageController = async (req, res, next) => {
  try {
    const page = await pageService.unpublishPage(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_PAGE_UNPUBLISH,
      resourceType: 'Page',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Page unpublished and reverted to draft.',
      data: page,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const archivePageController = async (req, res, next) => {
  try {
    const page = await pageService.archivePage(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_PAGE_ARCHIVE,
      resourceType: 'Page',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Page archived successfully.',
      data: page,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// --- Public ---

export const listPublishedPagesController = async (req, res, next) => {
  try {
    const { pageType, page, limit } = req.query;
    const result = await pageService.listPublishedPages({
      pageType,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendPaginated(res, { ...result, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const getPublishedPageBySlugController = async (req, res, next) => {
  try {
    const page = await pageService.getPublishedPageBySlug(req.params.slug);
    return sendSuccess(res, { data: page, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};
