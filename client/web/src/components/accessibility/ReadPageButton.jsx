import { Volume2, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSpeech } from '../../providers/SpeechProvider.jsx';

/**
 * FET-18 — "Voice/read controls", topbar entry point. Reads the
 * current route's main content aloud (see `SpeechProvider.readMainContent`).
 * Hidden entirely when the browser has no speech support or the
 * user has turned the feature off in Settings (`speech.enabled`) —
 * same "don't show a control that can't do anything" convention the
 * global search box in `Topbar.jsx` already follows for a different
 * reason (disabled with an explanatory title rather than removed).
 */
export default function ReadPageButton() {
  const { t } = useTranslation();
  const { supported, enabled, speaking, readMainContent, stop } = useSpeech();

  if (!supported || !enabled) return null;

  return (
    <button
      type="button"
      onClick={speaking ? stop : readMainContent}
      aria-label={speaking ? t('accessibility.speech.stop') : t('accessibility.speech.readPage')}
      title={speaking ? t('accessibility.speech.stop') : t('accessibility.speech.readPage')}
      className="text-muted-foreground hover:text-foreground grid min-h-[44px] min-w-[44px] place-items-center rounded-lg hover:bg-accent"
    >
      {speaking ? <Square size={18} /> : <Volume2 size={18} />}
    </button>
  );
}
