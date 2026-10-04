import { createContext, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from './ThemeProvider.jsx';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { toI18nCode } from '../lib/languageCode.js';

const SpeechContext = createContext(null);

const PREFERENCE_TO_BCP47 = { en: 'en-US', bn: 'bn-BD' };

/**
 * FET-18 — one shared TTS session for the whole app, layered on top
 * of `useTextToSpeech` (the raw Web Speech API hook) so every
 * consumer — `ReadSelectionButton`, `SpeechControlsBar`, the
 * Topbar's "Read this page" button, `SettingsPage`'s speech section
 * — reads/controls the exact same in-flight utterance instead of
 * each holding its own disconnected `speaking`/`paused` state (the
 * underlying browser `speechSynthesis` queue is a single global
 * resource regardless; this just makes the React state match that
 * reality). Mirrors `ThemeProvider`'s "one provider, everyone reads
 * through `useX()`" shape.
 *
 * `speakText()` is the one entry point every caller should use
 * instead of the raw hook's `speak()` — it applies the user's
 * persisted speech preferences (rate/pitch/volume/voice, the
 * `speech.enabled` kill switch) and the app's current language
 * automatically, so no caller has to re-derive any of that itself.
 */
export function SpeechProvider({ children }) {
  const { preferences } = useTheme();
  const { i18n } = useTranslation();
  const tts = useTextToSpeech();
  const speechPrefs = preferences.speech || {};
  const enabled = speechPrefs.enabled !== false;

  const speakText = useCallback(
    (text, overrides = {}) => {
      if (!enabled || !tts.supported) return;
      const lang = overrides.lang || PREFERENCE_TO_BCP47[toI18nCode(preferences.language)] || 'en-US';
      tts.speak(text, {
        rate: overrides.rate ?? speechPrefs.rate ?? 1,
        pitch: overrides.pitch ?? speechPrefs.pitch ?? 1,
        volume: overrides.volume ?? speechPrefs.volume ?? 1,
        voiceName: overrides.voiceName ?? speechPrefs.voiceName ?? null,
        lang,
      });
    },
    [enabled, tts, speechPrefs.rate, speechPrefs.pitch, speechPrefs.volume, speechPrefs.voiceName, preferences.language],
  );

  /**
   * "Read this page" — reads the main content region's visible text.
   * Deliberately targets `<main>` (the one `AppShell.jsx` always
   * renders around every dashboard route's `<Outlet/>`) rather than
   * `document.body`, so the sidebar/topbar chrome and any open toast
   * aren't read aloud along with the actual page content.
   */
  const readMainContent = useCallback(() => {
    const main = document.querySelector('main');
    const text = main?.innerText?.trim();
    if (text) speakText(text);
  }, [speakText]);

  const value = useMemo(
    () => ({
      supported: tts.supported,
      voices: tts.voices,
      speaking: tts.speaking,
      paused: tts.paused,
      enabled,
      speakText,
      readMainContent,
      stop: tts.stop,
      pause: tts.pause,
      resume: tts.resume,
    }),
    [tts.supported, tts.voices, tts.speaking, tts.paused, enabled, speakText, readMainContent, tts.stop, tts.pause, tts.resume],
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech() {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error('useSpeech must be used within a SpeechProvider');
  return ctx;
}
