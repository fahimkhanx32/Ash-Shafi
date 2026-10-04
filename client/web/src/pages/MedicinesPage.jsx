import { useCallback, useEffect, useState } from 'react';
import { Plus, Pill } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as medicinesService from '../services/medicinesService.js';
import { extractApiError } from '../services/apiClient.js';
import {
  DOSAGE_FORMS,
  ROUTES,
  VERIFICATION_STATUSES,
  dosageFormLabel,
  routeLabel,
  verificationStatusLabel,
  verificationStatusVariant,
} from '../constants/prescriptions.js';
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
import MedicineFormDialog from '../components/medicines/MedicineFormDialog.jsx';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-10 — "Medicine database", "Search", "Filters", "Medicine
 * details". The catalog-management screen `services/medicinesService.js`
 * (BET-11) was built for but had no caller — `createMedicine`/
 * `updateMedicine`/`deactivateMedicine`/`reactivateMedicine` all
 * existed with zero UI wired to them. Search/filter/pagination all go
 * to the real backend query (`GET /medicines`), matching the exact
 * pattern `PatientsListPage`/`StaffListPage` already established —
 * nothing is filtered client-side.
 *
 * This is distinct from `PrescriptionItemsEditor.jsx`'s inline
 * `MedicineSearchField` (a doctor picking a medicine while writing a
 * prescription) — that's read-only, active-only, and lives inside the
 * patient workspace. This page is the catalog's own management
 * surface: add a new reference entry, correct one, retire one.
 *
 * FET-17 — fully localized.
 */
export default function MedicinesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [dosageForm, setDosageForm] = useState('');
  const [route, setRoute] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await medicinesService.listMedicines({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(dosageForm ? { dosageForm } : {}),
        ...(route ? { route } : {}),
        ...(verificationStatus ? { verificationStatus } : {}),
        ...(showInactive ? {} : { isActive: true }),
      });
      setItems(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, search, dosageForm, route, verificationStatus, showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, dosageForm, route, verificationStatus, showInactive]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openMedicine = (medicine) => {
    setEditing(medicine);
    setFormOpen(true);
  };

  const newButton = (
    <Button size="sm" onClick={openCreate}>
      <Plus size={15} /> {t('clinical.medicine.addMedicine')}
    </Button>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.medicines') }]}
        title={t('nav.medicines')}
        description={t('clinical.medicine.catalogDescription')}
        actions={newButton}
      />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder={t('clinical.medicine.searchPlaceholder')}>
        <select
          className={selectClass}
          value={dosageForm}
          onChange={(e) => setDosageForm(e.target.value)}
          aria-label={t('clinical.medicine.filterByDosageForm')}
        >
          <option value="">{t('clinical.medicine.allDosageForms')}</option>
          {DOSAGE_FORMS.map((value) => (
            <option key={value} value={value}>
              {dosageFormLabel(value, t)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          aria-label={t('clinical.medicine.filterByRoute')}
        >
          <option value="">{t('clinical.medicine.allRoutes')}</option>
          {ROUTES.map((value) => (
            <option key={value} value={value}>
              {routeLabel(value, t)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={verificationStatus}
          onChange={(e) => setVerificationStatus(e.target.value)}
          aria-label={t('clinical.medicine.filterByVerification')}
        >
          <option value="">{t('clinical.medicine.allVerificationStatuses')}</option>
          {VERIFICATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {verificationStatusLabel(value, t)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 h-10 px-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-primary"
          />
          {t('clinical.medicine.showInactive')}
        </label>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clinical.medicine.genericName')}</TableHead>
                <TableHead>{t('clinical.medicine.brand')}</TableHead>
                <TableHead>{t('clinical.prescription.strength')}</TableHead>
                <TableHead>{t('clinical.medicine.dosageFormLabel')}</TableHead>
                <TableHead>{t('clinical.medicine.routeLabel')}</TableHead>
                <TableHead>{t('clinical.medicine.verificationStatusLabel')}</TableHead>
                <TableHead>{t('clinical.fields.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={7} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={t('clinical.medicine.noneFoundTitle')}
          description={t('clinical.medicine.noneFoundDescription')}
          action={newButton}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards below `lg`, matching the
              convention `PatientsListPage`/`DepartmentsPage` already use. */}
          <div className="grid gap-3 lg:hidden">
            {items.map((medicine) => (
              <button
                key={medicine.id}
                type="button"
                onClick={() => openMedicine(medicine)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{medicine.genericName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[medicine.brandName, [medicine.strength, medicine.unit].filter(Boolean).join(' ')]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={verificationStatusVariant(medicine.verificationStatus)}>
                      {verificationStatusLabel(medicine.verificationStatus, t)}
                    </Badge>
                    {!medicine.isActive ? <Badge variant="neutral">{t('clinical.medicine.inactive')}</Badge> : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('clinical.medicine.dosageFormLabel')}
                    </span>
                    {dosageFormLabel(medicine.dosageForm, t)}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('clinical.medicine.routeLabel')}
                    </span>
                    {routeLabel(medicine.route, t)}
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
                    <TableHead>{t('clinical.medicine.genericName')}</TableHead>
                    <TableHead>{t('clinical.medicine.brand')}</TableHead>
                    <TableHead>{t('clinical.prescription.strength')}</TableHead>
                    <TableHead>{t('clinical.medicine.dosageFormLabel')}</TableHead>
                    <TableHead>{t('clinical.medicine.routeLabel')}</TableHead>
                    <TableHead>{t('clinical.medicine.verificationStatusLabel')}</TableHead>
                    <TableHead>{t('clinical.fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((medicine) => (
                    <TableRow key={medicine.id} className="cursor-pointer" onClick={() => openMedicine(medicine)}>
                      <TableCell>
                        <div className="font-medium">{medicine.genericName}</div>
                      </TableCell>
                      <TableCell>{medicine.brandName || '—'}</TableCell>
                      <TableCell>
                        {[medicine.strength, medicine.unit].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell>{dosageFormLabel(medicine.dosageForm, t)}</TableCell>
                      <TableCell>{routeLabel(medicine.route, t)}</TableCell>
                      <TableCell>
                        <Badge variant={verificationStatusVariant(medicine.verificationStatus)}>
                          {verificationStatusLabel(medicine.verificationStatus, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={medicine.isActive ? 'success' : 'neutral'}>
                          {medicine.isActive ? t('clinical.medicine.active') : t('clinical.medicine.inactive')}
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

      <MedicineFormDialog open={formOpen} onOpenChange={setFormOpen} medicine={editing} onSaved={load} />
    </div>
  );
}
