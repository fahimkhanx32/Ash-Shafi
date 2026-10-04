import { createVoiceSession } from '../services/voice-session.service.js';
import { executeVoiceTool, listVoiceTools } from '../services/voice-tool-executor.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../middlewares/error.middleware.js';

export const createSessionController = async (req, res, next) => {
  try {
    const session = await createVoiceSession(req.user);
    const rawAuthHeader = req.get('authorization'); // "Bearer <token>" — already verified by `authenticate`

    return sendSuccess(res, {
      message: 'Voice session created.',
      data: {
        signedUrl: session.signedUrl,
        dynamicVariables: {
          ...session.dynamicVariables,
          auth_token: rawAuthHeader ? rawAuthHeader.replace(/^Bearer\s+/i, '') : null,
        },
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * `POST /api/v1/voice/tools/:toolName` — the single webhook URL every
 * ElevenLabs server tool in the agent's configuration points at
 * (master prompt §5 B, §11). `authenticate` (mounted on the whole
 * router — see `routes/voice.routes.js`) has already turned the
 * forwarded `auth_token` dynamic variable back into `req.user` by the
 * time this runs, exactly like every other authenticated route in
 * the project; there is no tool-specific auth here, only tool-
 * specific *authorization*, which `executeVoiceTool` handles by
 * looking up the required permission in the tool registry.
 */
export const executeToolController = async (req, res, next) => {
  try {
    if (env.elevenlabs.webhookSecret) {
      const provided = req.get('x-elevenlabs-webhook-secret');
      if (provided !== env.elevenlabs.webhookSecret) {
        throw new AppError('Invalid webhook secret.', 401, { code: 'INVALID_WEBHOOK_SECRET' });
      }
    }

    const result = await executeVoiceTool({
      toolName: req.params.toolName,
      args: req.body,
      actor: req.user,
      requestMeta: {
        ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
        userAgent: req.get?.('user-agent') ?? null,
      },
    });

    // Tool-level failures (bad args, permission denied, business-rule
    // error) are still a 200 with `success: false` in the body — the
    // ElevenLabs agent reads `message`/`success` out of the JSON
    // payload regardless of HTTP status, and a non-2xx here would
    // just make ElevenLabs treat this as a transport failure instead
    // of a tool result the agent should relay to the doctor.
    return sendSuccess(res, {
      message: result.message,
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listToolsController = (req, res) => {
  return sendSuccess(res, {
    message: 'Voice tools retrieved.',
    data: listVoiceTools(),
    requestId: req.requestId,
  });
};
