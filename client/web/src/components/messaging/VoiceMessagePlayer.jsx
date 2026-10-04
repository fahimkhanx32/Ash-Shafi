import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Loader2 } from 'lucide-react';

import * as messagingService from '../../services/messagingService.js';

/** "1:05" */
const formatDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * FET-13 — playback for a `VOICE` message. Attachments are never
 * served from a public URL (`downloadMessageAttachment` streams the
 * bytes through an authenticated `GET /messages/:id/attachment`
 * call, mirroring `MessagesPage.jsx`'s existing image/document
 * download path) — this component lazily fetches that blob the
 * first time it's played, builds an object URL, and reuses it for
 * every subsequent play/pause on that same bubble.
 */
export default function VoiceMessagePlayer({ message, isMine }) {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const durationSeconds = message.attachment?.durationSeconds;

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const handleToggle = async () => {
    if (playing) {
      audioRef.current?.pause();
      return;
    }
    if (url) {
      audioRef.current?.play();
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const { blob } = await messagingService.downloadMessageAttachment(message.id);
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (url && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [url]);

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        aria-label={playing ? t('messaging.voice.pause') : t('messaging.voice.play')}
        className={`h-8 w-8 shrink-0 rounded-full grid place-items-center transition-colors ${
          isMine ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-background hover:bg-muted'
        }`}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : playing ? (
          <Pause size={14} />
        ) : (
          <Play size={14} className="ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {loadError ? (
          <span className="text-xs opacity-80">{t('messaging.voice.playbackError')}</span>
        ) : (
          <>
            <div className={`h-1.5 rounded-full overflow-hidden ${isMine ? 'bg-primary-foreground/25' : 'bg-muted-foreground/20'}`}>
              <div
                className={`h-full ${isMine ? 'bg-primary-foreground' : 'bg-primary'}`}
                style={{
                  width:
                    audioRef.current?.duration
                      ? `${Math.min(100, (currentTime / audioRef.current.duration) * 100)}%`
                      : '0%',
                }}
              />
            </div>
            <span className="text-[10px] opacity-80 mt-0.5 block">{formatDuration(durationSeconds)}</span>
          </>
        )}
      </div>

      {url ? (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={() => {
            // Force a re-render for the progress bar above — cheap
            // since it's just a style width recompute, same
            // approach the rest of this app already uses for
            // frequent small UI updates (typing indicator, timers).
            setPlaying((v) => v);
          }}
          className="hidden"
        />
      ) : null}
    </div>
  );
}
