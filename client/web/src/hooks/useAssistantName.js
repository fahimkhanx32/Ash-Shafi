import { useAuth } from '../providers/AuthProvider.jsx';

export const DEFAULT_ASSISTANT_NAME = 'Ash-Shāfī Assistant';

/**
 * The doctor's own assistant name, read from the server-backed user
 * record (`user.uiPreferences.voiceAssistant.assistantName`) — the
 * server is the source of truth, never localStorage (naming spec §11).
 * Falls back to the default only when the doctor never customised it.
 * `refreshCurrentUser` re-pulls the record, so a rename made by voice
 * or from Settings shows up everywhere without a page reload.
 */
export function useAssistantName() {
  const { user, refreshCurrentUser } = useAuth();
  const assistantName = user?.uiPreferences?.voiceAssistant?.assistantName || DEFAULT_ASSISTANT_NAME;
  return { assistantName, refreshAssistantName: refreshCurrentUser };
}
