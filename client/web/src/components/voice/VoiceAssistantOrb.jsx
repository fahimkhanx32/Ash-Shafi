import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Loader2, X, RefreshCw, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useVoiceAgent } from '../../providers/VoiceAgentProvider.jsx';
import voiceAssistantIcon from '../../assets/voice-assistant.svg';

/**
 * FET-16 — mounted once in `AppShell.jsx` for roles in
 * `VOICE_ASSISTANT_ACCESS_ROLES`. A compact floating orb that
 * expands into a small panel (master prompt §24) rather than a
 * full chat window — the assistant is meant to be operated by voice,
 * not typed at, so there's no message list/input box here, only
 * connection state and a mute/end control.
 */
export default function VoiceAssistantOrb() {
  const { t } = useTranslation();
  const {
    assistantName,
    status,
    isSpeaking,
    isMuted,
    setMuted,
    connecting,
    reconnecting,
    lastError,
    transcript,
    activity,
    pendingConfirmation,
    confirmPending,
    denyPending,
    mode,
    setMode,
    start,
    stop,
  } = useVoiceAgent();
  const [expanded, setExpanded] = useState(false);

  const connected = status === 'connected';

  // One explicit state for the indicator (master prompt §36).
  const phase = lastError
    ? 'error'
    : connecting
      ? 'connecting'
      : !connected
        ? 'idle'
        : pendingConfirmation
          ? 'confirming'
          : activity.phase === 'executing'
            ? 'executing'
            : isSpeaking
              ? 'speaking'
              : 'listening';
  const dotClass = {
    error: 'bg-destructive',
    connecting: 'bg-yellow-500 animate-pulse',
    idle: 'bg-muted-foreground/40',
    confirming: 'bg-amber-500 animate-pulse',
    executing: 'bg-blue-500 animate-pulse',
    speaking: 'bg-primary animate-pulse',
    listening: 'bg-green-500',
  }[phase];

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  const handleOrbClick = () => {
    if (connected) {
      setExpanded((v) => !v);
    } else {
      setExpanded(true);
      start();
    }
  };

  const handleEnd = () => {
    stop();
    setExpanded(false);
  };

  return createPortal(
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-[90] flex flex-col items-end gap-2">
      {expanded && (
        <div
          role="region"
          aria-label={t('voiceAssistant.panelLabel', { name: assistantName })}
          className="w-72 rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              ✨ {t('voiceAssistant.title', { name: assistantName })}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={t('common.close', 'Close')}
              className="rounded-full p-1 hover:bg-accent"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3" role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
            <span>
              {phase === 'error' && t('voiceAssistant.error', 'Problem with the voice connection')}
              {phase === 'connecting' &&
                (reconnecting
                  ? t('voiceAssistant.reconnecting', 'Connection lost — reconnecting…')
                  : t('voiceAssistant.connecting', 'Connecting…'))}
              {phase === 'idle' && t('voiceAssistant.idle', 'Not connected')}
              {phase === 'confirming' && t('voiceAssistant.awaitingConfirmation', 'Waiting for your confirmation')}
              {phase === 'executing' && t('voiceAssistant.executing', 'Working on it…')}
              {phase === 'speaking' && t('voiceAssistant.speaking', 'Speaking…')}
              {phase === 'listening' && t('voiceAssistant.listening', 'Listening…')}
            </span>
          </div>

          {lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 mb-3 space-y-2">
              <p className="text-xs text-destructive leading-relaxed">{lastError}</p>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition shadow-sm"
                >
                  <RefreshCw size={11} />
                  {t('voiceAssistant.retry', 'Retry')}
                </button>
                <a
                  href="https://status.elevenlabs.io"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition underline underline-offset-2"
                >
                  {t('voiceAssistant.statusPage', 'ElevenLabs Status')}
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          )}

          {pendingConfirmation?.message && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 mb-3 space-y-2">
              <p className="text-xs">{pendingConfirmation.message}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmPending}
                  className="flex-1 rounded-md bg-primary text-primary-foreground py-1 text-xs font-medium hover:opacity-90"
                >
                  {t('voiceAssistant.confirm', 'Confirm')}
                </button>
                <button
                  type="button"
                  onClick={denyPending}
                  className="flex-1 rounded-md border border-border py-1 text-xs font-medium hover:bg-muted"
                >
                  {t('voiceAssistant.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {connected && (
            <>
              <div
                role="group"
                aria-label={t('voiceAssistant.mode', 'Mode')}
                className="grid grid-cols-2 gap-1 mb-3 rounded-lg bg-muted p-0.5 text-xs"
              >
                {['command', 'dictation'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={`rounded-md py-1 ${mode === m ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                  >
                    {m === 'command' ? t('voiceAssistant.commandMode', 'Command') : t('voiceAssistant.dictationMode', 'Dictation')}
                  </button>
                ))}
              </div>
              {mode === 'dictation' && (
                <p className="text-[11px] text-muted-foreground mb-2">
                  {t('voiceAssistant.dictationHint', 'Click a note field, then speak. Your words are typed into it.')}
                </p>
              )}
              <div
                ref={scrollRef}
                className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 mb-3 space-y-1.5 text-xs"
                aria-label={t('voiceAssistant.transcript', 'Conversation')}
              >
                {transcript.length === 0 ? (
                  <p className="text-muted-foreground">{t('voiceAssistant.transcriptEmpty', 'Say something to begin.')}</p>
                ) : (
                  transcript.map((m) => (
                    <p key={m.id} className={m.role === 'user' ? 'text-foreground' : 'text-primary'}>
                      <span className="font-medium">
                        {m.role === 'user' ? t('voiceAssistant.you', 'You') : assistantName}:
                      </span>{' '}
                      {m.text}
                    </p>
                  ))
                )}
              </div>
            </>
          )}

          {connected && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMuted(!isMuted)}
                aria-label={isMuted ? t('voiceAssistant.unmute', 'Unmute') : t('voiceAssistant.mute', 'Mute')}
                className="flex-1 rounded-lg border border-border py-1.5 text-xs hover:bg-accent flex items-center justify-center gap-1"
              >
                {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                {isMuted ? t('voiceAssistant.unmute', 'Unmute') : t('voiceAssistant.mute', 'Mute')}
              </button>
              <button
                type="button"
                onClick={handleEnd}
                className="flex-1 rounded-lg bg-destructive text-destructive-foreground py-1.5 text-xs hover:opacity-90"
              >
                {t('voiceAssistant.end', 'End')}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleOrbClick}
        aria-label={t('voiceAssistant.openLabel', { name: assistantName })}
        data-voice-phase={phase}
        className={`relative h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-colors ${
          connected ? 'bg-primary text-primary-foreground' : 'bg-popover text-popover-foreground border border-border'
        }`}
      >
        {connecting ? (
          <Loader2 size={22} className="animate-spin" />
        ) : (
          <img
            src={voiceAssistantIcon}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-9 w-9 object-contain select-none pointer-events-none"
          />
        )}
        {(phase === 'error' || phase === 'confirming') && (
          <span
            aria-hidden="true"
            className={`absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
              phase === 'error' ? 'bg-destructive' : 'bg-amber-500 animate-pulse'
            }`}
          />
        )}
      </button>
    </div>,
    document.body,
  );
}
