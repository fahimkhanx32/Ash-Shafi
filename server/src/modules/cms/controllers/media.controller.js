import * as mediaService from '../services/media.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { recordCreation, recordDeletion } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const uploadMediaController = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file was uploaded.', 400, { code: 'FILE_REQUIRED' });
    }
    const media = await mediaService.uploadMedia(req.file, req.user, {
      altText: req.body.altText,
    });

    await recordCreation(req, {
      action: AUDIT_ACTIONS.MEDIA_UPLOAD,
      resourceType: 'Media',
      resourceId: media?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Media uploaded successfully.',
      data: media,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listMediaController = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    const result = await mediaService.listMedia({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendPaginated(res, { ...result, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const deleteMediaController = async (req, res, next) => {
  try {
    await mediaService.deleteMedia(req.params.id);

    await recordDeletion(req, {
      action: AUDIT_ACTIONS.MEDIA_DELETE,
      resourceType: 'Media',
      resourceId: req.params.id,
    });

    return sendSuccess(res, { message: 'Media deleted successfully.', requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};
