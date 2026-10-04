import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import {
  ShieldCheck,
  ShieldAlert,
  Mail,
  MailCheck,
  KeyRound,
  Smartphone,
  Monitor,
  LogOut,
  Lock,
} from 'lucide-react';

import { muiFormTheme } from '../themes/muiFormTheme.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import * as authService from '../services/authService.js';
import { extractApiError } from '../services/apiClient.js';
import { buildChangePasswordSchema } from '../schemas/authSchemas.js';
import { describeUserAgent } from '../lib/parseUserAgent.js';
import { formatDateTime } from '../lib/dateFormat.js';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import FormError from '../components/auth/FormError.jsx';

const ACCOUNT_STATUS_VARIANT = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'destructive',
};

/**
 * FET-04 — Account & Security. Everything on this page talks to the
 * real backend (server/src/auth/*) — no mock data, no fake state:
 *
 *  - Account status card: role/status/email-verification straight
 *    from `GET /auth/me` (already loaded into AuthContext), plus a
 *    real "resend verification email" action
 *    (`POST /auth/resend-verification`) when it isn't verified yet.
 *  - Change password: `POST /auth/change-password`. The backend
 *    revokes every session on success (current device included), so
 *    this immediately signs the user out and sends them back to
 *    /login rather than leaving a stale, soon-to-fail session behind.
 *  - Active sessions: `GET /auth/sessions` / `DELETE
 *    /auth/sessions/:id` / `POST /auth/logout-all`. "This device" is
 *    resolved server-side (see auth.controller.js) from a hashed
 *    tokenId comparison, not guessed on the client.
 *  - MFA: the backend has no 2FA implementation at all (no fields on
 *    `User`, no verification flow) — per the "no fake security /
 *    no placeholders" rule, this is an honest "not available yet"
 *    notice, not a toggle that does nothing.
 */
export default function SecurityPage() {
  // FET-17 — this page's own body copy is still plain English
  // (pre-existing, out of this pass's scope — see this file's own
  // "Text color" card precedent). `t`/`i18n` are pulled in only to
  // localize the change-password form's validation messages, the
  // same optional-`t` pattern every other schema call site uses.
  const { t, i18n } = useTranslation();
  const { user, logout, logoutAll } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  // ------------------------------------------------------------
  // Change password
  // ------------------------------------------------------------
  const [passwordServerError, setPasswordServerError] = useState('');

  const changePasswordSchema = useMemo(() => buildChangePasswordSchema(t), [t, i18n.language]);

  const {
    control,
    handleSubmit,
    reset: resetPasswordForm,
    formState: { errors, isSubmitting: isChangingPassword },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onChangePassword = async (values) => {
    setPasswordServerError('');
    try {
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      resetPasswordForm();
      toast({
        title: 'Password changed',
        description: 'For your security, you have been signed out everywhere. Please sign in again.',
        variant: 'success',
        duration: 6000,
      });
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setPasswordServerError(extractApiError(error).message);
    }
  };

  // ------------------------------------------------------------
  // Email verification (resend)
  // ------------------------------------------------------------
  const [resendingVerification, setResendingVerification] = useState(false);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResendingVerification(true);
    try {
      await authService.resendVerification({ identifier: user.email });
      toast({
        title: 'Verification email sent',
        description: `Check ${user.email} for a link to verify your account.`,
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Could not send verification email',
        description: extractApiError(error).message,
        variant: 'destructive',
      });
    } finally {
      setResendingVerification(false);
    }
  };

  // ------------------------------------------------------------
  // Active sessions / device management
  // ------------------------------------------------------------
  const [sessions, setSessions] = useState(null);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError('');
    try {
      const list = await authService.listSessions();
      setSessions(list);
    } catch (error) {
      setSessionsError(extractApiError(error).message);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (session) => {
    const confirmed = await confirm({
      title: 'Sign out this device?',
      description: session.current
        ? 'This is your current device. Signing it out here will end this session immediately.'
        : `This will immediately end the session on ${describeUserAgent(session.userAgent)}${
            session.ipAddress ? ` (${session.ipAddress})` : ''
          }.`,
      confirmLabel: 'Sign out device',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setRevokingId(session.id);
    try {
      await authService.revokeSession(session.id);
      if (session.current) {
        toast({ title: 'Signed out', variant: 'success' });
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      toast({ title: 'Device signed out', variant: 'success' });
      setSessions((prev) => (prev || []).filter((s) => s.id !== session.id));
    } catch (error) {
      toast({
        title: 'Could not sign out that device',
        description: extractApiError(error).message,
        variant: 'destructive',
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleSignOutEverywhere = async () => {
    const confirmed = await confirm({
      title: 'Sign out of every device?',
      description:
        'This immediately ends every active session, including this one. You will need to sign in again.',
      confirmLabel: 'Sign out everywhere',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setSigningOutEverywhere(true);
    try {
      await logoutAll();
      toast({ title: 'Signed out of every device', variant: 'success' });
      navigate('/login', { replace: true });
    } catch (error) {
      toast({
        title: 'Could not sign out of every device',
        description: extractApiError(error).message,
        variant: 'destructive',
      });
      setSigningOutEverywhere(false);
    }
  };

  const emailVerified = Boolean(user?.emailVerifiedAt);
  const accountStatus = user?.status || 'ACTIVE';

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Account & security' }]}
        title="Account & security"
        description="Manage your password, active sessions, and account status."
      />

      <div className="grid gap-5 max-w-3xl">
        {/* ------------------------------------------------------ */}
        {/* Account status                                         */}
        {/* ------------------------------------------------------ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account status</CardTitle>
            <CardDescription>The current standing of your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={ACCOUNT_STATUS_VARIANT[accountStatus] || 'neutral'}>
                {accountStatus === 'ACTIVE' ? 'Active' : accountStatus === 'SUSPENDED' ? 'Suspended' : 'Inactive'}
              </Badge>
              <Badge variant="neutral">{user?.role}</Badge>
              {emailVerified ? (
                <Badge variant="success">
                  <MailCheck size={12} className="mr-1" aria-hidden="true" />
                  Email verified
                </Badge>
              ) : (
                <Badge variant="warning">
                  <Mail size={12} className="mr-1" aria-hidden="true" />
                  Email not verified
                </Badge>
              )}
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm pt-1">
              <div>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd className="font-medium">{formatDateTime(user?.lastLoginAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account created</dt>
                <dd className="font-medium">{formatDateTime(user?.createdAt)}</dd>
              </div>
            </dl>

            {!emailVerified ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-3.5 mt-2">
                <ShieldAlert size={18} className="text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <p className="text-sm text-amber-900 dark:text-amber-200 flex-1 min-w-[12rem]">
                  Your email address isn&apos;t verified yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                >
                  {resendingVerification ? 'Sending…' : 'Resend verification email'}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------ */}
        {/* Change password                                        */}
        {/* ------------------------------------------------------ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound size={16} aria-hidden="true" /> Change password
            </CardTitle>
            <CardDescription>You&apos;ll be signed out everywhere once it&apos;s changed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onChangePassword)} noValidate className="max-w-md">
              <FormError message={passwordServerError} />
              {/* One UI dark-mode contrast fix — these are plain MUI
                  `TextField`s (via `PasswordField`) with no MUI
                  `ThemeProvider` above them elsewhere on this page,
                  unlike the auth flow's `AuthLayout.jsx`. Without one,
                  MUI renders its own default light-mode label/input
                  text (near-black) against this page's dark surface —
                  invisible in dark/system-dark mode. `muiFormTheme`
                  points every color at the same `--foreground`/
                  `--muted-foreground`/`--background`/`--border` CSS
                  variables the rest of this page already uses, so it
                  tracks light/dark/system automatically. */}
              <MuiThemeProvider theme={muiFormTheme}>
                <div className="flex flex-col gap-4">
                  <Controller
                    name="currentPassword"
                    control={control}
                    render={({ field }) => (
                      <PasswordField
                        {...field}
                        label="Current password"
                        autoComplete="current-password"
                        error={Boolean(errors.currentPassword)}
                        helperText={errors.currentPassword?.message}
                      />
                    )}
                  />
                  <Controller
                    name="newPassword"
                    control={control}
                    render={({ field }) => (
                      <PasswordField
                        {...field}
                        label="New password"
                        autoComplete="new-password"
                        error={Boolean(errors.newPassword)}
                        helperText={
                          errors.newPassword?.message
                          || 'At least 8 characters, with an uppercase, lowercase letter, and a number'
                        }
                      />
                    )}
                  />
                  <Controller
                    name="confirmPassword"
                    control={control}
                    render={({ field }) => (
                      <PasswordField
                        {...field}
                        label="Confirm new password"
                        autoComplete="new-password"
                        error={Boolean(errors.confirmPassword)}
                        helperText={errors.confirmPassword?.message}
                      />
                    )}
                  />
                  <Button type="submit" size="lg" disabled={isChangingPassword} className="mt-1 self-start">
                    <Lock size={16} />
                    {isChangingPassword ? 'Changing password…' : 'Change password'}
                  </Button>
                </div>
              </MuiThemeProvider>
            </form>
          </CardContent>
        </Card>

        {/* ------------------------------------------------------ */}
        {/* Two-factor authentication                              */}
        {/* ------------------------------------------------------ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck size={16} aria-hidden="true" /> Two-factor authentication
            </CardTitle>
            <CardDescription>An extra layer of security for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3.5">
              <span className="text-sm text-muted-foreground">
                Two-factor authentication isn&apos;t available yet. We&apos;ll let you know here as soon as
                it launches.
              </span>
              <Badge variant="neutral">Coming soon</Badge>
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------------------------------ */}
        {/* Active sessions / device management                    */}
        {/* ------------------------------------------------------ */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Active sessions</CardTitle>
                <CardDescription>Devices currently signed in to your account.</CardDescription>
              </div>
              {sessions && sessions.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOutEverywhere}
                  disabled={signingOutEverywhere}
                >
                  <LogOut size={14} />
                  {signingOutEverywhere ? 'Signing out…' : 'Sign out everywhere'}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={24} />
              </div>
            ) : sessionsError ? (
              <ErrorState description={sessionsError} onRetry={loadSessions} />
            ) : !sessions || sessions.length === 0 ? (
              <EmptyState
                icon={Monitor}
                title="No active sessions"
                description="You're not signed in anywhere right now."
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {sessions.map((session) => {
                  const isPhoneOrTablet = /iPhone|iPad|Android/.test(session.userAgent || '');
                  const DeviceIcon = isPhoneOrTablet ? Smartphone : Monitor;
                  return (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5"
                    >
                      <DeviceIcon size={20} className="text-muted-foreground shrink-0" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {describeUserAgent(session.userAgent)}
                          </p>
                          {session.current ? <Badge variant="primary">This device</Badge> : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.ipAddress ? `${session.ipAddress} · ` : ''}
                          Signed in {formatDateTime(session.createdAt)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session)}
                        disabled={revokingId === session.id}
                      >
                        {revokingId === session.id ? 'Signing out…' : 'Sign out'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
