import * as videoSessionService from '../services/video-session.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';

const requestMeta = (req) => ({
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'] || null,
});

export const createOrGetSessionController = async (req, res, next) => {
  try {
    const session = await videoSessionService.getOrCreateSessionForAppointment(
      req.params.appointmentId,
      req.user,
      requestMeta(req),
    );
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Video session ready.',
      data: session,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSessionController = async (req, res, next) => {
  try {
    const session = await videoSessionService.getSessionById(req.params.id, req.user, requestMeta(req));
    return sendSuccess(res, { message: 'Video session retrieved.', data: session, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const recordConsentController = async (req, res, next) => {
  try {
    const session = await videoSessionService.recordPatientConsent(req.params.id, req.user, requestMeta(req));
    return sendSuccess(res, { message: 'Consent recorded.', data: session, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const joinSessionController = async (req, res, next) => {
  try {
    const result = await videoSessionService.joinSession(req.params.id, req.user, requestMeta(req));
    return sendSuccess(res, {
      message: 'Joined video session.',
      data: {
        session: result.session,
        joinToken: result.joinToken,
        roomId: result.roomId,
        iceServers: result.iceServers,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const leaveSessionController = async (req, res, next) => {
  try {
    const session = await videoSessionService.leaveSession(req.params.id, req.user, requestMeta(req));
    return sendSuccess(res, { message: 'Left video session.', data: session, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const endSessionController = async (req, res, next) => {
  try {
    const session = await videoSessionService.endSession(
      req.params.id,
      req.user,
      { reason: req.body.reason },
      requestMeta(req),
    );
    return sendSuccess(res, { message: 'Video session ended.', data: session, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};
