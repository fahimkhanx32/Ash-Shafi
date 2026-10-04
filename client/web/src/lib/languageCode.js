/**
 * FET-17 — Multilingual UI & Localization.
 *
 * Single source of truth for the mapping between the persisted
 * preference code (`uiPreferences.language` — `'EN' | 'BN'`,
 * see `constants/theme.js#LANGUAGE_OPTIONS` and the backend's
 * `user.model.js`/`auth.validation.js` enums) and the lowercase code
 * i18next/the `lang`/`dir` DOM attributes use (`'en' | 'bn'`).
 *
 * Before this file, `lib/i18n.js`, `providers/ThemeProvider.jsx` and
 * `lib/applyTheme.js` each carried their own `=== 'BN' ? 'bn' : 'en'`
 * ternary — harmless while there were only two languages, but a
 * three-way (and growing) mapping duplicated three times is exactly
 * the kind of drift this project's own "one place to change it"
 * convention (see `lib/dateFormat.js`'s header) exists to avoid.
 * Adding a fourth language is one new entry in `PREFERENCE_TO_I18N`
 * below, not a hunt across three files.
 */
const PREFERENCE_TO_I18N = {
  EN: 'en',
  BN: 'bn',
};

const DEFAULT_I18N_CODE = 'en';

/** `'BN'` -> `'bn'`. Unknown/missing codes fall back to English. */
export function toI18nCode(preferenceLanguage) {
  return PREFERENCE_TO_I18N[preferenceLanguage] || DEFAULT_I18N_CODE;
}

/**
 * "RTL readiness where required" (FET-17) — neither English nor
 * Bangla is an RTL script, so this set is empty today, but
 * `applyTheme.js` reads `dir` through it rather than hardcoding
 * `"ltr"`, so adding a real RTL language later (Urdu/Arabic) is a
 * one-line addition here, not a layout rewrite. Mirrors the exact
 * same pattern already shipped in the public website
 * (`client/website/src/i18n/routing.js`'s `RTL_LOCALES`).
 */
export const RTL_LANGUAGE_CODES = new Set();

export function isRtl(i18nCode) {
  return RTL_LANGUAGE_CODES.has(i18nCode);
}
