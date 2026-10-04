import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as investigationsService from '../services/investigationsService.js';
import { extractApiError } from '../services/apiClient.js';
import { usePatientNames } from '../hooks/usePatientNames.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { INVESTIGATIONS_WRITE_ROLES } from '../constants/roles.js';
import {
  INVESTIGATION_STATUSES,
  INVESTIGATION_CATEGORIES,
  investigationCategoryLabel,
  investigationStatusLabel,
  investigationStatusVariant,
  investigationPriorityVariant,
  investigationPriorityLabel,
} from '../constants/investigations.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
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
import InvestigationDetailDialog from '../components/reports/InvestigationDetailDialog.jsx';
import { formatDate } from '../lib/dateFormat.js';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-11 — cross-patient investigations roster. Unlike prescriptions
 * (FET-10 — no cross-patient list endpoint exists, per
 * `navConfig.js`'s note), `GET /investigations` genuinely is a real
 * roster endpoint (`INVESTIGATIONS_READ`, `investigation.routes.js`),
 * so this page exists for the same reason `MedicinesPage` does: a
 * real backend capability with no frontend caller yet. Ordering a
 * *new* investigation still only happens in a specific patient's
 * context (`InvestigationsTab` inside `PatientWorkspacePage`) — this
 * page is for finding and reviewing investigations across patients
 * (e.g. "what's still ORDERED/SCHEDULED today"), not for creating
 * one, since `OrderInvestigationDialog` requires a `patientProfileId`
 * that a roster row already has but this page's own toolbar doesn't.
 *
 * The roster endpoint doesn't populate `patientProfile` (confirmed by
 * reading `investigation.service.js#listInvestigations` directly), so
 * patient names are resolved separately via `usePatientNames`.
 *
 * FET-17 — fully localized. Also fixed a raw-date bypass on the
 * "Ordered" column (`toLocaleDateString()` → shared `formatDate`).
 */
export default function InvestigationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = INVESTIGATIONS_WRITE_ROLES.includes(user?.role);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await investigationsService.listInvestigations({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
      });
      setItems(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, search, status, category]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category]);

  const patientNames = usePatientNames(items.map((item) => item.patientProfile));

  const patientLabel = (id) => {
    const entry = patientNames[id];
    if (!entry || entry === 'loading') return t('common.loading');
    if (entry === 'error') return '—';
    return entry.fullName || entry.patientId || '—';
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.investigations') }]}
        title={t('nav.investigations')}
        description={t('clinical.investigation.rosterDescription')}
        actions={
          canWrite ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/dashboard/lab-requisitions/new')}
              className="gap-1.5 text-xs font-semibold"
            >
              <FlaskConical size={14} />
              <span>New Lab Requisition</span>
            </Button>
          ) : null
        }
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder={t('clinical.investigation.searchPlaceholder')}>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('clinical.investigation.filterByStatus')}
        >
          <option value="">{t('clinical.investigation.allStatuses')}</option>
          {INVESTIGATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {investigationStatusLabel(value, t)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={t('clinical.investigation.filterByCategory')}
        >
          <option value="">{t('clinical.investigation.allCategories')}</option>
          {INVESTIGATION_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {investigationCategoryLabel(value, t)}
            </option>
          ))}
        </select>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clinical.investigation.ordered')}</TableHead>
                <TableHead>{t('clinical.fields.patient', 'Patient')}</TableHead>
                <TableHead>{t('nav.investigations')}</TableHead>
                <TableHead>{t('clinical.investigation.category')}</TableHead>
                <TableHead>{t('clinical.investigation.priority')}</TableHead>
                <TableHead>{t('clinical.fields.status')}</TableHead>
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
          icon={FlaskConical}
          title={t('clinical.investigation.noneFoundTitle')}
          description={t('clinical.investigation.noneFoundDescription')}
        />
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {items.map((investigation) => (
              <button
                key={investigation.id}
                type="button"
                onClick={() => setDetailId(investigation.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{investigation.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {patientLabel(investigation.patientProfile)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={investigationStatusVariant(investigation.status)}>
                      {investigationStatusLabel(investigation.status, t)}
                    </Badge>
                    <Badge variant={investigationPriorityVariant(investigation.priority)}>
                      {investigationPriorityLabel(investigation.priority, t)}
                    </Badge>
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
                    <TableHead>{t('clinical.investigation.ordered')}</TableHead>
                    <TableHead>{t('clinical.fields.patient', 'Patient')}</TableHead>
                    <TableHead>{t('nav.investigations')}</TableHead>
                    <TableHead>{t('clinical.investigation.category')}</TableHead>
                    <TableHead>{t('clinical.investigation.priority')}</TableHead>
                    <TableHead>{t('clinical.fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((investigation) => (
                    <TableRow
                      key={investigation.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(investigation.id)}
                    >
                      <TableCell>{formatDate(investigation.orderedDate)}</TableCell>
                      <TableCell
                        className="text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/patients/${investigation.patientProfile}?tab=investigations`);
                        }}
                      >
                        {patientLabel(investigation.patientProfile)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{investigation.name}</TableCell>
                      <TableCell>{investigationCategoryLabel(investigation.category, t)}</TableCell>
                      <TableCell>
                        <Badge variant={investigationPriorityVariant(investigation.priority)}>
                          {investigationPriorityLabel(investigation.priority, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={investigationStatusVariant(investigation.status)}>
                          {investigationStatusLabel(investigation.status, t)}
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

      <InvestigationDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        investigationId={detailId}
        canWrite={canWrite}
        onChanged={load}
      />
    </div>
  );
}
