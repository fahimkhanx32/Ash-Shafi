import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Stethoscope, UserCog } from 'lucide-react';

import * as staffService from '../services/staffService.js';
import { extractApiError } from '../services/apiClient.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { FilterBar } from '../components/ui/filter-bar.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { TableSkeleton } from '../components/ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.jsx';
import AddStaffDialog from '../components/admin/AddStaffDialog.jsx';
import AttachStaffProfileDialog from '../components/admin/AttachStaffProfileDialog.jsx';
import { STAFF_DESIGNATIONS, STAFF_EMPLOYMENT_STATUSES, labelFor } from '../constants/staff.js';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

const statusVariant = (status) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ON_LEAVE') return 'warning';
  if (status === 'SUSPENDED' || status === 'TERMINATED') return 'destructive';
  return 'neutral';
};

/**
 * FET-05 — Staff list. Every row is a real `StaffProfile` from
 * `GET /staff` (`users:read`), with its populated `user` account
 * summary (name/email/role/status). Search/designation/employment-
 * status filters and pagination are all sent to the backend query —
 * nothing is filtered client-side (master prompt §64).
 */
export default function StaffListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [designation, setDesignation] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);

  // Recovery-UI: users whose account exists but whose StaffProfile
  // attach step never completed (see AttachStaffProfileDialog).
  // Loaded independently of the main paginated list/filters — this is
  // a small, separate cleanup queue, not part of the staff table
  // itself.
  const [orphanedUsers, setOrphanedUsers] = useState([]);
  const [attachTarget, setAttachTarget] = useState(null);

  const loadOrphanedUsers = useCallback(async () => {
    try {
      const users = await staffService.listOrphanedStaffUsers();
      setOrphanedUsers(users);
    } catch {
      // Non-critical — the main staff list still works if this
      // fails (e.g. the viewer lacks USERS_READ for some reason).
      // Silently skip the banner rather than blocking the page.
    }
  }, []);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await staffService.listStaffProfiles({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(designation ? { designation } : {}),
        ...(employmentStatus ? { employmentStatus } : {}),
      });
      setItems(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, search, designation, employmentStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadOrphanedUsers();
  }, [loadOrphanedUsers]);

  // Any filter change re-queries from page 1.
  useEffect(() => {
    setPage(1);
  }, [search, designation, employmentStatus]);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' }, { label: t('staff.title', 'Staff') }]}
        title={t('staff.pageTitle', 'Staff & doctors')}
        description={t('staff.pageDescription', 'Every login account and HR profile on staff — search, filter, and manage employment status here.')}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus size={15} /> {t('staff.addStaff', 'Add staff or doctor')}
          </Button>
        }
      />

      {orphanedUsers.length > 0 ? (
        <Alert className="mt-4 mb-4">
          <UserCog size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <AlertDescription className="w-full">
            <p className="font-medium">
              {t('staff.orphanedUsersBanner', {
                count: orphanedUsers.length,
                defaultValue: '{{count}} account is missing its staff profile',
                defaultValue_other: '{{count}} accounts are missing their staff profile',
              })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('staff.orphanedUsersBannerHint', "Created but never finished — probably because the last step failed partway through.")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {orphanedUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setAttachTarget(user)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent/60 transition-colors"
                >
                  {user.name}
                  <span className="text-muted-foreground">· {t('staff.finishSetup', 'Finish setup')}</span>
                </button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('staff.searchPlaceholder', 'Search by name, email, or employee ID…')}
      >
        <select
          className={selectClass}
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          aria-label={t('staff.filterByDesignation', 'Filter by designation')}
        >
          <option value="">{t('staff.allDesignations', 'All designations')}</option>
          {STAFF_DESIGNATIONS.map((value) => (
            <option key={value} value={value}>
              {labelFor(value)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={employmentStatus}
          onChange={(e) => setEmploymentStatus(e.target.value)}
          aria-label={t('staff.filterByEmploymentStatus', 'Filter by employment status')}
        >
          <option value="">{t('staff.allEmploymentStatuses', 'All employment statuses')}</option>
          {STAFF_EMPLOYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {labelFor(value)}
            </option>
          ))}
        </select>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('staff.colName', 'Name')}</TableHead>
                <TableHead hideBelow="sm">{t('staff.colDesignation', 'Designation')}</TableHead>
                <TableHead hideBelow="lg">{t('staff.colDepartment', 'Department')}</TableHead>
                <TableHead hideBelow="md">{t('staff.colAccountRole', 'Account role')}</TableHead>
                <TableHead hideBelow="lg">{t('staff.colEmploymentStatus', 'Employment status')}</TableHead>
                <TableHead>{t('staff.colAccountStatus', 'Account status')}</TableHead>
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
          icon={Users}
          title={t('staff.emptyTitle', 'No staff found')}
          description={t('staff.emptyDescription', 'No staff profiles match these filters yet.')}
          action={
            <span
              role="button"
              tabIndex={0}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              onClick={() => setAddOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && setAddOpen(true)}
            >
              <UserPlus size={15} /> {t('staff.addStaff', 'Add staff or doctor')}
            </span>
          }
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards on mobile instead of a
              cramped, horizontally-scrolling table. Same convention
              `PatientsListPage` (FET-06) established. */}
          <div className="grid gap-3 lg:hidden">
            {items.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => navigate(`/dashboard/staff/${profile.id}`)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {profile.designation === 'DOCTOR' ? (
                      <Stethoscope size={15} className="shrink-0 text-muted-foreground" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{profile.user?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profile.user?.email} · {profile.employeeId}
                      </p>
                    </div>
                  </div>
                  <Badge variant={profile.user?.status === 'ACTIVE' ? 'success' : 'destructive'}>
                    {labelFor(profile.user?.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="primary">{labelFor(profile.user?.role)}</Badge>
                  <Badge variant={statusVariant(profile.employmentStatus)}>
                    {labelFor(profile.employmentStatus)}
                  </Badge>
                  <span className="text-muted-foreground">
                    {profile.designation === 'OTHER'
                      ? profile.customDesignationLabel || labelFor('OTHER')
                      : labelFor(profile.designation)}
                    {profile.department ? ` · ${profile.department}` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('staff.colName', 'Name')}</TableHead>
                    <TableHead hideBelow="sm">{t('staff.colDesignation', 'Designation')}</TableHead>
                    <TableHead hideBelow="lg">{t('staff.colDepartment', 'Department')}</TableHead>
                    <TableHead hideBelow="md">{t('staff.colAccountRole', 'Account role')}</TableHead>
                    <TableHead hideBelow="lg">{t('staff.colEmploymentStatus', 'Employment status')}</TableHead>
                    <TableHead>{t('staff.colAccountStatus', 'Account status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((profile) => (
                    <TableRow
                      key={profile.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/staff/${profile.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {profile.designation === 'DOCTOR' ? (
                            <Stethoscope size={15} className="text-muted-foreground shrink-0" />
                          ) : null}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{profile.user?.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {profile.user?.email} · {profile.employeeId}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell hideBelow="sm">
                        {profile.designation === 'OTHER'
                          ? profile.customDesignationLabel || labelFor('OTHER')
                          : labelFor(profile.designation)}
                      </TableCell>
                      <TableCell hideBelow="lg">{profile.department || '—'}</TableCell>
                      <TableCell hideBelow="md">
                        <Badge variant="primary">{labelFor(profile.user?.role)}</Badge>
                      </TableCell>
                      <TableCell hideBelow="lg">
                        <Badge variant={statusVariant(profile.employmentStatus)}>
                          {labelFor(profile.employmentStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.user?.status === 'ACTIVE' ? 'success' : 'destructive'}>
                          {labelFor(profile.user?.status)}
                        </Badge>
                      </TableCell>
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

      <AddStaffDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setPage(1);
          load();
          loadOrphanedUsers();
        }}
        onOrphanedUserCreated={loadOrphanedUsers}
      />

      <AttachStaffProfileDialog
        open={Boolean(attachTarget)}
        onOpenChange={(next) => {
          if (!next) setAttachTarget(null);
        }}
        user={attachTarget}
        onAttached={() => {
          setPage(1);
          load();
          loadOrphanedUsers();
        }}
      />
    </div>
  );
}
