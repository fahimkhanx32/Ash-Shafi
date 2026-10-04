import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessagesSquare, Send, Paperclip, Check, CheckCheck, FileText, Image as ImageIcon, Mic, Square, Trash2, Loader2, ClipboardList } from 'lucide-react';

import * as messagingService from '../services/messagingService.js';
import * as patientsService from '../services/patientsService.js';
import * as staffService from '../services/staffService.js';
import { getSocket } from '../services/socketService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { ROLES, REPORTS_VERIFY_ROLES, REPORTS_WRITE_ROLES } from '../constants/roles.js';
import { formatRelativeTime, formatTime } from '../lib/dateFormat.js';
import useVoiceRecorder from '../hooks/useVoiceRecorder.js';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { SkeletonList } from '../components/ui/skeleton.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import VoiceMessagePlayer from '../components/messaging/VoiceMessagePlayer.jsx';
import ReportDetailDialog from '../components/reports/ReportDetailDialog.jsx';

const MAX_ATTACHMENT_MB = 15;

/** "1:05" — mirrors `VoiceMessagePlayer.jsx`'s own formatter for the live-recording timer. */
const formatDurationClock = (totalSeconds) => {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Inline card shown inside the bubble for REPORT_NOTICE message type.
 * Renders report metadata and a View Report button — never a direct URL.
 */
function ReportNoticeCard({ message, onViewReport }) {
  const { t } = useTranslation();
  const ref = message.relatedReport;
  const title = typeof ref === 'object' ? (ref.title || t('clinical.report.titleFallback', 'Medical Report')) : t('clinical.report.titleFallback', 'Medical Report');
  const reportId = typeof ref === 'object' ? ref.id : ref;
  return (
    <div className="rounded-xl border border-primary/30 bg-card/80 p-3 max-w-[260px] space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardList size={16} className="text-primary shrink-0" />
        <p className="text-sm font-semibold truncate">{title}</p>
      </div>
      {message.content ? (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{message.content}</p>
      ) : null}
      {reportId ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onViewReport(reportId)}
        >
          {t('clinical.report.viewReport', 'View Report')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * FET-12 (Patient Portal) checkpoint 2 / FET-13 — secure patient-
 * doctor messaging (master prompt §29/§30). One `PATIENT` only ever
 * has one conversation (with their assigned doctor — BET-13's
 * `Conversation` model is a fixed patient/doctor pair), so the
 * PATIENT view auto-selects its single thread. A `DOCTOR` sees a
 * real conversation roster and picks one. Every write here is a real
 * authenticated REST call (`messagingService.js`); the socket
 * connection (`socketService.js`) only ever pushes what the REST
 * calls already authorized — never a separate write path (master
 * prompt §80).
 */
export default function MessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isPatient = user?.role === ROLES.PATIENT;
  const canWrite = REPORTS_WRITE_ROLES.includes(user?.role);
  const canVerify = REPORTS_VERIFY_ROLES.includes(user?.role);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  const [detailReportId, setDetailReportId] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [conversationsState, setConversationsState] = useState('loading');
  const [conversationsError, setConversationsError] = useState('');
  const [startingConversation, setStartingConversation] = useState(false);
  const [myPrimaryCareProvider, setMyPrimaryCareProvider] = useState(undefined); // undefined = not checked yet

  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesState, setMessagesState] = useState('idle');
  const [messagesError, setMessagesError] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const voiceRecorder = useVoiceRecorder({ maxDurationSeconds: 300 });

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );

  const otherParty = useCallback(
    (conversation) => (isPatient ? conversation?.doctor : conversation?.patient),
    [isPatient],
  );

  const loadConversations = useCallback(async () => {
    setConversationsState('loading');
    setConversationsError('');
    try {
      const { items } = await messagingService.getMyConversations({ limit: 50 });
      setConversations(items);
      setConversationsState('ready');
      if (!activeId && items.length > 0) {
        setActiveId(items[0].id);
      }
    } catch (error) {
      setConversationsError(extractApiError(error).message);
      setConversationsState('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // A PATIENT with zero conversations may still have an assigned
  // doctor — check so we can offer a real "Message my doctor" action
  // instead of a dead-end empty state.
  useEffect(() => {
    if (!isPatient || conversationsState !== 'ready' || conversations.length > 0) return;
    patientsService
      .getMyPatientProfile()
      .then((profile) => setMyPrimaryCareProvider(profile))
      .catch(() => setMyPrimaryCareProvider(null));
  }, [isPatient, conversationsState, conversations.length]);

  // A patient may message ANY active doctor (the server enforces that the
  // profile is the caller's own and the doctor is active).
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [pickedDoctorId, setPickedDoctorId] = useState('');
  const [myProfile, setMyProfile] = useState(null);

  useEffect(() => {
    if (!isPatient || conversationsState !== 'ready') return;
    patientsService.getMyPatientProfile().then(setMyProfile).catch(() => setMyProfile(null));
    staffService
      .listDoctors({ limit: 50 })
      .then((res) =>
        setDoctorOptions(
          (res.items || []).filter(
            (d) => d.user?.status === 'ACTIVE' || d.employmentStatus === 'ACTIVE' || d.userId,
          ),
        ),
      )
      .catch(() => setDoctorOptions([]));
  }, [isPatient, conversationsState]);

  const doctorUserId = (d) => d.userId || d.user?.id || d.user?._id || d.id;

  const handleMessagePickedDoctor = async () => {
    if (!pickedDoctorId || !myProfile?.id) return;
    setStartingConversation(true);
    try {
      const conversation = await messagingService.startConversation({
        patientProfileId: myProfile.id,
        doctorId: pickedDoctorId,
      });
      setConversations((prev) =>
        prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev],
      );
      setActiveId(conversation.id);
      setPickedDoctorId('');
    } catch (error) {
      toast({ title: t('messaging.toast.startFailedTitle'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setStartingConversation(false);
    }
  };

  const handleStartConversation = async () => {
    if (!myPrimaryCareProvider?.primaryCareProvider) return;
    setStartingConversation(true);
    try {
      const conversation = await messagingService.startConversation({
        patientProfileId: myPrimaryCareProvider.id,
        doctorId: myPrimaryCareProvider.primaryCareProvider,
      });
      setConversations([conversation]);
      setActiveId(conversation.id);
    } catch (error) {
      toast({ title: t('messaging.toast.startFailedTitle'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setStartingConversation(false);
    }
  };

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setMessagesState('loading');
    setMessagesError('');
    try {
      const { items } = await messagingService.listMessages(conversationId, { limit: 50 });
      setMessages(items.slice().reverse());
      setMessagesState('ready');
      messagingService.markConversationRead(conversationId).catch(() => {});
    } catch (error) {
      setMessagesError(extractApiError(error).message);
      setMessagesState('error');
    }
  }, []);

  // Join/leave the conversation's socket room whenever the active
  // thread changes; load its history from the real REST endpoint.
  useEffect(() => {
    if (!activeId) return undefined;
    const socket = getSocket();
    setMessages([]);
    setOtherTyping(false);
    voiceRecorder.cancel();
    loadMessages(activeId);
    socket?.emit('conversation:join', { conversationId: activeId });
    return () => {
      socket?.emit('conversation:leave', { conversationId: activeId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, loadMessages]);

  // Real-time listeners — live for the page's whole lifetime; each
  // handler checks the event's conversationId against whatever is
  // currently active/listed rather than assuming.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleNewMessage = ({ conversationId, message }) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx === -1) {
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const isMine = message.sender === user?.id;
        const unreadKey = isPatient ? 'patient' : 'doctor';
        const conv = { ...updated[idx], lastMessageAt: message.createdAt };
        if (conversationId !== activeId && !isMine) {
          conv.unreadCount = {
            ...conv.unreadCount,
            [unreadKey]: (conv.unreadCount?.[unreadKey] || 0) + 1,
          };
        }
        updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });

      if (conversationId === activeId) {
        setMessages((prev) => [...prev, message]);
        if (message.sender !== user?.id) {
          messagingService.markConversationRead(conversationId).catch(() => {});
        }
      }
    };

    const handleRead = ({ conversationId, readAt }) => {
      if (conversationId !== activeId) return;
      setMessages((prev) =>
        prev.map((m) => (m.sender === user?.id && !m.readAt ? { ...m, readAt } : m)),
      );
    };

    const handleTypingStart = ({ conversationId, userId }) => {
      if (conversationId === activeId && userId !== user?.id) setOtherTyping(true);
    };
    const handleTypingStop = ({ conversationId, userId }) => {
      if (conversationId === activeId && userId !== user?.id) setOtherTyping(false);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.id, isPatient]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, otherTyping]);

  let typingTimeout;
  const handleDraftChange = (value) => {
    setDraft(value);
    const socket = getSocket();
    if (!socket || !activeId) return;
    socket.emit('typing:start', { conversationId: activeId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeId });
    }, 2000);
  };

  const handleSendText = async () => {
    const content = draft.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setDraft('');
    try {
      const message = await messagingService.sendTextMessage(activeId, content);
      setMessages((prev) => [...prev, message]);
    } catch (error) {
      toast({ title: t('messaging.toast.sendFailedTitle'), description: extractApiError(error).message, variant: 'destructive' });
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const handleAttach = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeId) return;
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      toast({
        title: t('messaging.toast.attachmentTooLargeTitle'),
        description: t('messaging.toast.attachmentTooLargeDescription', { max: MAX_ATTACHMENT_MB }),
        variant: 'destructive',
      });
      return;
    }
    const isImage = file.type.startsWith('image/');
    setSending(true);
    try {
      const message = isImage
        ? await messagingService.sendImageMessage(activeId, file)
        : await messagingService.sendDocumentMessage(activeId, file);
      setMessages((prev) => [...prev, message]);
    } catch (error) {
      toast({ title: t('messaging.toast.attachmentFailedTitle'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleDownloadAttachment = async (message) => {
    try {
      const { blob } = await messagingService.downloadMessageAttachment(message.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.attachment?.originalFilename || 'attachment';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: t('messaging.toast.downloadFailedTitle'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  // FET-13 — voice recording. `voiceRecorder.error` is set by the
  // hook itself (permission denial or an unsupported browser/device)
  // rather than a REST call failing, so it gets its own toast here
  // instead of going through `extractApiError`.
  useEffect(() => {
    if (!voiceRecorder.error) return;
    toast({
      title: t('messaging.toast.sendFailedTitle'),
      description:
        voiceRecorder.error === 'PERMISSION_DENIED'
          ? t('messaging.voice.permissionDenied')
          : t('messaging.voice.unavailable'),
      variant: 'destructive',
    });
  }, [voiceRecorder.error, toast, t]);

  const handleSendVoice = async () => {
    if (!voiceRecorder.result || !activeId || sending) return;
    const { blob, durationSeconds } = voiceRecorder.result;
    const file = new File([blob], `voice-message-${Date.now()}.wav`, { type: 'audio/wav' });
    setSending(true);
    try {
      const message = await messagingService.sendVoiceMessage(activeId, file, durationSeconds);
      setMessages((prev) => [...prev, message]);
      voiceRecorder.reset();
    } catch (error) {
      toast({
        title: t('messaging.voice.sendFailedTitle'),
        description: extractApiError(error).message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('messaging.title')} description={t('messaging.description')} />

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[420px]">
        {/* Conversation list */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
          {isPatient && conversationsState === 'ready' && doctorOptions.length > 0 && (
            <div className="flex items-center gap-2 border-b border-border p-3">
              <select
                aria-label="Choose a doctor to message"
                className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-base sm:text-sm"
                value={pickedDoctorId}
                onChange={(e) => setPickedDoctorId(e.target.value)}
              >
                <option value="">Message a doctor…</option>
                {doctorOptions.map((d) => (
                  <option key={doctorUserId(d)} value={doctorUserId(d)}>
                    Dr. {d.name || d.user?.name || 'Doctor'}
                    {d.specialization ? ` — ${d.specialization}` : ''}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={!pickedDoctorId || startingConversation} onClick={handleMessagePickedDoctor}>
                {startingConversation ? <Spinner size={14} /> : 'Start'}
              </Button>
            </div>
          )}
          <div className="overflow-y-auto flex-1">
            {conversationsState === 'loading' ? (
              <div className="p-3">
                <SkeletonList rows={4} />
              </div>
            ) : conversationsState === 'error' ? (
              <div className="p-3">
                <ErrorState description={conversationsError} onRetry={loadConversations} />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  icon={MessagesSquare}
                  title={t('messaging.empty.title')}
                  description={
                    isPatient
                      ? myPrimaryCareProvider === undefined
                        ? t('messaging.empty.checkingCareTeam')
                        : myPrimaryCareProvider?.primaryCareProvider
                          ? t('messaging.empty.notMessagedDoctor')
                          : t('messaging.empty.noAssignedDoctor')
                      : t('messaging.empty.noPatientConversations')
                  }
                  action={
                    isPatient && myPrimaryCareProvider?.primaryCareProvider ? (
                      <Button size="sm" disabled={startingConversation} onClick={handleStartConversation}>
                        {startingConversation ? <Spinner size={14} /> : null} {t('messaging.messageMyDoctor')}
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <ul>
                {conversations.map((c) => {
                  const person = otherParty(c);
                  const unread = c.unreadCount?.[isPatient ? 'patient' : 'doctor'] || 0;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors ${
                          c.id === activeId ? 'bg-accent/60' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">
                            {isPatient
                              ? t('messaging.doctorName', { name: person?.name || t('messaging.fallbackDoctor') })
                              : person?.name || t('messaging.fallbackPatient')}
                          </p>
                          {unread > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                              {unread}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.lastMessageAt ? formatRelativeTime(c.lastMessageAt) : t('messaging.noMessagesYet')}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Active thread */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
          {!activeConversation ? (
            <div className="flex-1 grid place-items-center p-6">
              <EmptyState
                icon={MessagesSquare}
                title={t('messaging.selectConversation.title')}
                description={t('messaging.selectConversation.description')}
              />
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm">
                  {isPatient
                    ? t('messaging.doctorName', { name: otherParty(activeConversation)?.name || t('messaging.fallbackDoctor') })
                    : otherParty(activeConversation)?.name || t('messaging.fallbackPatient')}
                </p>
                {otherTyping ? <p className="text-xs text-primary">{t('messaging.typing')}</p> : null}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {messagesState === 'loading' ? (
                  <SkeletonList rows={5} />
                ) : messagesState === 'error' ? (
                  <ErrorState description={messagesError} onRetry={() => loadMessages(activeId)} />
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t('messaging.noMessagesInThread')}</p>
                ) : (
                  messages.map((m) => {
                    const isMine = m.sender === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                          }`}
                        >
                          {m.isDeleted ? (
                            <p className="italic opacity-70">{t('messaging.deletedMessage')}</p>
                          ) : m.messageType === 'REPORT_NOTICE' ? (
                            <ReportNoticeCard message={m} onViewReport={setDetailReportId} />
                          ) : m.messageType === 'VOICE' ? (
                            <VoiceMessagePlayer message={m} isMine={isMine} />
                          ) : m.attachment ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(m)}
                              className="flex items-center gap-2 underline underline-offset-2"
                            >
                              {m.messageType === 'IMAGE' ? <ImageIcon size={16} /> : <FileText size={16} />}
                              <span className="truncate max-w-[160px]">
                                {m.attachment.originalFilename || t('messaging.attachmentFallback')}
                              </span>
                            </button>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          )}
                          <div
                            className={`mt-1 flex items-center gap-1 text-[10px] ${
                              isMine ? 'text-primary-foreground/80 justify-end' : 'text-muted-foreground'
                            }`}
                          >
                            <span>{formatTime(m.createdAt)}</span>
                            {isMine ? (m.readAt ? <CheckCheck size={12} /> : <Check size={12} />) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border p-3 flex items-center gap-2">
                {voiceRecorder.state === 'recording' ? (
                  <div className="flex-1 flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 h-11">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-destructive flex-1">
                      {t('messaging.voice.recording')} {formatDurationClock(voiceRecorder.elapsedSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={voiceRecorder.cancel}
                      aria-label={t('messaging.voice.discard')}
                      className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={voiceRecorder.stop}
                      aria-label={t('messaging.voice.stopRecording')}
                      className="h-8 w-8 grid place-items-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <Square size={13} />
                    </button>
                  </div>
                ) : voiceRecorder.state === 'stopped' && voiceRecorder.result ? (
                  <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-2 h-11">
                    <audio
                      controls
                      src={voiceRecorder.result.url}
                      className="h-8 flex-1 min-w-0"
                      aria-label={t('messaging.voice.preview')}
                    />
                    <button
                      type="button"
                      onClick={voiceRecorder.cancel}
                      aria-label={t('messaging.voice.discard')}
                      className="h-8 w-8 shrink-0 grid place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      disabled={sending}
                    >
                      <Trash2 size={15} />
                    </button>
                    <Button
                      size="icon"
                      type="button"
                      className="shrink-0"
                      disabled={sending}
                      onClick={handleSendVoice}
                      aria-label={t('messaging.voice.send')}
                    >
                      {sending ? <Spinner size={16} /> : <Send size={16} />}
                    </Button>
                  </div>
                ) : (
                  <>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttach} accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx" />
                    <Button variant="outline" size="icon" type="button" disabled={sending} onClick={() => fileInputRef.current?.click()} aria-label={t('messaging.attachAria')}>
                      <Paperclip size={16} />
                    </Button>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendText();
                        }
                      }}
                      placeholder={t('messaging.inputPlaceholder')}
                      className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-sm"
                      disabled={sending}
                    />
                    {draft.trim() ? (
                      <Button size="icon" type="button" disabled={sending} onClick={handleSendText} aria-label={t('messaging.sendAria')}>
                        {sending ? <Spinner size={16} /> : <Send size={16} />}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        disabled={sending || voiceRecorder.state === 'requesting'}
                        onClick={voiceRecorder.start}
                        aria-label={t('messaging.voice.record')}
                      >
                        {voiceRecorder.state === 'requesting' ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* REPORT_NOTICE — view report in-place without a direct storage URL */}
      <ReportDetailDialog
        open={Boolean(detailReportId)}
        onOpenChange={(next) => !next && setDetailReportId(null)}
        reportId={detailReportId}
        canWrite={canWrite}
        canVerify={canVerify}
        onChanged={() => {}}
      />
    </div>
  );
}
