import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en/translation.json';
import bn from '../locales/bn/translation.json';
import { PREFERENCES_STORAGE_KEY, DEFAULT_PREFERENCES } from '../constants/theme.js';
import { toI18nCode } from './languageCode.js';

/**
 * i18n — English + Bangla, architected so a fourth
 * language is just a new `src/locales/<code>/translation.json` +
 * one line here + one entry in `languageCode.js`.
 *
 * Deliberately NOT using `i18next-browser-languagedetector`: this
 * project already has a single, authoritative preference-persistence
 * layer for exactly this kind of setting — `uiPreferences` (FET-03),
 * layered React state → localStorage → backend `PATCH
 * /auth/me/preferences` — and `language` was added to that same
 * subdocument (see `user.model.js`) rather than building a second,
 * competing persistence mechanism. This file only needs to know the
 * *initial* language before `ThemeProvider` mounts (to avoid an
 * English-then-Bangla flash), which it reads directly
 * from the same localStorage key `applyTheme.js` already owns.
 */
function readInitialLanguage() {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    return toI18nCode(stored?.language || DEFAULT_PREFERENCES.language);
  } catch {
    return 'en';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bn: { translation: bn },
  },
  lng: readInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18n;
