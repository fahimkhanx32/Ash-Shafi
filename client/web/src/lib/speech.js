/**
 * FET-18 — Text-to-Speech & Accessibility Interaction.
 *
 * Thin wrapper over the browser's native `speechSynthesis` API
 * (Web Speech API). Deliberately no dependency added for this —
 * every evergreen browser has implemented `speechSynthesis` for
 * years, and this project already has precedent (BET-18's zip
 * writer, BET-13's voice *recorder* via `MediaRecorder`) for
 * preferring a native browser API over a new package for a
 * narrow, well-supported need. `useTextToSpeech.js` is the React
 * layer on top of this; nothing here touches React.
 */

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * `speechSynthesis.getVoices()` is notoriously synchronous-empty on
 * first call in Chrome — the real list only arrives via the
 * `voiceschanged` event, sometime after page load. This resolves
 * once real voices are available (or immediately if they already
 * are), with a timeout fallback so a browser that never fires the
 * event (rare, but happens on some embedded webviews) doesn't hang
 * a caller forever.
 */
export function getVoices() {
  if (!isSpeechSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (voices) => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(voices);
    };
    const onVoicesChanged = () => finish(synth.getVoices());
    synth.addEventListener('voiceschanged', onVoicesChanged);
    // Fallback: some browsers populate voices synchronously on a
    // microtask/short delay without ever firing the event.
    setTimeout(() => finish(synth.getVoices()), 1000);
  });
}

/**
 * Picks the best available voice for a given BCP-47-ish language
 * code (e.g. `'bn-BD'`, `'en-US'`). Tries an exact match
 * first, then a same-language-family prefix match (`'bn'` matches
 * `'bn-IN'` even if `'bn-BD'` isn't installed), then falls back to
 * `null` (letting the browser's own default voice speak — always
 * better than throwing or silently not speaking at all).
 */
export function pickVoiceForLanguage(voices, langCode) {
  if (!Array.isArray(voices) || voices.length === 0 || !langCode) return null;
  const target = langCode.toLowerCase();
  const targetPrefix = target.split('-')[0];

  const exact = voices.find((v) => v.lang?.toLowerCase() === target);
  if (exact) return exact;

  const familyMatch = voices.find((v) => v.lang?.toLowerCase().startsWith(`${targetPrefix}-`) || v.lang?.toLowerCase() === targetPrefix);
  if (familyMatch) return familyMatch;

  return null;
}

/**
 * Builds (but does not speak) a configured `SpeechSynthesisUtterance`.
 * Kept separate from `speak()` below so `useTextToSpeech` can attach
 * its own event handlers before dispatching.
 */
export function buildUtterance(text, { rate = 1, pitch = 1, volume = 1, voice = null, lang = null } = {}) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = clamp(rate, 0.5, 2);
  utterance.pitch = clamp(pitch, 0, 2);
  utterance.volume = clamp(volume, 0, 1);
  if (voice) utterance.voice = voice;
  else if (lang) utterance.lang = lang;
  return utterance;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Cancels whatever the browser is currently speaking/queued, if anything. */
export function cancelSpeech() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
