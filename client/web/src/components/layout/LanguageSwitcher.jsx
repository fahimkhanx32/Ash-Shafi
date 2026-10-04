import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

import { useTheme } from '../../providers/ThemeProvider.jsx';
import { LANGUAGE_OPTIONS } from '../../constants/theme.js';

/**
 * i18n gap-closure pass — a compact EN/BN switcher living in the
 * topbar (available everywhere, not just buried in Settings).
 * Reuses `useTheme().updatePreferences` (FET-03's persistence layer)
 * so a language change here is the exact same call, and follows the
 * exact same React state -> localStorage -> `PATCH
 * /auth/me/preferences` layering, as changing it from `SettingsPage`.
 */
export default function LanguageSwitcher() {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('common.language')}
        title={t('common.language')}
        className="flex items-center justify-center h-11 w-11 rounded-full text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
      >
        <Languages size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-card p-1.5 shadow-one-ui-lg z-50 animate-fade-in"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={preferences.language === opt.value}
              onClick={() => {
                updatePreferences({ language: opt.value });
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-sm font-medium rounded-lg hover:bg-accent/60 text-left ${
                preferences.language === opt.value ? 'text-primary' : ''
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
