import * as conversationService from '../services/conversation.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';

const requestMetaFrom = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

export const createConversationController = async (req, res, next) => {
  try {
    const conversation = await conversationService.findOrCreateConversation(req.body, req.user);
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Conversation ready.',
      data: conversation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyConversationsController = async (req, res, next) => {
  try {
    const result = await conversationService.listMyConversations(req.user, req.query);
    return sendPaginated(res, {
      message: 'Your conversations retrieved successfully.',
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

/** Admin-tier only — see `requireAdminTier` in routes/conversation.routes.js. */
export const listConversationsForAdminController = async (req, res, next) => {
  try {
    const result = await conversationService.listConversationsForAdmin(req.query);
    return sendPaginated(res, {
      message: 'Conversations retrieved successfully.',
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

export const getConversationController = async (req, res, next) => {
  try {
    const conversation = await conversationService.getConversationById(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Conversation retrieved successfully.',
      data: conversation,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export { requestMetaFrom };
