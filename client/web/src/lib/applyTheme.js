import {
  DEFAULT_PREFERENCES,
  TYPOGRAPHY_SCALE_MULTIPLIER,
  PREFERENCES_STORAGE_KEY,
} from '../constants/theme.js';
import { toI18nCode, isRtl } from './languageCode.js';

/**
 * Reads the locally-cached preferences (set on every change, kept in
 * sync with the backend once authenticated — see ThemeProvider.jsx).
 * Used both by ThemeProvider itself and by the early bootstrap
 * `<script type="module">` in `index.html`, so the very first paint
 * already has the right theme instead of flashing light/default and
 * then switching — best-effort: a module script is still deferred, so
 * a very brief unstyled flash on a cold load is possible, but this
 * removes the far more noticeable "flip after React mounts" flash.
 */
export function readStoredPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function storePreferences(prefs) {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (private mode, quota) — preferences still
    // apply for this session via React state, just won't persist.
  }
}

/**
 * Resolves a preferences object's `mode` (LIGHT/DARK/SYSTEM) against
 * the live OS `prefers-color-scheme` media query to a plain boolean.
 * Exported so any component that needs to know "is dark mode active
 * right now" (e.g. a component rendering a non-Tailwind widget that
 * can't just rely on the `.dark` class cascading, like an MUI
 * `ThemeProvider`) can ask this directly instead of re-deriving the
 * same SYSTEM-resolution logic a second time.
 */
export function resolveIsDark(prefs) {
  const p = { ...DEFAULT_PREFERENCES, ...prefs };
  const prefersDarkOS =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return p.mode === 'DARK' || (p.mode === 'SYSTEM' && prefersDarkOS);
}

/**
 * Applies a preferences object to `document.documentElement`: dark
 * mode class (resolving SYSTEM against the OS media query), color
 * theme + contrast + wallpaper data attributes, typography scale ×
 * zoom CSS variables, and the reduced-motion class.
 */
export function applyPreferencesToDocument(prefs) {
  const root = document.documentElement;
  const p = { ...DEFAULT_PREFERENCES, ...prefs };

  // FET-17 — Multilingual UI & Localization. `dir` reads through
  // `isRtl()` rather than hardcoding `"ltr"`: neither EN nor BN is
  // RTL scripts today, but a future RTL language addition (Urdu/
  // Arabic) becomes a one-line change in `languageCode.js`, not a
  // layout rewrite — same "RTL readiness where required" pattern
  // already shipped on the public website.
  const langCode = toI18nCode(p.language);
  root.setAttribute('lang', langCode);
  root.setAttribute('dir', isRtl(langCode) ? 'rtl' : 'ltr');

  const isDark = resolveIsDark(p);
  root.classList.toggle('dark', Boolean(isDark));

  root.setAttribute('data-color-theme', (p.colorTheme || 'TEAL').toLowerCase());
  root.setAttribute('data-text-color', (p.textColor || 'DEFAULT').toLowerCase());
  root.setAttribute('data-contrast', p.highContrast ? 'high' : 'normal');

  const wallpaperValue =
    p.wallpaper?.type === 'BUILT_IN' && p.wallpaper.value ? p.wallpaper.value : 'none';
  // Applied to <body>, not <html> — AppShell's root wrapper intentionally
  // has no opaque background so this shows through underneath the
  // sidebar/topbar/cards (which do have their own solid backgrounds).
  document.body.setAttribute('data-wallpaper', wallpaperValue);

  const scale = TYPOGRAPHY_SCALE_MULTIPLIER[p.typographyScale] || 1;
  const zoom = (p.uiZoomPercent || 100) / 100;
  root.style.setProperty('--typography-scale', String(scale));
  root.style.setProperty('--ui-zoom', String(zoom));

  const prefersReducedMotionOS =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  root.classList.toggle('motion-reduce', Boolean(p.reducedMotion || prefersReducedMotionOS));
}
