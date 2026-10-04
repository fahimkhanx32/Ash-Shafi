import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';

import { useTheme } from '../../providers/ThemeProvider.jsx';
import { resolveIsDark } from '../../lib/applyTheme.js';

/**
 * One UI-style quick mode switch — reachable in one tap from the
 * topbar, not buried inside Settings > Appearance. Reuses the exact
 * same `useTheme().updatePreferences` call `SettingsPage`'s Theme
 * Mode card already uses, so both stay perfectly in sync; this is
 * purely a second, faster entry point to the same state.
 *
 * Deliberately a direct two-state toggle (Light <-> Dark) rather than
 * the earlier three-way LIGHT/DARK/SYSTEM dropdown — one click always
 * flips to the other mode, no menu to open first. `SYSTEM` is still a
 * valid preference (and still offered in `SettingsPage`'s Theme Mode
 * card via `MODE_OPTIONS`); this toggle just resolves it with the same
 * `resolveIsDark` helper the DOM class itself is derived from, so if a
 * user arrives here already in SYSTEM mode, the very next click still
 * does the obviously-correct thing (flips away from whatever is
 * currently showing) instead of cycling through a third state.
 */
export default function ModeToggle() {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useTheme();

  const isDark = resolveIsDark(preferences);
  const nextMode = isDark ? 'LIGHT' : 'DARK';
  const label = t(isDark ? 'settings.themeMode.light' : 'settings.themeMode.dark');

  return (
    <button
      type="button"
      onClick={() => updatePreferences({ mode: nextMode })}
      aria-label={label}
      title={label}
      className="flex items-center justify-center h-11 w-11 rounded-full text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
