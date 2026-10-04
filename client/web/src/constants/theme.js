export const DEFAULT_PREFERENCES = Object.freeze({
  mode: 'SYSTEM',
  language: 'EN',
  colorTheme: 'TEAL',
  textColor: 'DEFAULT',
  typographyScale: 'MD',
  uiZoomPercent: 100,
  reducedMotion: false,
  highContrast: false,
  wallpaper: { type: 'NONE', value: null },
  // FET-18 — Text-to-Speech & Accessibility Interaction. `voiceName`
  // is null by default (= "Auto", let SpeechProvider pick the best
  // installed voice for the current app language via
  // `pickVoiceForLanguage`); set only when the user explicitly picks
  // a specific voice in Settings. Same persistence tier as every
  // other `uiPreferences` field here — client state -> localStorage
  // -> `PATCH /auth/me/preferences` (see `ThemeProvider.jsx`).
  speech: {
    enabled: true,
    rate: 1,
    pitch: 1,
    volume: 1,
    voiceName: null,
  },
});

export const COLOR_THEMES = [
  { value: 'TEAL', label: 'Teal (default)', swatch: '#0e7c86' },
  { value: 'ROSE', label: 'Rose', swatch: '#c23566' },
  { value: 'VIOLET', label: 'Violet', swatch: '#6d3fc9' },
  { value: 'SLATE', label: 'Slate', swatch: '#475569' },
];

// Text-color contrast fix follow-up — a curated set of body-text
// hues, each with a matched light-mode *and* dark-mode HSL pair
// defined in `index.css`'s `[data-text-color]` rules (mirrors
// `[data-color-theme]`'s pattern exactly). Swatches below are just
// for the settings picker UI; the actual applied color always comes
// from CSS so it automatically tracks whichever of light/dark/system
// is active — never a fixed hex the way a raw color-picker would be,
// which is exactly what could go invisible after a mode flip.
export const TEXT_COLOR_OPTIONS = [
  { value: 'DEFAULT', label: 'Default', swatchLight: '#28374a', swatchDark: '#e2e8f0' },
  { value: 'CHARCOAL', label: 'Charcoal', swatchLight: '#14181f', swatchDark: '#fafafa' },
  { value: 'NAVY', label: 'Navy', swatchLight: '#0f2a4d', swatchDark: '#cfe0f5' },
  { value: 'FOREST', label: 'Forest', swatchLight: '#173a26', swatchDark: '#c9e8d6' },
  { value: 'PLUM', label: 'Plum', swatchLight: '#3a1f42', swatchDark: '#e8cff0' },
];

// FET-17 — Multilingual UI & Localization: English and Bangla, per the master prompt's FET-17 scope. Adding another
// language means adding its `src/locales/<code>/translation.json`
// (see `lib/i18n.js`), one more entry here, and its persisted-code
// mapping in `lib/languageCode.js` — nothing else in
// `SettingsPage.jsx`/`LanguageSwitcher.jsx` changes.
export const LANGUAGE_OPTIONS = [
  { value: 'EN', labelKey: 'settings.language.en' },
  { value: 'BN', labelKey: 'settings.language.bn' },
];

// One UI-style quick mode toggle lives in the topbar (`ModeToggle.jsx`)
// as well as this list driving `SettingsPage`'s button group — same
// `labelKey` pattern as `LANGUAGE_OPTIONS` so both stay in sync with i18n.
export const MODE_OPTIONS = [
  { value: 'LIGHT', label: 'Light', labelKey: 'settings.themeMode.light' },
  { value: 'DARK', label: 'Dark', labelKey: 'settings.themeMode.dark' },
  { value: 'SYSTEM', label: 'Match system', labelKey: 'settings.themeMode.system' },
];

export const TYPOGRAPHY_SCALE_OPTIONS = [
  { value: 'SM', label: 'Small', multiplier: 0.9 },
  { value: 'MD', label: 'Default', multiplier: 1 },
  { value: 'LG', label: 'Large', multiplier: 1.125 },
  { value: 'XL', label: 'Extra large', multiplier: 1.25 },
];

// Built-in wallpapers only — see user.model.js's uiPreferences comment
// on why custom upload isn't built yet (needs BET-12's file pipeline).
export const WALLPAPER_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'meadow', label: 'Meadow' },
];

export const TYPOGRAPHY_SCALE_MULTIPLIER = TYPOGRAPHY_SCALE_OPTIONS.reduce(
  (acc, opt) => ({ ...acc, [opt.value]: opt.multiplier }),
  {},
);

export const PREFERENCES_STORAGE_KEY = 'ashshafi.uiPreferences';
