import * as messageService from '../services/message.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordDeletion, recordFileAccess } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

const requestMetaFrom = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

/**
 * A `TEXT` message must actually carry text; every other message
 * type (`IMAGE`/`DOCUMENT`/`VOICE`) must carry the attachment that
 * gives it meaning — a `TEXT` message is never allowed to smuggle a
 * file in under it (the model's `attachment` field exists precisely
 * to represent IMAGE/DOCUMENT/VOICE, not a caption-only text message
 * with a bonus file). Checked here rather than in the Joi body
 * schema because the presence of `req.file` is only known after
 * `receiveMessageAttachment` (multer) has run, which happens before
 * `validateBody` but whose result Joi cannot see.
 */
export const assertContentMatchesType = (req) => {
  const { messageType, content } = req.body;

  if (messageType === 'TEXT') {
    if (req.file) {
      throw new AppError('A TEXT message cannot carry a file attachment.', 400, {
        code: 'UNEXPECTED_ATTACHMENT',
      });
    }
    if (!content || !content.trim()) {
      throw new AppError('Message content is required for a TEXT message.', 400, {
        code: 'CONTENT_REQUIRED',
      });
    }
    return;
  }

  if (!req.file) {
    throw new AppError(`A ${messageType} message requires a file attachment.`, 400, {
      code: 'ATTACHMENT_REQUIRED',
    });
  }
};

export const sendMessageController = async (req, res, next) => {
  try {
    assertContentMatchesType(req);

    const message = await messageService.sendMessage({
      conversationId: req.params.id,
      actor: req.user,
      content: req.body.content || '',
      messageType: req.body.messageType,
      attachmentFile: req.file || null,
      durationSeconds: req.body.durationSeconds ?? null,
      requestMeta: requestMetaFrom(req),
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Message sent successfully.',
      data: message,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listMessagesController = async (req, res, next) => {
  try {
    const result = await messageService.listMessages(
      req.params.id,
      req.user,
      req.query,
      requestMetaFrom(req),
    );
    return sendPaginated(res, {
      message: 'Messages retrieved successfully.',
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

export const markConversationReadController = async (req, res, next) => {
  try {
    const result = await messageService.markConversationRead(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Conversation marked as read.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMessageController = async (req, res, next) => {
  try {
    const message = await messageService.deleteMessage(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );

    await recordDeletion(req, {
      action: AUDIT_ACTIONS.MESSAGE_DELETE,
      resourceType: 'Message',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Message deleted.',
      data: message,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const downloadMessageAttachmentController = async (req, res, next) => {
  try {
    const file = await messageService.getMessageAttachmentForDownload(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );

    await recordFileAccess(req, {
      action: AUDIT_ACTIONS.MESSAGE_ATTACHMENT_DOWNLOAD,
      resourceType: 'Message',
      resourceId: req.params.id,
    });

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
