import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useSpeech } from '../../providers/SpeechProvider.jsx';

/**
 * FET-18 — "Voice/read controls". A persistent, bottom-centered
 * dock that appears the moment anything is being read aloud
 * (selection, or the whole page via `ReadPageButton`) and
 * disappears the moment speech ends — same portal-to-`document.body`
 * pattern as `ReadSelectionButton`/`ToastProvider`, mounted once in
 * `AppShell` so it's available no matter which route triggered the
 * speech.
 */
export default function SpeechControlsBar() {
  const { t } = useTranslation();
  const { supported, speaking, paused, pause, resume, stop } = useSpeech();

  if (!supported || !speaking) return null;

  return createPortal(
    <div
      role="region"
      aria-label={t('accessibility.speech.controlsLabel')}
      className="fixed bottom-20 lg:bottom-6 left-1/2 z-[90] -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg"
    >
      <Volume2 size={16} className="text-primary shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
        {paused ? t('accessibility.speech.paused') : t('accessibility.speech.speaking')}
      </span>
      <button
        type="button"
        onClick={paused ? resume : pause}
        aria-label={paused ? t('accessibility.speech.resume') : t('accessibility.speech.pause')}
        className="rounded-full p-1.5 hover:bg-accent"
      >
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
      <button
        type="button"
        onClick={stop}
        aria-label={t('accessibility.speech.stop')}
        className="rounded-full p-1.5 hover:bg-accent"
      >
        <Square size={15} />
      </button>
    </div>,
    document.body,
  );
}
