import { Check, RotateCcw, Upload, UserRound, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../providers/ThemeProvider.jsx';
import { useSpeech } from '../providers/SpeechProvider.jsx';
import { resolveIsDark } from '../lib/applyTheme.js';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { useAuth } from '../providers/AuthProvider.jsx';
import * as notificationsService from '../services/notificationsService.js';
import * as authService from '../services/authService.js';
import * as preferencesService from '../services/preferencesService.js';
import { useAssistantName } from '../hooks/useAssistantName.js';
import { extractApiError } from '../services/apiClient.js';
import { buildUsernameSchema } from '../schemas/authSchemas.js';
import { resizeImageToDataUrl } from '../lib/resizeImage.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import {
  COLOR_THEMES,
  TEXT_COLOR_OPTIONS,
  LANGUAGE_OPTIONS,
  MODE_OPTIONS,
  TYPOGRAPHY_SCALE_OPTIONS,
  WALLPAPER_OPTIONS,
} from '../constants/theme.js';
import { FloatField, controlClass } from '../components/ui/profile-form.jsx';

// Same input styling AddStaffDialog.jsx/RoleFormDialog.jsx/etc. already
// use app-wide for a plain text field, reused here for consistency
// rather than inventing another look for this one field.
const usernameInputClass =
  'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';

/**
 * FET-03 — real, working settings page (not a placeholder): every
 * control here calls `updatePreferences`, which applies immediately
 * to the document and persists to localStorage + (when signed in)
 * the real `PATCH /auth/me/preferences` endpoint. Reached from the
 * sidebar's "Settings" item, now a real route rather than a disabled
 * "Soon" entry.
 */
export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { preferences, updatePreferences, resetPreferences } = useTheme();
  const { supported: speechSupported, voices, speaking, speakText, stop: stopSpeech } = useSpeech();
  const confirm = useConfirm();
  const { toast } = useToast();
  const isDark = resolveIsDark(preferences);
  const { user, refreshCurrentUser } = useAuth();
  const [savingChannel, setSavingChannel] = useState(null); // which channel key is mid-save, or null

  // Account / username — auto-generated at registration (slugified
  // name + last 3 phone digits), changeable here. `usernameDraft`
  // initializes once from `user.username`; this page only renders
  // once authenticated (see the routing shell), so `user` is already
  // populated by the time this component mounts.
  const [usernameDraft, setUsernameDraft] = useState(user?.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Naming spec §1–§3, §10 — persists through the same uiPreferences
  // tier as every other card on this page (`updatePreferences`), not
  // a separate save path, so it survives refresh/logout identically.
  const { assistantName: savedAssistantName, refreshAssistantName } = useAssistantName();
  const [assistantNameDraft, setAssistantNameDraft] = useState(savedAssistantName);
  const [assistantNameError, setAssistantNameError] = useState('');
  const [savingAssistantName, setSavingAssistantName] = useState(false);

  // The server hydrates `preferences.voiceAssistant` asynchronously
  // (after login, via ThemeProvider's user.uiPreferences sync) — pick
  // that value up once it arrives, but only if the doctor hasn't
  // already started typing a different name.
  useEffect(() => {
    // Follows the server-backed name, including a rename made by
    // voice while this page is open.
    setAssistantNameDraft(savedAssistantName);
  }, [savedAssistantName]);

  const handleAssistantNameSave = () => {
    setAssistantNameError('');
    const trimmed = assistantNameDraft.trim();
    if (!trimmed) {
      setAssistantNameError(t('settings.voiceAssistant.nameRequired'));
      return;
    }
    if (trimmed.length > 50) {
      setAssistantNameError(t('settings.voiceAssistant.nameTooLong'));
      return;
    }
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1F\x7F<>]/.test(trimmed)) {
      setAssistantNameError(t('settings.voiceAssistant.nameInvalidChars'));
      return;
    }

    setSavingAssistantName(true);
    setAssistantNameDraft(trimmed);
    // Awaited, real server save — success is only reported once the
    // server accepted it, and a failure shows the server's reason
    // instead of a false "updated" toast.
    preferencesService
      .updateMyPreferences({ voiceAssistant: { assistantName: trimmed } })
      .then(() => refreshAssistantName())
      .then(() => toast({ title: t('settings.voiceAssistant.saveSuccess'), variant: 'success' }))
      .catch((err) => {
        setAssistantNameDraft(savedAssistantName);
        setAssistantNameError(
          extractApiError(err)?.message || t('settings.voiceAssistant.saveError'),
        );
      })
      .finally(() => setSavingAssistantName(false));
  };

  // Sign-in email (needs the current password) and profile picture.
  const [emailDraft, setEmailDraft] = useState(user?.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [imageError, setImageError] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const fileInputRef = useRef(null);
  // Shown the moment a file is chosen, before the upload round-trip finishes.
  const [pendingImage, setPendingImage] = useState(null);

  const emailChanged = emailDraft.trim().toLowerCase() !== (user?.email || '');

  const handleEmailSave = async () => {
    setEmailError('');
    const next = emailDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setEmailError(t('settings.account.emailInvalid', 'Enter a valid email address.'));
      return;
    }
    if (!emailPassword) {
      setEmailError(t('settings.account.emailPasswordRequired', 'Enter your current password to change your email.'));
      return;
    }
    setSavingEmail(true);
    try {
      await authService.updateEmail({ email: next, currentPassword: emailPassword });
      await refreshCurrentUser();
      setEmailPassword('');
      toast({
        title: t('settings.account.emailUpdated', 'Email updated'),
        description: t('settings.account.emailVerifyHint', 'We sent a verification link to the new address.'),
        variant: 'success',
      });
    } catch (error) {
      setEmailError(extractApiError(error).message);
    } finally {
      setSavingEmail(false);
    }
  };

  const saveImage = async (value) => {
    setImageError('');
    setSavingImage(true);
    try {
      await authService.updateProfileImage(value);
      await refreshCurrentUser();
      toast({
        title: value
          ? t('settings.account.imageUpdated', 'Profile picture updated')
          : t('settings.account.imageRemoved', 'Profile picture removed'),
        variant: 'success',
      });
    } catch (error) {
      setImageError(extractApiError(error).message);
    } finally {
      setSavingImage(false);
    }
  };

  const handleImagePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPendingImage(dataUrl); // instant preview
      await saveImage(dataUrl);
    } catch (err) {
      setImageError(err.message);
    } finally {
      setPendingImage(null);
    }
  };

  const handleUsernameSave = async () => {
    setUsernameError('');
    const result = buildUsernameSchema(t).safeParse({ username: usernameDraft });
    if (!result.success) {
      setUsernameError(result.error.issues[0]?.message || '');
      return;
    }

    setSavingUsername(true);
    try {
      await authService.updateUsername({ username: result.data.username });
      await refreshCurrentUser();
      toast({ title: t('settings.account.updateSuccessTitle'), variant: 'success' });
    } catch (error) {
      setUsernameError(extractApiError(error).message);
    } finally {
      setSavingUsername(false);
    }
  };


  // FET-13 — `User.notificationPreferences` (email/sms/whatsapp opt-
  // in toggles, `PATCH /notifications/me/preferences`). Read straight
  // off the signed-in `user` object rather than a separate fetch —
  // `GET /auth/me` (which populates `user` on load/refresh) already
  // returns the full document, same convention `preferences` above
  // uses for theme.
  const notificationPrefs = user?.notificationPreferences || { email: true, sms: false, whatsapp: false };

  const handleToggleChannel = async (channel, checked) => {
    setSavingChannel(channel);
    try {
      await notificationsService.updateNotificationPreferences({ [channel]: checked });
      await refreshCurrentUser();
    } catch (error) {
      toast({
        title: t('settings.notificationDelivery.updateFailedTitle'),
        description: extractApiError(error).message,
        variant: 'destructive',
      });
    } finally {
      setSavingChannel(null);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: t('settings.resetConfirmTitle'),
      description: t('settings.resetConfirmDescription'),
      confirmLabel: t('settings.resetConfirmLabel'),
    });
    if (!confirmed) return;
    resetPreferences();
    toast({ title: t('settings.resetToastTitle'), variant: 'success' });
  };

  // FET-18 — same "merge into the one preferences subdocument" shape
  // every other control on this page uses (see `wallpaper` below),
  // applied to `speech` so a single-field change (e.g. just `rate`)
  // never clobbers the rest of the user's speech settings.
  const speechPrefs = preferences.speech || {};
  const updateSpeechPref = (partial) => updatePreferences({ speech: { ...speechPrefs, ...partial } });

  // Only offer voices that plausibly match the app's current
  // language — a full unfiltered list mixes in voices the user could
  // select but that would silently switch the utterance to a
  // language they didn't choose in Settings > Language.
  const languageVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith(i18n.language));
  const voiceOptions = languageVoices.length > 0 ? languageVoices : voices;

  const handleTestVoice = () => {
    if (speaking) {
      stopSpeech();
      return;
    }
    speakText(t('settings.speech.testPhrase'));
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t('settings.breadcrumbDashboard'), to: '/dashboard' },
          { label: t('settings.breadcrumbSettings') },
        ]}
        title={t('settings.title')}
        description={t('settings.description')}
        actions={
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw size={14} /> {t('settings.resetToDefault')}
          </Button>
        }
      />

      <div className="grid gap-5 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.account.title')}</CardTitle>
            <CardDescription>{t('settings.account.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <div className="grid gap-5 min-w-0">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <FloatField label={t('settings.account.emailLabel', 'Email')} htmlFor="settings-email" surface="card" className="flex-1">
                      <input
                        id="settings-email"
                        type="email"
                        className={controlClass}
                        value={emailDraft}
                        onChange={(e) => {
                          setEmailDraft(e.target.value);
                          setEmailError('');
                        }}
                        disabled={savingEmail}
                        autoComplete="email"
                        maxLength={254}
                      />
                    </FloatField>
                    <Button size="sm" onClick={handleEmailSave} disabled={savingEmail || !emailChanged}>
                      {savingEmail ? t('common.saving') : t('common.save')}
                    </Button>
                  </div>
                  {emailChanged ? (
                    <div className="mt-4">
                      <FloatField label={t('settings.account.currentPasswordLabel', 'Current password')} htmlFor="settings-email-password" surface="card">
                        <input
                          id="settings-email-password"
                          type="password"
                          className={controlClass}
                          value={emailPassword}
                          onChange={(e) => {
                            setEmailPassword(e.target.value);
                            setEmailError('');
                          }}
                          disabled={savingEmail}
                          autoComplete="current-password"
                        />
                      </FloatField>
                    </div>
                  ) : null}
                  {emailError ? (
                    <p className="text-xs text-destructive mt-1.5">{emailError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {user?.email && !user?.emailVerifiedAt
                        ? t('settings.account.emailUnverified', 'Not verified yet. Check your inbox for the verification link.')
                        : t('settings.account.emailHelper', 'Used to sign in and for account notices. Changing it requires your current password.')}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
<FloatField label={t('settings.account.usernameLabel')} htmlFor="settings-username" surface="card" className="flex-1">
<input
                id="settings-username"
                className={controlClass}
                value={usernameDraft}
                onChange={(e) => {
                  setUsernameDraft(e.target.value);
                  setUsernameError('');
                }}
                disabled={savingUsername}
                autoComplete="username"
              />
</FloatField>
              <Button
                size="sm"
                onClick={handleUsernameSave}
                disabled={savingUsername || usernameDraft.trim() === (user?.username || '')}
              >
                {savingUsername ? t('common.saving') : t('common.save')}
              </Button>
            </div>
            {usernameError ? (
              <p className="text-xs text-destructive mt-1.5">{usernameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">{t('settings.account.usernameHelper')}</p>
            )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/40 p-5 md:w-56">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={savingImage}
                  aria-label={t('settings.account.imageUpload', 'Upload image')}
                  className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-primary/50 bg-primary/10 text-primary grid place-items-center disabled:opacity-60"
                >
                  {pendingImage || user?.profileImage ? (
                    <img src={pendingImage || user.profileImage} alt={t('settings.account.imagePreview', 'Profile picture preview')} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={56} aria-hidden="true" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImagePicked}
                />
                <p className="text-sm font-medium">{t('settings.account.imageTitle', 'Profile picture')}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={savingImage}>
                    <Upload size={14} /> {savingImage ? t('common.saving') : t('settings.account.imageUpload', 'Upload image')}
                  </Button>
                  {user?.profileImage ? (
                    <Button size="sm" variant="outline" onClick={() => saveImage(null)} disabled={savingImage} aria-label={t('settings.account.imageRemove', 'Remove picture')}>
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </div>
                {imageError ? <p className="text-xs text-destructive text-center">{imageError}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.themeMode.title')}</CardTitle>
            <CardDescription>{t('settings.themeMode.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updatePreferences({ mode: opt.value })}
                aria-pressed={preferences.mode === opt.value}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  preferences.mode === opt.value
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.language.title')}</CardTitle>
            <CardDescription>{t('settings.language.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updatePreferences({ language: opt.value })}
                aria-pressed={preferences.language === opt.value}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  preferences.language === opt.value
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.colorTheme.title')}</CardTitle>
            <CardDescription>{t('settings.colorTheme.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                onClick={() => updatePreferences({ colorTheme: theme.value })}
                aria-pressed={preferences.colorTheme === theme.value}
                title={theme.label}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="h-10 w-10 rounded-full border-2 grid place-items-center"
                  style={{
                    backgroundColor: theme.swatch,
                    borderColor: preferences.colorTheme === theme.value ? theme.swatch : 'transparent',
                    boxShadow:
                      preferences.colorTheme === theme.value
                        ? `0 0 0 2px white, 0 0 0 4px ${theme.swatch}`
                        : 'none',
                  }}
                >
                  {preferences.colorTheme === theme.value ? (
                    <Check size={16} className="text-white" />
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{theme.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Text color</CardTitle>
            <CardDescription>
              Sets the color of ordinary text. Each option is matched for light and dark mode, so it stays readable if you switch modes.
              {preferences.highContrast ? ' High contrast is on, so it overrides this choice for maximum readability.' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {TEXT_COLOR_OPTIONS.map((opt) => {
              const swatch = isDark ? opt.swatchDark : opt.swatchLight;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updatePreferences({ textColor: opt.value })}
                  aria-pressed={preferences.textColor === opt.value}
                  title={opt.label}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className="h-10 w-10 rounded-full border-2 grid place-items-center bg-card"
                    style={{
                      borderColor: preferences.textColor === opt.value ? swatch : 'transparent',
                      boxShadow:
                        preferences.textColor === opt.value
                          ? `0 0 0 2px hsl(var(--card)), 0 0 0 4px ${swatch}`
                          : 'none',
                    }}
                  >
                    <span
                      className="text-sm font-bold"
                      style={{ color: swatch }}
                      aria-hidden="true"
                    >
                      Aa
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{opt.label}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.textSize.title')}</CardTitle>
            <CardDescription>{t('settings.textSize.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {TYPOGRAPHY_SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updatePreferences({ typographyScale: opt.value })}
                aria-pressed={preferences.typographyScale === opt.value}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  preferences.typographyScale === opt.value
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.uiZoom.title')}</CardTitle>
            <CardDescription>{t('settings.uiZoom.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <input
              type="range"
              min={90}
              max={150}
              step={5}
              value={preferences.uiZoomPercent}
              onChange={(e) => updatePreferences({ uiZoomPercent: Number(e.target.value) })}
              className="flex-1"
              aria-label={t('settings.uiZoom.title')}
            />
            <span className="w-14 text-right text-sm font-semibold tabular-nums">
              {preferences.uiZoomPercent}%
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.accessibility.title')}</CardTitle>
            <CardDescription>{t('settings.accessibility.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5">
              <span>
                <span className="block text-sm font-medium">{t('settings.accessibility.reduceMotion')}</span>
                <span className="block text-xs text-muted-foreground">
                  {t('settings.accessibility.reduceMotionDescription')}
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={preferences.reducedMotion}
                onChange={(e) => updatePreferences({ reducedMotion: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5">
              <span>
                <span className="block text-sm font-medium">{t('settings.accessibility.highContrast')}</span>
                <span className="block text-xs text-muted-foreground">
                  {t('settings.accessibility.highContrastDescription')}
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={preferences.highContrast}
                onChange={(e) => updatePreferences({ highContrast: e.target.checked })}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.speech.title')}</CardTitle>
            <CardDescription>
              {speechSupported ? t('settings.speech.description') : t('settings.speech.unsupported')}
            </CardDescription>
          </CardHeader>
          {speechSupported ? (
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5">
                <span>
                  <span className="block text-sm font-medium">{t('settings.speech.enable')}</span>
                  <span className="block text-xs text-muted-foreground">{t('settings.speech.enableDescription')}</span>
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={speechPrefs.enabled !== false}
                  onChange={(e) => updateSpeechPref({ enabled: e.target.checked })}
                />
              </label>

              <div className={speechPrefs.enabled === false ? 'opacity-50 pointer-events-none space-y-4' : 'space-y-4'}>
                <div className="flex items-center gap-4">
                  <span className="w-20 shrink-0 text-sm">{t('settings.speech.rate')}</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={speechPrefs.rate ?? 1}
                    onChange={(e) => updateSpeechPref({ rate: Number(e.target.value) })}
                    className="flex-1"
                    aria-label={t('settings.speech.rate')}
                  />
                  <span className="w-10 text-right text-sm tabular-nums">{(speechPrefs.rate ?? 1).toFixed(1)}x</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-20 shrink-0 text-sm">{t('settings.speech.pitch')}</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={speechPrefs.pitch ?? 1}
                    onChange={(e) => updateSpeechPref({ pitch: Number(e.target.value) })}
                    className="flex-1"
                    aria-label={t('settings.speech.pitch')}
                  />
                  <span className="w-10 text-right text-sm tabular-nums">{(speechPrefs.pitch ?? 1).toFixed(1)}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-20 shrink-0 text-sm">{t('settings.speech.volume')}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={speechPrefs.volume ?? 1}
                    onChange={(e) => updateSpeechPref({ volume: Number(e.target.value) })}
                    className="flex-1"
                    aria-label={t('settings.speech.volume')}
                  />
                  <span className="w-10 text-right text-sm tabular-nums">{Math.round((speechPrefs.volume ?? 1) * 100)}%</span>
                </div>

                <div className="flex items-center gap-4">
                  <FloatField label={t('settings.speech.voice')} surface="card" className="flex-1">
                  <select
                    className={controlClass}
                    value={speechPrefs.voiceName || ''}
                    onChange={(e) => updateSpeechPref({ voiceName: e.target.value || null })}
                  >
                    <option value="">{t('settings.speech.voiceAuto')}</option>
                    {voiceOptions.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                  </FloatField>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={handleTestVoice}>
                  {speaking ? t('settings.speech.stopTest') : t('settings.speech.testVoice')}
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.voiceAssistant.title')}</CardTitle>
            <CardDescription>{t('settings.voiceAssistant.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
<FloatField label={t('settings.voiceAssistant.nameLabel')} htmlFor="settings-assistant-name" surface="card" className="flex-1">
<input
                id="settings-assistant-name"
                className={controlClass}
                value={assistantNameDraft}
                onChange={(e) => {
                  setAssistantNameDraft(e.target.value);
                  setAssistantNameError('');
                }}
                maxLength={50}
                disabled={savingAssistantName}
              />
</FloatField>
              <Button
                size="sm"
                onClick={handleAssistantNameSave}
                disabled={
                  savingAssistantName ||
                  assistantNameDraft.trim() === savedAssistantName
                }
              >
                {savingAssistantName ? t('common.saving') : t('common.save')}
              </Button>
            </div>
            {assistantNameError ? (
              <p className="text-xs text-destructive mt-1.5">{assistantNameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">{t('settings.voiceAssistant.helper')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.notificationDelivery.title')}</CardTitle>
            <CardDescription>{t('settings.notificationDelivery.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'email',
                label: t('settings.notificationDelivery.email'),
                description: user?.email
                  ? t('settings.notificationDelivery.emailDescription', { email: user.email })
                  : t('settings.notificationDelivery.emailDescriptionFallback'),
              },
              {
                key: 'sms',
                label: t('settings.notificationDelivery.sms'),
                description: t('settings.notificationDelivery.phoneDescription'),
              },
              {
                key: 'whatsapp',
                label: t('settings.notificationDelivery.whatsapp'),
                description: t('settings.notificationDelivery.phoneDescription'),
              },
            ].map((channel) => (
              <label
                key={channel.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5"
              >
                <span>
                  <span className="block text-sm font-medium">{channel.label}</span>
                  <span className="block text-xs text-muted-foreground">{channel.description}</span>
                </span>
                {savingChannel === channel.key ? (
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" aria-hidden="true" />
                ) : (
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={Boolean(notificationPrefs[channel.key])}
                    disabled={savingChannel !== null}
                    onChange={(e) => handleToggleChannel(channel.key, e.target.checked)}
                  />
                )}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.wallpaper.title')}</CardTitle>
            <CardDescription>{t('settings.wallpaper.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {WALLPAPER_OPTIONS.map((opt) => {
              const isSelected =
                (opt.value === 'NONE' && preferences.wallpaper?.type === 'NONE') ||
                (opt.value !== 'NONE' &&
                  preferences.wallpaper?.type === 'BUILT_IN' &&
                  preferences.wallpaper?.value === opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    updatePreferences({
                      wallpaper:
                        opt.value === 'NONE'
                          ? { type: 'NONE', value: null }
                          : { type: 'BUILT_IN', value: opt.value },
                    })
                  }
                  aria-pressed={isSelected}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
