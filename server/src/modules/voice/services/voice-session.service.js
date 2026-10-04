import { env } from '../../../config/env.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

const ELEVENLABS_SIGNED_URL_ENDPOINT = 'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url';

const DEFAULT_ASSISTANT_NAME = 'Ash-Shāfī Assistant';

/**
 * Creates a fresh ElevenLabs conversation session for the authenticated
 * doctor (master prompt §6, §35).
 *
 * ONE agent configuration (`ELEVENLABS_AGENT_ID`) is shared by every
 * doctor (naming master prompt §6/§13) — what's per-request here is
 * only the signed URL (short-lived, ties this one browser session to
 * that one agent) and the `dynamic_variables` passed alongside it:
 *   - `auth_token`: the doctor's own existing access token
 *     (`req.headers.authorization`, already verified by `authenticate`
 *     before this ever runs). The ElevenLabs agent's *own* tool
 *     configuration should be set to forward this back as
 *     `Authorization: Bearer {{auth_token}}` on every server-tool
 *     webhook call to `POST /api/v1/voice/tools/:toolName` — which is
 *     exactly what lets that route reuse the project's ordinary
 *     `authenticate` + `authorize` middleware with no second auth
 *     system (master prompt §8, §35, docs/elevenlabs-voice-agent.md).
 *   - `assistant_name`: today's persona name for this doctor (naming
 *     master prompt §6), so the agent's own system prompt can
 *     interpolate `{{assistant_name}}` and introduce itself correctly
 *     from turn one, without waiting for a `get_assistant_profile`
 *     tool round-trip.
 *
 * Never called from, and never returns, the raw `ELEVENLABS_API_KEY`
 * — that stays server-side (master prompt §33).
 */
export const createVoiceSession = async (actor) => {
  if (!env.elevenlabs.isConfigured) {
    throw new AppError(
      'Voice assistant is not configured yet. An administrator needs to set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID.',
      503,
      { code: 'VOICE_NOT_CONFIGURED' },
    );
  }

  const url = `${ELEVENLABS_SIGNED_URL_ENDPOINT}?agent_id=${encodeURIComponent(env.elevenlabs.agentId)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'xi-api-key': env.elevenlabs.apiKey },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to reach ElevenLabs while creating a voice session.');
    throw new AppError('Could not reach the voice service. Please try again shortly.', 502, {
      code: 'VOICE_UPSTREAM_UNREACHABLE',
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error({ status: response.status, body }, 'ElevenLabs rejected the signed-url request.');
    throw new AppError('The voice service could not start a session.', 502, {
      code: 'VOICE_UPSTREAM_ERROR',
    });
  }

  const { signed_url: signedUrl } = await response.json();

  const assistantName = actor.uiPreferences?.voiceAssistant?.assistantName || DEFAULT_ASSISTANT_NAME;

  return {
    signedUrl,
    dynamicVariables: {
      auth_token: null, // filled in by the controller, which alone has the raw bearer token off `req`
      assistant_name: assistantName,
      current_user_role: actor.role,
    },
  };
};
