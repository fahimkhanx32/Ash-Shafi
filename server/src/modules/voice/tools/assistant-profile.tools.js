import { updateUserPreferences } from '../../../auth/auth.service.js';

const DEFAULT_ASSISTANT_NAME = 'Ash-Shāfī Assistant';

/**
 * `get_assistant_profile` — naming master prompt §5.
 * The frontend also loads this on session start (§5) via the same
 * `PATCH /auth/me/preferences`-backed field; this tool exists so the
 * agent itself can answer "what's your name?" from the authoritative
 * source rather than only from whatever dynamic variable the
 * frontend happened to pass in at session start.
 */
export const getAssistantProfileTool = async (_args, actor) => {
  const assistantName = actor.uiPreferences?.voiceAssistant?.assistantName || DEFAULT_ASSISTANT_NAME;
  return {
    success: true,
    action: 'get_assistant_profile',
    message: `My name is ${assistantName}.`,
    assistantName,
  };
};

/**
 * `set_assistant_name` — naming master prompt §4/§14 (acceptance
 * test). Persists through the exact same `updateUserPreferences`
 * merge path `PATCH /auth/me/preferences` uses — a name change made
 * by voice and one made through a future Settings UI panel end up in
 * the same field, survive refresh/logout (§11) the same way, and
 * never touch role/permissions (§8).
 */
export const setAssistantNameTool = async ({ name }, actor) => {
  const previousName = actor.uiPreferences?.voiceAssistant?.assistantName || DEFAULT_ASSISTANT_NAME;
  await updateUserPreferences(actor._id, { voiceAssistant: { assistantName: name } });
  return {
    success: true,
    action: 'set_assistant_name',
    message: `Sure. You can call me ${name}.`,
    assistantName: name,
    previousName,
    // Naming spec §32 — consumed (and stripped before the result
    // reaches the agent) by `executeVoiceTool` for the audit entry.
    auditMetadata: { previousName, newName: name },
  };
};
