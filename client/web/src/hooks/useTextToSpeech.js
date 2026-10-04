import { useCallback, useEffect, useRef, useState } from 'react';

import { isSpeechSupported, getVoices, pickVoiceForLanguage, buildUtterance, cancelSpeech } from '../lib/speech.js';

/**
 * FET-18 — Text-to-Speech.
 *
 * One hook per mounted consumer, but all of them share the single
 * browser-global `speechSynthesis` queue (there is only ever one —
 * that's a Web Speech API constraint, not a limitation added here).
 * Calling `speak()` always cancels whatever was previously speaking
 * first, so two consumers on the same page can't talk over each
 * other; the last `speak()` call wins, same behavior a user would
 * expect from a single "read this" affordance regardless of which
 * component triggered it.
 */
export function useTextToSpeech() {
  const supported = isSpeechSupported();
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    getVoices().then((v) => {
      if (!cancelled) setVoices(v);
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  // Stop any in-flight speech when the consuming component unmounts —
  // otherwise navigating away mid-sentence leaves the browser talking
  // over the next page with no visible control to stop it.
  useEffect(() => {
    return () => {
      if (supported) cancelSpeech();
    };
  }, [supported]);

  const speak = useCallback(
    (text, { rate, pitch, volume, lang, voiceName } = {}) => {
      if (!supported || !text || !text.trim()) return;

      cancelSpeech();

      const voice = voiceName ? voices.find((v) => v.name === voiceName) : pickVoiceForLanguage(voices, lang);
      const utterance = buildUtterance(text, { rate, pitch, volume, voice, lang });

      utterance.onstart = () => {
        setSpeaking(true);
        setPaused(false);
      };
      utterance.onend = () => {
        setSpeaking(false);
        setPaused(false);
      };
      utterance.onerror = () => {
        setSpeaking(false);
        setPaused(false);
      };
      utterance.onpause = () => setPaused(true);
      utterance.onresume = () => setPaused(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported, voices],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    cancelSpeech();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported || !speaking) return;
    window.speechSynthesis.pause();
  }, [supported, speaking]);

  const resume = useCallback(() => {
    if (!supported || !paused) return;
    window.speechSynthesis.resume();
  }, [supported, paused]);

  return { supported, voices, speaking, paused, speak, stop, pause, resume };
}
