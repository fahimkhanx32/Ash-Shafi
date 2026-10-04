import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UsersRound, ShieldCheck, Plus, RefreshCw, Eye, EyeOff, Archive, Trash2, RotateCcw } from 'lucide-react';

import { useAuth } from '../providers/AuthProvider.jsx';
import { useConfirm } from '../providers/ConfirmProvider.jsx';

import * as usersService from '../services/usersService.js';
import { extractApiError } from '../services/apiClient.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { FilterBar } from '../components/ui/filter-bar.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { TableSkeleton } from '../components/ui/skeleton.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../components/ui/dialog.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { ROLES } from '../constants/roles.js';
import { ADMIN_ASSIGNABLE_ROLES } from '../constants/roles.js';
import { USER_STATUSES, labelFor } from '../constants/staff.js';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';
const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const statusVariant = (status) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED') return 'warning';
  return 'destructive';
};

/**
 * Generates a cryptographically random temporary password client-side.
 * The value is never stored — only its Argon2id hash is persisted on
 * the backend after the form is submitted.
 */
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
};

const INITIAL_FORM = { name: '', email: '', username: '', role: ADMIN_ASSIGNABLE_ROLES[0] || '', password: '' };

/**
 * CreateUserDialog — modal for provisioning a new staff/admin
 * account. The password is supplied by the administrator or generated
 * automatically. It is hashed with Argon2id server-side and the
 * plaintext is never stored or logged.
 *
 * Uses standard <Dialog> primitive which maintains stable input focus
 * throughout continuous typing.
 */
function CreateUserDialog({ open, onOpenChange, onCreated }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleGeneratePassword = () => {
    setForm((prev) => ({ ...prev, password: generateTempPassword() }));
    setShowPassword(true);
  };

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving) {
      setForm(INITIAL_FORM);
      setError('');
      setShowPassword(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.username.trim() || !form.role) {
      setError('All fields are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const created = await usersService.createUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim().toLowerCase(),
        role: form.role,
        // NOTE: password is sent over HTTPS and hashed with Argon2id
        // server-side. It is never stored, logged, or returned.
        password: form.password,
      });
      toast({
        title: t('accounts.userCreated', 'Account created'),
        description: t('accounts.userCreatedDesc', 'A password-setup email has been sent.'),
        variant: 'success',
      });
      handleClose(false);
      onCreated(created);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-lg">
      <DialogCloseButton onClose={() => handleClose(false)} />
      <DialogHeader>
        <DialogTitle>{t('accounts.createAccountTitle', 'Create user account')}</DialogTitle>
        <DialogDescription>
          {t('accounts.createAccountSubtitle', 'New staff or administrator account. A password-set email will be sent.')}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="create-name">{t('common.fullName', 'Full name')} *</label>
            <input
              id="create-name"
              required
              className={inputClass}
              placeholder="Dr. Jane Smith"
              value={form.name}
              onChange={set('name')}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="create-email">{t('common.email', 'Email')} *</label>
            <input
              id="create-email"
              required
              type="email"
              className={inputClass}
              placeholder="jane@clinic.com"
              value={form.email}
              onChange={set('email')}
            />
          </div>
        </div>

        {/* Username + Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="create-username">{t('common.username', 'Username')} *</label>
            <input
              id="create-username"
              required
              className={inputClass}
              placeholder="jane.smith"
              value={form.username}
              onChange={set('username')}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="create-role">{t('staff.colAccountRole', 'Role')} *</label>
            <select
              id="create-role"
              required
              className={`${selectClass} w-full`}
              value={form.role}
              onChange={set('role')}
            >
              {ADMIN_ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{labelFor(r)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className={labelClass} htmlFor="create-password">
            {t('accounts.initialPassword', 'Initial password')} *
            <span className="ml-2 text-muted-foreground font-normal">
              ({t('accounts.passwordNote', 'never stored in plaintext — Argon2id hashed server-side')})
            </span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="create-password"
                required
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                maxLength={128}
                className={`${inputClass} pr-10`}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleGeneratePassword}>
              <RefreshCw size={13} /> Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('accounts.passwordEmailNote', 'The user will also receive a password-set email to choose their own password.')}
          </p>
        </div>

        {/* Actions */}
        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? t('common.creating', 'Creating…') : t('accounts.createAccount', 'Create account')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/**
 * AllAccountsPage — User Account Management dashboard.
 *
 * Access: SOFTWARE_OWNER and SUPER_ADMIN only.
 * Backend gate: USER_ACCOUNTS_ADMIN permission on every /api/v1/users route.
 * Frontend gate: USER_ACCOUNTS_ADMIN_ROLES in App.jsx ProtectedRoute +
 *               navConfig.js allowedRoles (hiding the nav item is UX only —
 *               the backend enforces authorization regardless).
 *
 * Displays all platform accounts (every role including PATIENT) with
 * search, role filter, status filter, sorting, and pagination. Allows
 * creation of new staff/admin accounts via the CreateUserDialog.
 */
export default function AllAccountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const isSuperOrOwner = currentUser?.role === ROLES.SOFTWARE_OWNER || currentUser?.role === ROLES.SUPER_ADMIN;

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [showDeletedArchive, setShowDeletedArchive] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await usersService.listUsers({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(isSuperOrOwner && showDeletedArchive ? { onlyDeleted: true } : {}),
      });
      setItems(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, search, role, status, showDeletedArchive, isSuperOrOwner]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change re-queries from page 1.
  useEffect(() => {
    setPage(1);
  }, [search, role, status, showDeletedArchive]);

  const handleCreated = useCallback((newUser) => {
    setShowCreateDialog(false);
    // Navigate to the new account's detail page.
    if (newUser?.id || newUser?._id) {
      navigate(`/dashboard/accounts/${newUser.id || newUser._id}`);
    } else {
      load();
    }
  }, [navigate, load]);

  const handleQuickPurge = async (e, targetUser) => {
    e.stopPropagation();
    const ok = await confirm({
      title: t('accounts.hardDeleteTitle', '⚠️ Permanently delete {{name}} from database?', { name: targetUser.name }),
      description: t(
        'accounts.hardDeleteDesc',
        'This action is IRREVERSIBLE. The account, all sessions, and associated profiles will be permanently removed from MongoDB database.',
      ),
      confirmLabel: t('accounts.confirmHardDelete', 'Yes, permanently delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await usersService.hardDeleteUser(targetUser.id);
      toast({ title: t('accounts.accountHardDeleted', 'Account permanently deleted from database'), variant: 'success' });
      load();
    } catch (error) {
      toast({ title: t('accounts.cannotHardDelete', 'Could not permanently delete account'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  const handleQuickRestore = async (e, targetUser) => {
    e.stopPropagation();
    try {
      await usersService.restoreUser(targetUser.id);
      toast({ title: t('accounts.accountRestored', 'Account restored successfully'), variant: 'success' });
      load();
    } catch (error) {
      toast({ title: t('accounts.cannotRestore', 'Could not restore account'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  const handleQuickSoftDelete = async (e, targetUser) => {
    e.stopPropagation();
    const ok = await confirm({
      title: t('accounts.deleteTitle', 'Delete account for {{name}}?', { name: targetUser.name }),
      description: t(
        'accounts.deleteDesc',
        'This will archive and hide the account from all staff views. You can restore or permanently purge it from the Deleted Archive tab.',
      ),
      confirmLabel: t('accounts.confirmDelete', 'Delete account'),
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await usersService.deleteUser(targetUser.id);
      toast({ title: t('accounts.accountDeleted', 'Account archived'), variant: 'success' });
      load();
    } catch (error) {
      toast({ title: t('accounts.cannotDelete', 'Could not delete account'), description: extractApiError(error).message, variant: 'destructive' });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  return (
    <div>
      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
      />

      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('accounts.title', 'User Accounts') },
        ]}
        title={t('accounts.title', 'User Accounts')}
        description={t('accounts.pageDescription', 'Full platform account management — every login account, every role. Only Software Owner and Super Admin can access this module.')}
        actions={
          <Button
            id="create-account-btn"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus size={14} /> {t('accounts.createAccount', 'Create account')}
          </Button>
        }
      />

      {/* Security notice */}
      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />
        <span>
          <strong className="text-foreground">Restricted module.</strong>{' '}
          {t('accounts.securityNotice', 'Access is limited to Software Owner and Super Admin. All actions are audit-logged. Passwords are never visible — use Reset Password to issue new credentials.')}
        </span>
      </div>

      {/* Deleted Archive tab — Owner/SuperAdmin only */}
      {isSuperOrOwner ? (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setShowDeletedArchive(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !showDeletedArchive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            id="tab-all-accounts"
          >
            {t('accounts.allAccounts', 'All accounts')}
          </button>
          <button
            onClick={() => setShowDeletedArchive(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showDeletedArchive
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            id="tab-deleted-archive"
          >
            <Archive size={13} /> {t('accounts.deletedArchive', 'Deleted Archive')}
          </button>
        </div>
      ) : null}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('accounts.searchPlaceholder', 'Search by name, email, or username…')}
      >
        <select
          className={selectClass}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label={t('accounts.filterByRole', 'Filter by role')}
          id="filter-role"
        >
          <option value="">{t('accounts.allRoles', 'All roles')}</option>
          {Object.values(ROLES).map((value) => (
            <option key={value} value={value}>{labelFor(value)}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('accounts.filterByStatus', 'Filter by status')}
          id="filter-status"
        >
          <option value="">{t('accounts.allStatuses', 'All statuses')}</option>
          {USER_STATUSES.map((value) => (
            <option key={value} value={value}>{labelFor(value)}</option>
          ))}
        </select>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accounts.colName', 'Name / Email')}</TableHead>
                <TableHead>{t('accounts.colUsername', 'Username')}</TableHead>
                <TableHead>{t('accounts.colRole', 'Role')}</TableHead>
                <TableHead>{t('accounts.colStatus', 'Status')}</TableHead>
                <TableHead>{t('accounts.colCreated', 'Created')}</TableHead>
                <TableHead>{t('accounts.colLastLogin', 'Last Login')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={6} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={t('accounts.emptyTitle', 'No accounts found')}
          description={t('accounts.emptyDescription', 'No accounts match these filters yet.')}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 lg:hidden">
            {items.map((user) => (
              <div
                key={user.id}
                onClick={() => navigate(`/dashboard/accounts/${user.id}`)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors cursor-pointer active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                  {user.isDeleted ? (
                    <Badge variant="destructive">{t('accounts.deletedArchiveBadge', 'Deleted')}</Badge>
                  ) : (
                    <Badge variant={statusVariant(user.status)}>{labelFor(user.status)}</Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{labelFor(user.role)}</Badge>
                    {user.isProtected ? (
                      <Badge variant="info">
                        <ShieldCheck size={11} className="mr-1" /> {t('accounts.protected', 'Protected')}
                      </Badge>
                    ) : null}
                  </div>
                  {isSuperOrOwner && !user.isProtected ? (
                    <div className="flex items-center gap-1">
                      {user.isDeleted ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={(e) => handleQuickRestore(e, user)}
                            title="Restore account"
                          >
                            <RotateCcw size={12} className="mr-1" /> {t('accounts.restore', 'Restore')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs bg-red-700 hover:bg-red-800"
                            onClick={(e) => handleQuickPurge(e, user)}
                            title="Permanently remove from database"
                          >
                            <Trash2 size={12} className="mr-1" /> {t('accounts.purge', 'Purge')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={(e) => handleQuickSoftDelete(e, user)}
                            title="Archive account"
                          >
                            <Trash2 size={12} className="mr-1" /> {t('accounts.delete', 'Delete')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs bg-red-700 hover:bg-red-800"
                            onClick={(e) => handleQuickPurge(e, user)}
                            title="Permanently remove from database"
                          >
                            <Trash2 size={12} className="mr-1" /> {t('accounts.purge', 'Purge')}
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {t('accounts.colCreated', 'Created')}: {formatDate(user.createdAt)}
                  {user.lastLoginAt ? ` · ${t('accounts.colLastLogin', 'Last login')}: ${formatDate(user.lastLoginAt)}` : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounts.colName', 'Name / Email')}</TableHead>
                    <TableHead>{t('accounts.colUsername', 'Username')}</TableHead>
                    <TableHead>{t('accounts.colRole', 'Role')}</TableHead>
                    <TableHead>{t('accounts.colStatus', 'Status')}</TableHead>
                    <TableHead>{t('accounts.colCreated', 'Created')}</TableHead>
                    <TableHead>{t('accounts.colLastLogin', 'Last Login')}</TableHead>
                    {isSuperOrOwner ? <TableHead className="text-right">{t('accounts.colActions', 'Actions')}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/accounts/${user.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-1.5">
                              {user.name}
                              {user.isProtected ? (
                                <ShieldCheck size={13} className="shrink-0 text-muted-foreground" />
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">@{user.username}</TableCell>
                      <TableCell>
                        <Badge variant="primary">{labelFor(user.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.isDeleted ? (
                          <Badge variant="destructive">{t('accounts.deletedArchiveBadge', 'Deleted')}</Badge>
                        ) : (
                          <Badge variant={statusVariant(user.status)}>{labelFor(user.status)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(user.lastLoginAt)}</TableCell>
                      {isSuperOrOwner ? (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {!user.isProtected ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {user.isDeleted ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                    onClick={(e) => handleQuickRestore(e, user)}
                                    title="Restore account"
                                  >
                                    <RotateCcw size={12} className="mr-1" /> {t('accounts.restore', 'Restore')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2 text-xs bg-red-700 hover:bg-red-800"
                                    onClick={(e) => handleQuickPurge(e, user)}
                                    title="Permanently remove from database"
                                  >
                                    <Trash2 size={12} className="mr-1" /> {t('accounts.purge', 'Purge')}
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
                                    onClick={(e) => handleQuickSoftDelete(e, user)}
                                    title="Archive account (Soft Delete)"
                                  >
                                    <Trash2 size={12} className="mr-1" /> {t('accounts.delete', 'Delete')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2 text-xs bg-red-700 hover:bg-red-800"
                                    onClick={(e) => handleQuickPurge(e, user)}
                                    title="Permanently purge from database"
                                  >
                                    <Trash2 size={12} className="mr-1" /> {t('accounts.purge', 'Purge')}
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          <Pagination
            className="mt-4"
            page={pagination?.page || page}
            totalPages={pagination?.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
