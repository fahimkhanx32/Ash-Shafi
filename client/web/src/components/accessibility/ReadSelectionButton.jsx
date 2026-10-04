import { Volume2, Square } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useTextSelection } from '../../hooks/useTextSelection.js';
import { useSpeech } from '../../providers/SpeechProvider.jsx';

/**
 * FET-18 — "Read selected content". Mounted once, globally, inside
 * `AppShell` (see `AppShell.jsx`) — same "one instance, portal to
 * `document.body`" pattern `ToastProvider`/`ConfirmProvider` already
 * use, so it floats above page content and works identically no
 * matter which route is active underneath it.
 *
 * Appears just above a live text selection anywhere in the app;
 * clicking it reads that selection aloud via `useTextToSpeech`, then
 * turns into a Stop button for as long as it's speaking.
 */
export default function ReadSelectionButton() {
  const { t } = useTranslation();
  const { text, rect } = useTextSelection();
  const { supported, enabled, speaking, speakText, stop } = useSpeech();

  if (!supported || !enabled || !rect) return null;

  const handleClick = () => {
    if (speaking) {
      stop();
      return;
    }
    speakText(text);
  };

  const top = rect.top + window.scrollY - 44;
  const left = rect.left + window.scrollX + rect.width / 2;

  return createPortal(
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => e.preventDefault()} // don't steal the selection on click
      className="fixed z-[90] -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg hover:bg-accent"
      style={{ top: Math.max(top, 8), left }}
    >
      {speaking ? (
        <>
          <Square size={13} /> {t('accessibility.speech.stop')}
        </>
      ) : (
        <>
          <Volume2 size={13} /> {t('accessibility.speech.readAloud')}
        </>
      )}
    </button>,
    document.body,
  );
}
