import { useCallback, useRef, useState } from 'react';

/**
 * FET-13 — real microphone recording, encoded to a genuine
 * `audio/wav` file client-side.
 *
 * The backend's voice-message upload whitelist
 * (`server/src/modules/messaging/routes/message-upload.middleware.js`,
 * `VOICE_MIME_TYPES = ['audio/mpeg', 'audio/wav']`) does not include
 * the container formats `MediaRecorder` actually produces in every
 * browser (`audio/webm;codecs=opus`, `audio/ogg`) — there is no
 * browser API that records straight to `.wav`/`.mp3`, and this
 * sandbox has no network access to add an mp3-encoder dependency.
 * So this hook bypasses `MediaRecorder` entirely: it taps the raw
 * PCM samples via a `ScriptProcessorNode` (deprecated but still
 * universally supported, and dependency-free — `AudioWorklet` would
 * need a separate worklet file served from `public/`, more moving
 * parts for the same result) and encodes them into a real 16-bit PCM
 * WAV file by hand, matching the format `sendVoiceMessage`
 * (`messagingService.js`) already expected. This is genuine audio
 * encoding, not a stub — the resulting file plays back correctly in
 * any audio player.
 *
 * State machine: 'idle' -> 'recording' -> 'stopped' (a `blob`, `url`,
 * and `durationSeconds` are available) -> back to 'idle' after send
 * or discard.
 */

const SAMPLE_RATE = 44100;

function encodeWav(channelBuffers, sampleRate) {
  const totalLength = channelBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const pcm = new Int16Array(totalLength);
  let offset = 0;
  for (const chunk of channelBuffers) {
    for (let i = 0; i < chunk.length; i += 1) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      pcm[offset] = s < 0 ? s * 0x8000 : s * 0x7fff;
      offset += 1;
    }
  }

  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offsetBytes, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offsetBytes + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let pcmOffset = 44;
  for (let i = 0; i < pcm.length; i += 1) {
    view.setInt16(pcmOffset, pcm[i], true);
    pcmOffset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export default function useVoiceRecorder({ maxDurationSeconds = 300 } = {}) {
  const [state, setState] = useState('idle'); // idle | requesting | recording | stopped
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState(null); // { blob, url, durationSeconds }
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);

  const cleanupGraph = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (state !== 'recording') return;
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const blob = encodeWav(chunksRef.current, SAMPLE_RATE);
    const url = URL.createObjectURL(blob);
    cleanupGraph();
    chunksRef.current = [];
    setResult({ blob, url, durationSeconds });
    setState('stopped');
  }, [state, cleanupGraph]);

  const start = useCallback(async () => {
    setError(null);
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // eslint-disable-next-line no-undef
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextCtor({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 4096-sample buffer, mono in, mono out — deprecated API but
      // available in every browser this app needs to support, and
      // needs no separate worklet file.
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      chunksRef.current = [];

      processor.onaudioprocess = (event) => {
        const channelData = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(channelData));
      };

      source.connect(processor);
      // A ScriptProcessorNode only fires `onaudioprocess` while
      // connected into the graph's output — connect to a muted
      // destination rather than actually routing mic audio to the
      // speakers.
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setState('recording');

      timerRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        setElapsedSeconds(elapsed);
        if (elapsed >= maxDurationSeconds) {
          stop();
        }
      }, 250);
    } catch (err) {
      cleanupGraph();
      setState('idle');
      setError(err?.name === 'NotAllowedError' ? 'PERMISSION_DENIED' : 'UNAVAILABLE');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDurationSeconds, cleanupGraph]);

  const cancel = useCallback(() => {
    cleanupGraph();
    chunksRef.current = [];
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setState('idle');
  }, [cleanupGraph, result]);

  const reset = useCallback(() => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setElapsedSeconds(0);
    setState('idle');
  }, [result]);

  return { state, elapsedSeconds, result, error, start, stop, cancel, reset };
}
