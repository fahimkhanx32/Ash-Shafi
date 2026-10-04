import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Video, VideoOff, Mic, MicOff, PhoneOff, ShieldCheck, ArrowLeft, RotateCcw } from 'lucide-react';

import * as videoCallsService from '../services/videoCallsService.js';
import * as appointmentsService from '../services/appointmentsService.js';
import { getSocket } from '../services/socketService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { ROLES } from '../constants/roles.js';
import { formatDate, formatTime } from '../lib/dateFormat.js';

import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner, PageLoader } from '../components/ui/spinner.jsx';
import { ErrorState } from '../components/ui/empty-state.jsx';

// FET-14 — reconnection is attempted this many times (ICE restart)
// before we give up and ask the user to rejoin explicitly, rather
// than retrying forever against a genuinely dead connection.
const MAX_RECONNECT_ATTEMPTS = 3;
// How long a 'disconnected' connectionState is given to recover on
// its own (a real network hiccup often self-heals) before an ICE
// restart is attempted. 'failed' skips this wait entirely.
const DISCONNECT_GRACE_MS = 3000;

/**
 * FET-12 (Patient Portal) checkpoint 2 / FET-14 — appointment-based
 * secure video consultation (master prompt §32), built on the real
 * `native` WebRTC provider (`server/src/modules/video-calls/services/
 * providers/native-webrtc.provider.js`, BET-14.2). Media never
 * touches this server — this page only uses the already-
 * authenticated Socket.IO connection to relay SDP offers/answers and
 * ICE candidates directly between the two browsers
 * (`socket/index.js`'s `video:signal` handler).
 *
 * Every state transition (consent, join, leave, end) is a real
 * authenticated REST call (`videoCallsService.js`) — the socket is
 * only ever used for the two genuinely ephemeral signaling events
 * plus admission into the signaling room via the single-use join
 * token the REST `join` call returns, exactly like the server module
 * documents.
 *
 * FET-14 gap-closure pass (this session) closed two roadmap bullets
 * that were genuinely missing from the FET-12 checkpoint build,
 * confirmed by reading this file end-to-end before changing it (per
 * this project's standing "verify, don't assume" convention):
 *
 * 1. "Waiting room" — the pre-join screen previously showed a static
 *    icon and only requested camera/microphone access the moment the
 *    user clicked Join, with no way to check devices first. It now
 *    requests device access as soon as the screen is reachable
 *    (after consent, if required) and shows a live local preview
 *    with working mic/camera toggles *before* the user commits to
 *    joining — a real pre-call device-check lobby, not just a label
 *    change. If preview access is denied, the user is told plainly
 *    and can still attempt Join (which retries the permission
 *    prompt) or retry the preview itself.
 * 2. "Error/reconnection handling" — `pc.onconnectionstatechange`
 *    previously only ever moved the UI *back* to the waiting state on
 *    'failed'/'disconnected' with no attempt to actually recover the
 *    call, silently stranding both participants. It now attempts a
 *    real ICE restart (bounded, `MAX_RECONNECT_ATTEMPTS`) through the
 *    exact same offer/answer signaling path already used for the
 *    initial connection — no new socket event or server change
 *    needed, since a renegotiation offer is just another
 *    `video:signal` payload the existing handler already relays and
 *    the existing offer/answer branch already applies. A short grace
 *    period is given to 'disconnected' (which often self-heals)
 *    before restarting ICE; 'failed' restarts immediately. Once
 *    attempts are exhausted, the user sees a clear "couldn't
 *    reconnect" state with an explicit rejoin action rather than a
 *    silently frozen video tile.
 *
 * Every new string introduced by both of the above is wired through
 * `useTranslation()`/`t()` against `videoCall.*` keys added to both
 * `locales/en/translation.json` and `locales/bn/translation.json` in
 * the same pass (real Bangla translations, not staged English-only
 * placeholders) — this page was already correctly i18n'd end-to-end
 * by the FET-12 checkpoint 3 pass, and this change preserves that
 * rather than reintroducing hardcoded English.
 */
export default function VideoConsultationPage() {
  const { t } = useTranslation();
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isPatient = user?.role === ROLES.PATIENT;
  const isDoctorOrAdmin = user?.role === ROLES.DOCTOR || [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR].includes(user?.role);

  const [appointment, setAppointment] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consenting, setConsenting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [ending, setEnding] = useState(false);

  // 'idle' | 'connecting' | 'waiting' | 'connected' | 'reconnecting' | 'reconnect-failed' | 'ended'
  const [callState, setCallState] = useState('idle');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  // 'idle' | 'requesting' | 'ready' | 'denied' — the pre-join device
  // lobby's own state, independent of `callState` so a denied/failed
  // preview never blocks the Join button itself.
  const [previewState, setPreviewState] = useState('idle');

  const localVideoRef = useRef(null);
  const lobbyVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const roomIdRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const appt = await appointmentsService.getAppointment(appointmentId);
      setAppointment(appt);
      const s = await videoCallsService.getOrCreateSessionForAppointment(appointmentId);
      setSession(s);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const cleanupCall = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setPreviewState('idle');
    const socket = getSocket();
    if (roomIdRef.current) {
      socket?.emit('video:leave', { roomId: roomIdRef.current });
    }
    roomIdRef.current = null;
  }, [clearReconnectTimer]);

  useEffect(() => () => cleanupCall(), [cleanupCall]);

  const needsConsent = isPatient && !session?.consent?.patientConsented;

  // FET-14 — the device-check lobby: as soon as the pre-join screen
  // is actually reachable (session loaded, consent satisfied if
  // required, not already in/starting a call), request camera/mic
  // access once so the user can preview and adjust before Join
  // rather than being surprised by a permission prompt mid-action.
  const startDevicePreview = useCallback(async () => {
    if (localStreamRef.current) {
      setPreviewState('ready');
      return;
    }
    setPreviewState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = stream;
      setPreviewState('ready');
    } catch {
      setPreviewState('denied');
    }
  }, []);

  useEffect(() => {
    if (session && !needsConsent && callState === 'idle') {
      startDevicePreview();
    }
  }, [session, needsConsent, callState, startDevicePreview]);

  // FET-14 — bounded ICE-restart reconnection. Reuses the existing
  // offer/answer signaling path (`video:signal`) — the peer on the
  // other end already handles an incoming 'offer' generically
  // (`setRemoteDescription` → `createAnswer` → emit 'answer'), so a
  // renegotiation offer with `iceRestart: true` needs no new event
  // type and no server change.
  const attemptReconnect = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const roomId = roomIdRef.current;
    const socket = getSocket();
    if (!pc || !roomId || !socket) return;

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setCallState('reconnect-failed');
      toast({
        title: t('videoCall.toast.reconnectFailedTitle'),
        description: t('videoCall.reconnectFailedNotice'),
        variant: 'destructive',
      });
      return;
    }

    reconnectAttemptsRef.current += 1;
    setCallState('reconnecting');
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socket.emit('video:signal', { roomId, data: { type: 'offer', sdp: offer } });
    } catch {
      // The next connectionstatechange (or the disconnect grace
      // timer) will retry — a failed restart attempt here isn't
      // treated as fatal on its own.
    }
  }, [t, toast]);

  const createPeerConnection = useCallback(
    (iceServers, roomId) => {
      const pc = new RTCPeerConnection({ iceServers: iceServers?.length ? iceServers : undefined });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          getSocket()?.emit('video:signal', {
            roomId,
            data: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        reconnectAttemptsRef.current = 0;
        clearReconnectTimer();
        setCallState('connected');
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          clearReconnectTimer();
          setCallState((prev) => {
            if (prev === 'reconnecting') {
              toast({ title: t('videoCall.toast.reconnectedTitle') });
            }
            return 'connected';
          });
          reconnectAttemptsRef.current = 0;
        } else if (state === 'disconnected') {
          setCallState((prev) => (prev === 'connected' || prev === 'reconnecting' ? 'reconnecting' : prev));
          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            if (peerConnectionRef.current?.connectionState !== 'connected') attemptReconnect();
          }, DISCONNECT_GRACE_MS);
        } else if (state === 'failed') {
          clearReconnectTimer();
          attemptReconnect();
        }
      };

      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));

      return pc;
    },
    [attemptReconnect, clearReconnectTimer, t, toast],
  );

  const handleConsent = async () => {
    setConsenting(true);
    try {
      const updated = await videoCallsService.recordConsent(session.id);
      setSession(updated);
    } catch (err) {
      toast({ title: t('videoCall.toast.consentFailedTitle'), description: extractApiError(err).message, variant: 'destructive' });
    } finally {
      setConsenting(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    setCallState('connecting');
    try {
      // Reuse the lobby's already-granted preview stream when we
      // have one so the user isn't prompted for camera/mic access a
      // second time; only fall back to a fresh request if the
      // preview never succeeded (denied, or skipped entirely).
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const { session: joinedSession, joinToken, roomId, iceServers } = await videoCallsService.joinSession(session.id);
      setSession(joinedSession);
      roomIdRef.current = roomId;

      const socket = getSocket();
      if (!socket) throw new Error(t('videoCall.unavailable'));

      const pc = createPeerConnection(iceServers, roomId);
      peerConnectionRef.current = pc;

      socket.off('video:signal');
      socket.off('video:participant-connected');
      socket.off('video:participant-disconnected');

      socket.on('video:participant-connected', async () => {
        // We were already in the room — the newly joined peer will
        // wait for our offer (see this page's docstring).
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('video:signal', { roomId, data: { type: 'offer', sdp: offer } });
        } catch (offerError) {
          toast({ title: t('videoCall.toast.callStartFailedTitle'), description: offerError.message, variant: 'destructive' });
        }
      });

      socket.on('video:signal', async ({ data }) => {
        try {
          if (data.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('video:signal', { roomId, data: { type: 'answer', sdp: answer } });
          } else if (data.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          } else if (data.type === 'candidate' && data.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } catch (signalError) {
          toast({ title: t('videoCall.toast.connectionErrorTitle'), description: signalError.message, variant: 'destructive' });
        }
      });

      socket.on('video:participant-disconnected', () => {
        setCallState('waiting');
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      });

      socket.emit('video:join', { sessionId: session.id, token: joinToken }, (ack) => {
        if (!ack?.ok) {
          toast({
            title: t('videoCall.toast.joinRejectedTitle'),
            description: t('videoCall.toast.joinRejectedDescription'),
            variant: 'destructive',
          });
          setCallState('idle');
          return;
        }
        setCallState('waiting');
      });
    } catch (err) {
      const message = err?.name === 'NotAllowedError'
        ? t('videoCall.cameraMicDenied')
        : extractApiError(err).message;
      setError(message);
      toast({ title: t('videoCall.toast.joinFailedTitle'), description: message, variant: 'destructive' });
      setCallState('idle');
      cleanupCall();
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      await videoCallsService.leaveSession(session.id);
    } catch {
      // Best-effort — the call is being torn down client-side regardless.
    }
    cleanupCall();
    setCallState('ended');
    navigate('/dashboard/appointments');
  };

  const handleEndForBoth = async () => {
    setEnding(true);
    try {
      await videoCallsService.endSession(session.id, { reason: 'Ended by clinician' });
      cleanupCall();
      setCallState('ended');
      navigate('/dashboard/appointments');
    } catch (err) {
      toast({ title: t('videoCall.toast.endFailedTitle'), description: extractApiError(err).message, variant: 'destructive' });
    } finally {
      setEnding(false);
    }
  };

  // FET-14 — after reconnect attempts are exhausted, give the user an
  // explicit, obvious way forward instead of a frozen tile: tear the
  // dead peer connection down and re-run the normal join flow.
  const handleRejoin = async () => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    reconnectAttemptsRef.current = 0;
    clearReconnectTimer();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallState('connecting');
    await handleJoin();
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setMicOn((v) => !v);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setCameraOn((v) => !v);
  };

  if (loading) return <PageLoader label={t('videoCall.preparing')} />;

  if (error && !session) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  }

  const inCall = ['waiting', 'connected', 'reconnecting', 'reconnect-failed'].includes(callState);

  return (
    <div className="max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/dashboard/appointments')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={14} /> {t('videoCall.backToAppointments')}
      </button>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">{t('videoCall.title')}</h1>
              {appointment ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {isPatient ? t('messaging.doctorName', { name: appointment.doctor?.name || '' }) : appointment.patient?.name || ''} ·{' '}
                  {formatDate(appointment.scheduledStart)}, {formatTime(appointment.scheduledStart)}
                </p>
              ) : null}
            </div>
            {session ? <Badge variant={session.status === 'ACTIVE' ? 'success' : 'info'}>{session.status}</Badge> : null}
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {!inCall ? (
            <div className="flex flex-col items-center gap-4 py-10">
              {needsConsent ? (
                <>
                  <div className="h-20 w-20 rounded-full bg-accent grid place-items-center">
                    <Video size={32} className="text-primary" />
                  </div>
                  <div className="max-w-md text-center space-y-3">
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                      <ShieldCheck size={16} /> {t('videoCall.consent.notice')}
                    </p>
                    <Button disabled={consenting} onClick={handleConsent}>
                      {consenting ? <Spinner size={14} /> : null} {t('videoCall.consent.action')}
                    </Button>
                  </div>
                </>
              ) : (
                // FET-14 device-check lobby — live local preview plus
                // working mic/camera toggles before the user commits
                // to joining, rather than a bare icon.
                <div className="w-full max-w-sm text-center space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
                    {previewState === 'ready' ? (
                      <video ref={lobbyVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 text-sm px-4 text-center">
                        {previewState === 'requesting' ? (
                          <Spinner size={22} className="border-white/40 border-t-white" />
                        ) : (
                          <VideoOff size={26} />
                        )}
                        <span>
                          {previewState === 'denied'
                            ? t('videoCall.cameraPreviewUnavailable')
                            : t('videoCall.preparingDevices')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant={micOn ? 'outline' : 'destructive'}
                      size="icon"
                      onClick={toggleMic}
                      disabled={previewState !== 'ready'}
                      aria-label={micOn ? t('videoCall.muteMic') : t('videoCall.unmuteMic')}
                    >
                      {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                    </Button>
                    <Button
                      variant={cameraOn ? 'outline' : 'destructive'}
                      size="icon"
                      onClick={toggleCamera}
                      disabled={previewState !== 'ready'}
                      aria-label={cameraOn ? t('videoCall.cameraOff') : t('videoCall.cameraOn')}
                    >
                      {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground">{t('videoCall.preJoinNotice')}</p>

                  <Button size="lg" disabled={joining} onClick={handleJoin} className="w-full">
                    {joining ? <Spinner size={16} /> : <Video size={18} />} {t('videoCall.joinAction')}
                  </Button>

                  {previewState === 'denied' ? (
                    <button
                      type="button"
                      onClick={startDevicePreview}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      <RotateCcw size={12} /> {t('videoCall.retryDevicesAction')}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

                {callState === 'waiting' ? (
                  <div className="absolute inset-0 grid place-items-center bg-slate-900/80 text-white text-sm gap-2">
                    <Spinner size={24} className="border-white/40 border-t-white" />
                    {t('videoCall.waitingForParticipant')}
                  </div>
                ) : null}

                {callState === 'reconnecting' ? (
                  <div className="absolute inset-0 grid place-items-center bg-slate-900/80 text-white text-sm gap-2">
                    <Spinner size={24} className="border-white/40 border-t-white" />
                    {t('videoCall.reconnecting')}
                  </div>
                ) : null}

                {callState === 'reconnect-failed' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 text-white text-sm px-6 text-center">
                    <p>{t('videoCall.reconnectFailedNotice')}</p>
                    <Button onClick={handleRejoin} disabled={joining}>
                      {joining ? <Spinner size={14} /> : <RotateCcw size={16} />} {t('videoCall.rejoinAction')}
                    </Button>
                  </div>
                ) : null}

                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute bottom-3 right-3 w-32 sm:w-40 aspect-video rounded-lg object-cover border-2 border-white/70 shadow-lg"
                />
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button variant={micOn ? 'outline' : 'destructive'} size="icon" onClick={toggleMic} aria-label={micOn ? t('videoCall.muteMic') : t('videoCall.unmuteMic')}>
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </Button>
                <Button variant={cameraOn ? 'outline' : 'destructive'} size="icon" onClick={toggleCamera} aria-label={cameraOn ? t('videoCall.cameraOff') : t('videoCall.cameraOn')}>
                  {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                </Button>
                <Button variant="destructive" onClick={handleLeave}>
                  <PhoneOff size={18} /> {t('videoCall.leaveCall')}
                </Button>
                {isDoctorOrAdmin ? (
                  <Button variant="destructive" disabled={ending} onClick={handleEndForBoth}>
                    {ending ? <Spinner size={14} /> : null} {t('videoCall.endForBoth')}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
