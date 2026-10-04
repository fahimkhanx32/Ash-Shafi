import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, Users } from 'lucide-react';

import * as patientsService from '../services/patientsService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { PATIENT_WRITE_ROLES } from '../constants/roles.js';
import { PATIENT_GENDERS, PATIENT_STATUSES, labelFor, patientStatusVariant } from '../constants/patients.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
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
import RegisterPatientDialog from '../components/patients/RegisterPatientDialog.jsx';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-06 — Patient list: `GET /patients` (`PATIENTS_READ`). Search,
 * status/gender filters, sort, and pagination are all sent to the
 * backend query — nothing is filtered client-side (master prompt
 * §64), matching the exact pattern `StaffListPage` (FET-05) already
 * established.
 */
export default function PatientsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRegister = PATIENT_WRITE_ROLES.includes(user?.role);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [patientStatus, setPatientStatus] = useState('');
  const [gender, setGender] = useState('');
  const [page, setPage] = useState(1);

  const [registerOpen, setRegisterOpen] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await patientsService.listPatients({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(patientStatus ? { patientStatus } : {}),
        ...(gender ? { gender } : {}),
      });
      setItems(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, search, patientStatus, gender]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, patientStatus, gender]);

  const openPatient = (profile) => navigate(`/dashboard/patients/${profile.id || profile._id}`);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.patients') }]}
        title={t('patients.list.title')}
        description={t('patients.list.description')}
        actions={
          canRegister ? (
            <Button size="sm" onClick={() => setRegisterOpen(true)}>
              <UserPlus size={15} /> {t('patients.list.registerPatient')}
            </Button>
          ) : null
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('patients.list.searchPlaceholder')}
      >
        <select
          className={selectClass}
          value={patientStatus}
          onChange={(e) => setPatientStatus(e.target.value)}
          aria-label={t('patients.list.filterByStatus')}
        >
          <option value="">{t('patients.list.allStatuses')}</option>
          {PATIENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {labelFor(value, t)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          aria-label={t('patients.list.filterByGender')}
        >
          <option value="">{t('patients.list.allGenders')}</option>
          {PATIENT_GENDERS.map((value) => (
            <option key={value} value={value}>
              {labelFor(value, t)}
            </option>
          ))}
        </select>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('patients.list.colPatient')}</TableHead>
                <TableHead hideBelow="md">{t('patients.list.colPatientId')}</TableHead>
                <TableHead hideBelow="lg">{t('patients.list.colGender')}</TableHead>
                <TableHead hideBelow="lg">{t('patients.list.colAge')}</TableHead>
                <TableHead hideBelow="sm">{t('patients.list.colPhone')}</TableHead>
                <TableHead>{t('patients.list.colStatus')}</TableHead>
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
          title={t('patients.list.noneFoundTitle')}
          description={t('patients.list.noneFoundDescription')}
          action={
            canRegister ? (
              <span
                role="button"
                tabIndex={0}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                onClick={() => setRegisterOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setRegisterOpen(true)}
              >
                <UserPlus size={15} /> {t('patients.list.registerPatient')}
              </span>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — mobile must not just be a
              desktop table squeezed onto a narrow screen. Below `lg`,
              patients render as comfortable one-handed cards instead
              of a horizontally-scrolling table. */}
          <div className="grid gap-3 lg:hidden">
            {items.map((profile) => (
              <button
                key={profile.id || profile._id}
                type="button"
                onClick={() => openPatient(profile)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {profile.fullName || `${profile.firstName} ${profile.lastName}`}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{profile.patientId}</p>
                  </div>
                  <Badge variant={patientStatusVariant(profile.patientStatus)}>
                    {labelFor(profile.patientStatus, t)}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('patients.list.colGender')}
                    </span>
                    {labelFor(profile.gender, t)}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('patients.list.colAge')}
                    </span>
                    {profile.age ?? '—'}
                  </div>
                  <div className="truncate">
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('patients.list.colPhone')}
                    </span>
                    {profile.phone || '—'}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('patients.list.colPatient')}</TableHead>
                    <TableHead hideBelow="md">{t('patients.list.colPatientId')}</TableHead>
                    <TableHead hideBelow="lg">{t('patients.list.colGender')}</TableHead>
                    <TableHead hideBelow="lg">{t('patients.list.colAge')}</TableHead>
                    <TableHead hideBelow="sm">{t('patients.list.colPhone')}</TableHead>
                    <TableHead>{t('patients.list.colStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((profile) => (
                    <TableRow
                      key={profile.id || profile._id}
                      className="cursor-pointer"
                      onClick={() => openPatient(profile)}
                    >
                      <TableCell>
                        <div className="font-medium">{profile.fullName || `${profile.firstName} ${profile.lastName}`}</div>
                      </TableCell>
                      <TableCell hideBelow="md" className="font-mono text-xs">{profile.patientId}</TableCell>
                      <TableCell hideBelow="lg">{labelFor(profile.gender, t)}</TableCell>
                      <TableCell hideBelow="lg">{profile.age ?? '—'}</TableCell>
                      <TableCell hideBelow="sm">{profile.phone || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={patientStatusVariant(profile.patientStatus)}>
                          {labelFor(profile.patientStatus, t)}
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

      <RegisterPatientDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onCreated={(created) => navigate(`/dashboard/patients/${created.id || created._id}`)}
      />
    </div>
  );
}
