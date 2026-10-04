import apiClient from './apiClient.js';

/**
 * Requests a fresh ElevenLabs signed session from the backend
 * (`POST /api/v1/voice/session` — `voice-session.service.js`).
 *
 * Returns `{ signedUrl, dynamicVariables }`. `dynamicVariables`
 * includes `auth_token` (this doctor's own existing access token) —
 * the ElevenLabs agent's tool configuration must be set to forward
 * this back as `Authorization: Bearer {{auth_token}}` on every
 * server-tool webhook call; see `docs/elevenlabs-voice-agent.md` for
 * the exact agent-side setup this depends on.
 */
export const createVoiceSession = async () => {
  const { data } = await apiClient.post('/voice/session');
  return data.data; // apiClient responses are the `sendSuccess` envelope: { success, message, data }
};

export const listVoiceTools = async () => {
  const { data } = await apiClient.get('/voice/tools');
  return data.data;
};
