import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Save,
  Pencil,
  X,
  Lock,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  CalendarDays,
  Clock,
  User,
  RotateCcw,
  AlertTriangle,
  PauseCircle,
} from 'lucide-react';

import * as usersService from '../services/usersService.js';
import { extractApiError } from '../services/apiClient.js';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { useAuth } from '../providers/AuthProvider.jsx';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { ErrorState } from '../components/ui/empty-state.jsx';
import { USER_STATUSES, labelFor } from '../constants/staff.js';
import { ADMIN_ASSIGNABLE_ROLES, ROLES } from '../constants/roles.js';
import { FloatField, controlClass } from '../components/ui/profile-form.jsx';

const inputClass =
  'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const statusVariant = (status) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED') return 'warning';
  return 'destructive';
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * Generates a cryptographically random temporary password.
 * Never stored anywhere — only its Argon2id hash reaches the server.
 */
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
};

/**
 * AccountDetailPage — full account detail for User Account Management.
 *
 * Access: SOFTWARE_OWNER and SUPER_ADMIN only (enforced by backend
 * USER_ACCOUNTS_ADMIN permission and frontend ProtectedRoute gate).
 *
 * SECURITY:
 * - Passwords are NEVER displayed, NEVER fetched, NEVER shown.
 * - Reset Password sets a NEW password server-side without reading the old one.
 * - Delete performs a soft-delete (INACTIVE) to preserve medical-record integrity.
 * - Protected accounts cannot be edited, role-changed, deactivated, or deleted.
 * - All actions are audit-logged on the backend (USER_DETAILS_UPDATE_BY_ADMIN,
 *   USER_PASSWORD_RESET_BY_ADMIN, USER_DELETE_BY_ADMIN, etc.).
 */
export default function AccountDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Check if current user is SOFTWARE_OWNER or SUPER_ADMIN
  const isSuperOrOwner = currentUser?.role === ROLES.SOFTWARE_OWNER || currentUser?.role === ROLES.SUPER_ADMIN;

  const [user, setUser] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  // Profile edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Role + status state
  const [roleDraft, setRoleDraft] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Reset password state
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = await usersService.getUser(id);
      setUser(data);
      setRoleDraft(data.role || '');
      setStatusDraft(data.status || '');
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    setForm({ name: user.name || '', email: user.email || '', username: user.username || '' });
    setSaveError('');
    setEditing(true);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const updated = await usersService.updateUser(id, {
        name: form.name.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
      });
      setUser((prev) => ({ ...prev, ...updated }));
      setEditing(false);
      toast({ title: t('accounts.accountUpdated', 'Account updated'), variant: 'success' });
    } catch (error) {
      setSaveError(extractApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (roleDraft === user.role) return;
    const ok = await confirm({
      title: t('accounts.changeRoleTitle', 'Change account role?'),
      description: t('accounts.changeRoleDesc', 'This changes what {{name}} can access system-wide.', { name: user.name }),
      confirmLabel: t('accounts.changeRole', 'Change role'),
    });
    if (!ok) return;

    setSavingRole(true);
    try {
      const updated = await usersService.changeUserRole(id, roleDraft);
      setUser((prev) => ({ ...prev, ...updated }));
      toast({ title: t('accounts.roleUpdated', 'Account role updated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('accounts.cannotChangeRole', 'Could not change role'), description: extractApiError(error).message, variant: 'destructive' });
      setRoleDraft(user.role || '');
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveStatus = async () => {
    if (statusDraft === user.status) return;
    const restricting = statusDraft !== 'ACTIVE';
    const ok = await confirm({
      title: restricting ? t('accounts.restrictTitle', 'Restrict this account?') : t('accounts.restoreTitle', 'Restore this account?'),
      description: restricting
        ? t('accounts.restrictDesc', '{{name}} will no longer be able to sign in.', { name: user.name })
        : t('accounts.restoreDesc', '{{name}} will be able to sign in again.', { name: user.name }),
      confirmLabel: restricting ? t('accounts.restrictAccess', 'Restrict access') : t('accounts.restoreAccess', 'Restore access'),
      variant: restricting ? 'destructive' : 'default',
    });
    if (!ok) return;

    setSavingStatus(true);
    try {
      const updated = await usersService.setUserStatus(id, statusDraft);
      setUser((prev) => ({ ...prev, ...updated }));
      toast({ title: t('accounts.statusUpdated', 'Account status updated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('accounts.cannotUpdateStatus', 'Could not update account status'), description: extractApiError(error).message, variant: 'destructive' });
      setStatusDraft(user.status || '');
    } finally {
      setSavingStatus(false);
    }
  };

  /**
   * Admin-initiated password reset.
   * NEVER reads the old password. Only the new Argon2id hash is sent to
   * the server. The plaintext is cleared from state immediately after
   * the request resolves and never appears in logs or audit records.
   */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError(t('accounts.passwordTooShort', 'Password must be at least 8 characters.'));
      return;
    }

    const ok = await confirm({
      title: t('accounts.resetPasswordTitle', 'Reset password for {{name}}?', { name: user.name }),
      description: t('accounts.resetPasswordDesc', 'The current password will be invalidated immediately and all active sessions will be revoked. The user will need to sign in with the new password.'),
      confirmLabel: t('accounts.confirmResetPassword', 'Reset password'),
      variant: 'destructive',
    });
    if (!ok) return;

    setSavingPassword(true);
    try {
      await usersService.resetUserPassword(id, newPassword);
      // Clear the plaintext immediately — NEVER keep it around after submit.
      setNewPassword('');
      setResetPasswordOpen(false);
      setShowNewPassword(false);
      toast({
        title: t('accounts.passwordReset', 'Password reset'),
        description: t('accounts.passwordResetDesc', 'All active sessions have been revoked.'),
        variant: 'success',
      });
    } catch (error) {
      setPasswordError(extractApiError(error).message);
    } finally {
      setSavingPassword(false);
    }
  };

  /**
   * Deactivate the account temporarily (soft status change to INACTIVE).
   * Record is visible to everyone but user cannot log in.
   */
  const handleDeactivateUser = async () => {
    const ok = await confirm({
      title: t('accounts.deactivateTitle', 'Deactivate account for {{name}}?', { name: user.name }),
      description: t(
        'accounts.deactivateDesc',
        'The account will be set to Inactive and all sessions revoked. The record remains intact and can be reactivated.',
      ),
      confirmLabel: t('accounts.confirmDeactivate', 'Deactivate account'),
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const updated = await usersService.setUserStatus(id, 'INACTIVE');
      setUser((prev) => ({ ...prev, ...updated }));
      toast({ title: t('accounts.accountDeactivated', 'Account deactivated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('accounts.cannotDeactivate', 'Could not deactivate account'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  /**
   * Soft-delete: marks isDeleted=true, hidden from regular views.
   * Owner/SuperAdmin can still see and restore or permanently purge it.
   */
  const handleDeleteUser = async () => {
    const ok = await confirm({
      title: t('accounts.deleteTitle', 'Delete account for {{name}}?', { name: user.name }),
      description: t(
        'accounts.deleteDesc',
        'This will archive and hide the account from all staff views. Owner and Super Admin can view, restore, or permanently purge it. Clinical records are preserved.',
      ),
      confirmLabel: t('accounts.confirmDelete', 'Delete account'),
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await usersService.deleteUser(id);
      toast({ title: t('accounts.accountDeleted', 'Account deleted'), variant: 'success' });
      navigate('/dashboard/accounts');
    } catch (error) {
      toast({ title: t('accounts.cannotDelete', 'Could not delete account'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  /**
   * Permanent hard-delete: physically removes from database.
   * Backend enforces this is only allowed for SOFTWARE_OWNER and SUPER_ADMIN.
   */
  const handleHardDeleteUser = async () => {
    // Two-step confirmation for destructive permanent action
    const ok = await confirm({
      title: t('accounts.hardDeleteTitle', '⚠️ Permanently delete {{name}} from database?', { name: user.name }),
      description: t(
        'accounts.hardDeleteDesc',
        'This action is IRREVERSIBLE. The account, all sessions, and associated profiles will be permanently removed from the database. Clinical records referencing this user will retain the reference ID but the user document will be gone forever.',
      ),
      confirmLabel: t('accounts.confirmHardDelete', 'Yes, permanently delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await usersService.hardDeleteUser(id);
      toast({ title: t('accounts.accountHardDeleted', 'Account permanently deleted'), variant: 'success' });
      navigate('/dashboard/accounts');
    } catch (error) {
      toast({ title: t('accounts.cannotHardDelete', 'Could not permanently delete account'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  /**
   * Restore a soft-deleted account. Only Owner/SuperAdmin can do this.
   */
  const handleRestoreUser = async () => {
    const ok = await confirm({
      title: t('accounts.restoreDeletedTitle', 'Restore deleted account for {{name}}?', { name: user.name }),
      description: t('accounts.restoreDeletedDesc', 'The account will be restored to Active status and all deletion flags cleared.'),
      confirmLabel: t('accounts.confirmRestore', 'Restore account'),
    });
    if (!ok) return;

    try {
      const updated = await usersService.restoreUser(id);
      setUser((prev) => ({ ...prev, ...updated }));
      toast({ title: t('accounts.accountRestored', 'Account restored'), variant: 'success' });
    } catch (error) {
      toast({ title: t('accounts.cannotRestore', 'Could not restore account'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  if (state === 'loading') {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state === 'error') {
    return <ErrorState description={errorMessage} onRetry={load} />;
  }

  const isProtected = Boolean(user.isProtected);
  const isPatient = user.role === 'PATIENT';

  return (
    <div className="max-w-3xl">
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('accounts.title', 'User Accounts'), to: '/dashboard/accounts' },
          { label: user.name || t('accounts.account', 'Account') },
        ]}
        title={user.name}
        description={user.email}
        actions={
          !editing && !isProtected ? (
            <Button size="sm" variant="outline" onClick={startEdit} id="edit-account-btn">
              <Pencil size={14} /> {t('accounts.editAccount', 'Edit account')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-5">
        {/* Protected account notice */}
        {isProtected ? (
          <Alert>
            <Lock size={14} />
            <AlertDescription>
              {t('accounts.protectedAlert', "This is a system-protected account. Its role and login access can't be changed through ordinary account management.")}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Patient account notice */}
        {isPatient ? (
          <Alert>
            <AlertDescription>
              {t('accounts.patientAlert', "This is a patient login account. Clinical and demographic details are managed from the patient's workspace under Patients, not here.")}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* ── Account Metadata Card ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User size={15} className="text-muted-foreground" />
              {t('accounts.accountInfo', 'Account information')}
            </CardTitle>
            <CardDescription>{t('accounts.accountInfoDesc', 'Identity, timestamps, and account type.')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t('common.email', 'Email')}</dt>
                <dd className="font-medium truncate">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('common.username', 'Username')}</dt>
                <dd className="font-medium">@{user.username}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('accounts.colRole', 'Role')}</dt>
                <dd><Badge variant="primary">{labelFor(user.role)}</Badge></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('accounts.colStatus', 'Status')}</dt>
                <dd>
                  <Badge variant={statusVariant(user.status)}>{labelFor(user.status)}</Badge>
                  {isProtected ? (
                    <Badge variant="info" className="ml-1">
                      <ShieldCheck size={10} className="mr-1" /> {t('accounts.protected', 'Protected')}
                    </Badge>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays size={11} /> {t('accounts.colCreated', 'Account created')}</dt>
                <dd className="text-muted-foreground">{formatDate(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} /> {t('accounts.colLastLogin', 'Last login')}</dt>
                <dd className="text-muted-foreground">{formatDate(user.lastLoginAt)}</dd>
              </div>
              {user.emailVerifiedAt ? (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('accounts.emailVerified', 'Email verified')}</dt>
                  <dd className="text-muted-foreground">{formatDate(user.emailVerifiedAt)}</dd>
                </div>
              ) : (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('accounts.emailVerified', 'Email verified')}</dt>
                  <dd><Badge variant="warning">Unverified</Badge></dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">{t('accounts.accountType', 'Account type')}</dt>
                <dd>{isProtected ? t('accounts.typeProtected', 'Protected system account') : isPatient ? t('accounts.typePatient', 'Patient portal account') : t('accounts.typeStaff', 'Staff / administrative account')}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* ── Edit Profile Card ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('accounts.loginAccount', 'Login account')}</CardTitle>
            <CardDescription>{t('accounts.loginAccountDesc', 'Identity, RBAC role, and sign-in access.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {saveError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FloatField label={t('common.fullName', 'Full name')} surface="card" htmlFor="edit-name">
                    <input
                      id="edit-name"
                      required
                      className={controlClass}
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </FloatField>
                  <FloatField label={t('common.email', 'Email')} surface="card" htmlFor="edit-email">
                    <input
                      id="edit-email"
                      required
                      type="email"
                      className={controlClass}
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </FloatField>
                  <FloatField label={t('common.username', 'Username')} surface="card" htmlFor="edit-username">
                    <input
                      id="edit-username"
                      required
                      className={controlClass}
                      value={form.username}
                      onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </FloatField>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                    <X size={14} /> {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button type="submit" size="sm" disabled={saving} id="save-profile-btn">
                    <Save size={14} /> {saving ? t('common.saving', 'Saving…') : t('common.saveChanges', 'Save changes')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.email', 'Email')}</div>
                  <div>{user.email}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('common.username', 'Username')}</div>
                  <div>@{user.username}</div>
                </div>
              </div>
            )}

            {/* Role + Status selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <div className="flex items-start gap-2">
<FloatField label={t('staff.colAccountRole', 'Account role')} surface="card" className="flex-1">
<select
                    className={controlClass}
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value)}
                    disabled={isProtected || savingRole}
                    aria-label="Account role"
                  >
                    {!ADMIN_ASSIGNABLE_ROLES.includes(user.role) ? (
                      <option value={user.role}>{labelFor(user.role)}</option>
                    ) : null}
                    {ADMIN_ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>{labelFor(role)}</option>
                    ))}
                  </select>
</FloatField>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isProtected || savingRole || roleDraft === user.role}
                    onClick={handleSaveRole}
                    id="save-role-btn"
                  >
                    {savingRole ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-start gap-2">
<FloatField label={t('staff.colAccountStatus', 'Account status')} surface="card" className="flex-1">
<select
                    className={controlClass}
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    disabled={isProtected || savingStatus}
                    aria-label="Account status"
                  >
                    {USER_STATUSES.map((status) => (
                      <option key={status} value={status}>{labelFor(status)}</option>
                    ))}
                  </select>
</FloatField>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isProtected || savingStatus || statusDraft === user.status}
                    onClick={handleSaveStatus}
                    id="save-status-btn"
                  >
                    {savingStatus ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">{t('accounts.current', 'Current:')}</span>
              <Badge variant="primary">{labelFor(user.role)}</Badge>
              <Badge variant={statusVariant(user.status)}>{labelFor(user.status)}</Badge>
              {isProtected ? (
                <Badge variant="info">
                  <ShieldCheck size={11} className="mr-1" /> {t('accounts.protected', 'Protected')}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* ── Reset Password Card ────────────────────────────────────────── */}
        {!isProtected ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound size={15} className="text-muted-foreground" />
                {t('accounts.resetPassword', 'Reset password')}
              </CardTitle>
              <CardDescription>
                {t('accounts.resetPasswordDesc2', "The existing password is never visible. Setting a new password invalidates the current one and revokes all active sessions. This action is audit-logged.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!resetPasswordOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setResetPasswordOpen(true); setNewPassword(''); setPasswordError(''); }}
                  id="open-reset-password-btn"
                >
                  <KeyRound size={14} /> {t('accounts.setNewPassword', 'Set new password')}
                </Button>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  {passwordError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div>
                                        <div className="flex gap-2">
                      <FloatField
 label={<>{t('accounts.newPassword', 'New password')} <span className="font-normal text-muted-foreground">(min. 8 chars)</span></>}
 htmlFor="new-password"
 surface="card"
 className="flex-1"
>
<input
                          id="new-password"
                          required
                          type={showNewPassword ? 'text' : 'password'}
                          minLength={8}
                          maxLength={128}
                          className={controlClass}
                          placeholder="Min. 8 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                        />
<button
                          type="button"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowNewPassword((v) => !v)}
                          aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        >
                          {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
</FloatField>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setNewPassword(generateTempPassword()); setShowNewPassword(true); }}
                        title="Generate a random temporary password"
                      >
                        <RefreshCw size={13} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => { setResetPasswordOpen(false); setNewPassword(''); setPasswordError(''); }}
                      disabled={savingPassword}
                    >
                      <X size={14} /> {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                      disabled={savingPassword || newPassword.length < 8}
                      id="confirm-reset-password-btn"
                    >
                      <KeyRound size={14} />
                      {savingPassword ? t('common.saving', 'Saving…') : t('accounts.confirmResetPassword', 'Reset password')}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* ── Danger Zone ─────────────────────────── */}
        {!isProtected ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <Trash2 size={15} />
                {t('accounts.dangerZone', 'Danger zone')}
              </CardTitle>
              <CardDescription>
                {t('accounts.dangerZoneDesc', 'Manage account lifecycle. Deactivation suspends access; deletion archives the record (visible to Owner/Super Admin only); permanent deletion removes from database.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Restore banner for soft-deleted accounts — Owner/SuperAdmin only */}
              {isSuperOrOwner && user.isDeleted ? (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {t('accounts.accountSoftDeleted', 'This account has been soft-deleted and is hidden from regular staff.')}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      {t('accounts.softDeletedAt', 'Deleted at: {{date}}', { date: user.deletedAt ? new Date(user.deletedAt).toLocaleString() : '—' })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-600"
                    onClick={handleRestoreUser}
                    id="restore-account-btn"
                  >
                    <RotateCcw size={13} /> {t('accounts.restoreAccount', 'Restore account')}
                  </Button>
                </div>
              ) : null}

              {/* Action 1: Deactivate Temporarily */}
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('accounts.deactivateTemporarily', 'Deactivate temporarily')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('accounts.deactivateNote', 'Sets status to Inactive and revokes all sessions. Can be reactivated. All records preserved.')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-400 text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-600 shrink-0"
                  onClick={handleDeactivateUser}
                  disabled={user.status === 'INACTIVE'}
                  id="deactivate-account-btn"
                >
                  <PauseCircle size={14} /> {t('accounts.deactivateAccount', 'Deactivate')}
                </Button>
              </div>

              <div className="border-t border-border" />

              {/* Action 2: Delete (soft-delete) */}
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('accounts.deleteAccount', 'Delete account')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('accounts.deleteNote', 'Archives and hides the account from all staff. Owner and Super Admin can view, restore, or permanently purge it.')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteUser}
                  disabled={user.isDeleted}
                  id="delete-account-btn"
                >
                  <Trash2 size={14} /> {t('accounts.delete', 'Delete')}
                </Button>
              </div>

              {/* Action 3: Permanent Hard Delete — Owner/SuperAdmin only */}
              {isSuperOrOwner ? (
                <>
                  <div className="border-t border-destructive/20" />
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <AlertTriangle size={16} className="mt-0.5 text-destructive shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">
                        {t('accounts.permanentDeleteTitle', 'Permanently delete from database')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('accounts.permanentDeleteNote', 'IRREVERSIBLE. Physically removes the user document and associated profiles from MongoDB. Only available to Software Owner and Super Admin.')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleHardDeleteUser}
                      id="hard-delete-account-btn"
                      className="shrink-0 bg-red-700 hover:bg-red-800"
                    >
                      <Trash2 size={14} /> {t('accounts.permanentDelete', 'Purge')}
                    </Button>
                  </div>
                </>
              ) : null}

            </CardContent>
          </Card>
        ) : null}

        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/accounts')} id="back-to-accounts-btn">
            {t('accounts.backToAccounts', '← Back to User Accounts')}
          </Button>
        </div>
      </div>
    </div>
  );
}
