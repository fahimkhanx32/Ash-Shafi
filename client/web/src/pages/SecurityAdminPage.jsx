import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertTriangle, LogOut, RotateCw, ShieldCheck, Users } from 'lucide-react';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { FilterBar } from '../components/ui/filter-bar.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { Skeleton, TableSkeleton } from '../components/ui/skeleton.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import * as securityAdminService from '../services/securityAdminService.js';
import * as usersService from '../services/usersService.js';
import { extractApiError } from '../services/apiClient.js';
import { formatRelativeTime } from '../lib/dateFormat.js';
import { describeUserAgent } from '../lib/parseUserAgent.js';
import AccountSecurityDialog from '../components/security-admin/AccountSecurityDialog.jsx';
import ReasonPromptDialog from '../components/security-admin/ReasonPromptDialog.jsx';
import ProtectedAccountBadge from '../components/security-admin/ProtectedAccountBadge.jsx';
import SecurityEventsSection from '../components/security-admin/SecurityEventsSection.jsx';
import SecurityAlertsSection from '../components/security-admin/SecurityAlertsSection.jsx';

const PAGE_SIZE = 20;
const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

function StatCard({ icon: Icon, label, value, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'bg-accent/60 text-foreground',
    danger: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={18} aria-hidden="true" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * FET-20 — Security Administration, checkpoint 1: Security dashboard,
 * Active sessions, Account security.
 *
 * Backed entirely by the real `modules/security-admin` backend
 * (`GET /security-admin/dashboard`, `GET /security-admin/sessions`,
 * `DELETE /security-admin/sessions/:id`,
 * `GET /security-admin/accounts/:userId/security`,
 * `POST /security-admin/accounts/:userId/unlock` — see
 * `server/src/modules/security-admin/README.md`). Every figure and
 * row here is a real query result; nothing is fabricated. Read
 * access mirrors `AUDIT_READ` (`SECURITY_ADMIN_READ_ROLES` — the
 * route this page is mounted on in `App.jsx`); the two mutating
 * actions (revoke session, unlock account) are additionally gated
 * live against `usePermissions().has('system:admin')` so the buttons
 * only render for a caller who actually holds `SYSTEM_ADMIN` — a
 * DIRECTOR/ADMIN can view everything on this page but manages
 * neither action, matching the backend's own read/write split.
 *
 * Checkpoint 2 (this update) adds a second tab — "Events & alerts" —
 * covering Security events, Authentication events, Protected-account
 * indicators, and Security alerts, backed by the same already-built
 * `GET /security-admin/events` and `GET /security-admin/alerts`
 * (`SecurityEventsSection.jsx` / `SecurityAlertsSection.jsx`) rather
 * than a second route, as flagged in checkpoint 1's own notes.
 */
export default function SecurityAdminPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { has } = usePermissions();
  const canRevoke = has('system:admin');
  const [activeTab, setActiveTab] = useState('overview');

  // --- Security dashboard ---
  const [dashboard, setDashboard] = useState(null);
  const [dashboardState, setDashboardState] = useState('loading');
  const [dashboardError, setDashboardError] = useState('');

  const loadDashboard = async () => {
    setDashboardState('loading');
    try {
      const data = await securityAdminService.getSecurityDashboard();
      setDashboard(data);
      setDashboardState('ready');
    } catch (err) {
      setDashboardError(extractApiError(err).message);
      setDashboardState('error');
    }
  };

  // --- Active sessions ---
  const [sessions, setSessions] = useState([]);
  const [sessionsPagination, setSessionsPagination] = useState(null);
  const [sessionsState, setSessionsState] = useState('loading');
  const [sessionsError, setSessionsError] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionPage, setSessionPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState(null); // session object

  const loadSessions = useCallback(async () => {
    setSessionsState('loading');
    try {
      const { items, pagination } = await securityAdminService.listSessions({
        search: sessionSearch.trim() || undefined,
        page: sessionPage,
        limit: PAGE_SIZE,
      });
      setSessions(items);
      setSessionsPagination(pagination);
      setSessionsState('ready');
    } catch (err) {
      setSessionsError(extractApiError(err).message);
      setSessionsState('error');
    }
  }, [sessionSearch, sessionPage]);

  // --- Account security lookup ---
  const [accountQuery, setAccountQuery] = useState('');
  const [accountResults, setAccountResults] = useState([]);
  const [accountSearching, setAccountSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const searchAccounts = async (query) => {
    setAccountQuery(query);
    if (query.trim().length < 2) {
      setAccountResults([]);
      return;
    }
    setAccountSearching(true);
    try {
      const { items } = await usersService.listUsers({ search: query.trim(), limit: 10 });
      setAccountResults(items);
    } catch {
      setAccountResults([]);
    } finally {
      setAccountSearching(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Any search change re-queries from page 1.
  useEffect(() => {
    setSessionPage(1);
  }, [sessionSearch]);

  const handleRevoke = async (reason) => {
    await securityAdminService.revokeSession(revokeTarget.id, reason);
    toast({ title: t('security.sessionRevoked', 'Session revoked.'), variant: 'success' });
    await loadSessions();
    await loadDashboard();
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('security.title', 'Security Administration') },
        ]}
        title={t('security.title', 'Security Administration')}
        description={t('security.subtitle', 'System-wide security posture: sessions, account lockouts, and authentication activity.')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadDashboard();
              loadSessions();
            }}
          >
            <RotateCw size={14} /> {t('common.refresh', 'Refresh')}
          </Button>
        }
      />

      <TabList
        tabs={[
          { value: 'overview', label: t('common.overview', 'Overview'), icon: ShieldCheck },
          { value: 'events', label: t('security.tabs.events', 'Events & alerts'), icon: Activity },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'events' ? (
        <>
          <SecurityAlertsSection onSelectUser={setSelectedUserId} />
          <SecurityEventsSection onSelectUser={setSelectedUserId} />
        </>
      ) : (
        <>
      {/* Security dashboard */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Security dashboard</h2>
        {dashboardState === 'loading' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : dashboardState === 'error' ? (
          <ErrorState description={dashboardError} onRetry={loadDashboard} />
        ) : dashboard ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total accounts" value={dashboard.totals.users} />
            <StatCard icon={ShieldCheck} label="Protected accounts" value={dashboard.totals.protectedAccounts} tone="warning" />
            <StatCard icon={Activity} label="Active sessions" value={dashboard.sessions.activeSessions} />
            <StatCard
              icon={AlertTriangle}
              label="Locked accounts now"
              value={dashboard.accountSecurity.lockedAccountsNow}
              tone={dashboard.accountSecurity.lockedAccountsNow > 0 ? 'danger' : 'success'}
            />
            <StatCard label="Locked in last 24h" value={dashboard.accountSecurity.accountsLockedLast24h} icon={AlertTriangle} tone="neutral" />
            <StatCard label="Logins succeeded (24h)" value={dashboard.authenticationLast24h.loginSuccess} icon={Activity} tone="success" />
            <StatCard label="Logins failed (24h)" value={dashboard.authenticationLast24h.loginFailed} icon={AlertTriangle} tone="warning" />
            <StatCard
              label="Refresh-token reuse (7d)"
              value={dashboard.riskSignalsLast7d.refreshTokenReuseDetected}
              icon={AlertTriangle}
              tone={dashboard.riskSignalsLast7d.refreshTokenReuseDetected > 0 ? 'danger' : 'success'}
            />
            {Object.entries(dashboard.totals.usersByStatus).map(([status, count]) => (
              <StatCard key={status} label={`Accounts — ${status}`} value={count} icon={Users} />
            ))}
          </div>
        ) : null}
      </section>

      {/* Active sessions */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Active sessions</h2>
        <FilterBar
          searchValue={sessionSearch}
          onSearchChange={setSessionSearch}
          searchPlaceholder="Search by account name, email, or username…"
        />

        {sessionsState === 'loading' ? (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead hideBelow="md">Device</TableHead>
                  <TableHead hideBelow="lg">IP address</TableHead>
                  <TableHead hideBelow="sm">Signed in</TableHead>
                  <TableHead hideBelow="lg">Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton rows={5} columns={6} />
              </TableBody>
            </Table>
          </TableContainer>
        ) : sessionsState === 'error' ? (
          <ErrorState description={sessionsError} onRetry={loadSessions} />
        ) : sessions.length === 0 ? (
          <EmptyState icon={Activity} title="No active sessions" description="No sessions currently match this search." />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead hideBelow="md">Device</TableHead>
                    <TableHead hideBelow="lg">IP address</TableHead>
                    <TableHead hideBelow="sm">Signed in</TableHead>
                    <TableHead hideBelow="lg">Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                          onClick={() => setSelectedUserId(session.user?.id)}
                        >
                          {session.user?.name || 'Unknown user'}
                        </button>
                        <p className="text-xs text-muted-foreground">{session.user?.email}</p>
                        <ProtectedAccountBadge isProtected={session.user?.isProtected} className="mt-1" />
                      </TableCell>
                      <TableCell hideBelow="md" className="text-muted-foreground">{describeUserAgent(session.userAgent)}</TableCell>
                      <TableCell hideBelow="lg" className="text-muted-foreground">{session.ipAddress || '—'}</TableCell>
                      <TableCell hideBelow="sm" className="text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(session.createdAt)}
                      </TableCell>
                      <TableCell hideBelow="lg" className="text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(session.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedUserId(session.user?.id)}>
                            Security
                          </Button>
                          {canRevoke ? (
                            <Button type="button" variant="destructive" size="sm" onClick={() => setRevokeTarget(session)}>
                              <LogOut size={14} /> Revoke
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {sessionsPagination?.totalPages > 1 ? (
              <Pagination
                page={sessionsPagination.page || sessionPage}
                totalPages={sessionsPagination.totalPages}
                onPageChange={setSessionPage}
                className="mt-4"
              />
            ) : null}
          </>
        )}
      </section>

      {/* Account security lookup */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Account security</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Look up any account to view its lockout state, failed-login count, and recent security activity.
        </p>
        <div className="relative max-w-md">
          <input
            type="text"
            value={accountQuery}
            onChange={(e) => searchAccounts(e.target.value)}
            placeholder="Search by name, email, or username…"
            className={`${selectClass} w-full`}
          />
          {accountSearching ? <p className="mt-1 text-xs text-muted-foreground">Searching…</p> : null}
          {accountResults.length > 0 ? (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border overflow-hidden">
              {accountResults.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                    onClick={() => {
                      setSelectedUserId(u.id);
                      setAccountResults([]);
                      setAccountQuery('');
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {u.name} <span className="text-muted-foreground">· {u.email}</span>
                      <ProtectedAccountBadge isProtected={u.isProtected} />
                    </span>
                    <Badge variant="neutral">{u.role}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
        </>
      )}

      <AccountSecurityDialog
        open={Boolean(selectedUserId)}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
        userId={selectedUserId}
        onChanged={() => {
          loadDashboard();
          loadSessions();
        }}
      />

      <ReasonPromptDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this session?"
        description={
          revokeTarget
            ? `This immediately signs out ${revokeTarget.user?.name || 'this account'} on that device. Recorded as a security event and an administrative-action audit log entry.`
            : ''
        }
        confirmLabel="Revoke session"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
