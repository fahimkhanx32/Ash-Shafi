import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as reportsService from '../services/reportsService.js';
import { extractApiError } from '../services/apiClient.js';
import { usePatientNames } from '../hooks/usePatientNames.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { REPORTS_WRITE_ROLES, REPORTS_VERIFY_ROLES } from '../constants/roles.js';
import {
  REPORT_STATUSES,
  REPORT_TYPES,
  reportStatusLabel,
  reportStatusVariant,
  reportTypeLabel,
} from '../constants/reports.js';
import { PageHeader } from '../components/ui/page-header.jsx';
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
import ReportDetailDialog from '../components/reports/ReportDetailDialog.jsx';
import ReportDropzone from '../components/reports/ReportDropzone.jsx';
import StaffUploadReportDialog from '../components/reports/StaffUploadReportDialog.jsx';
import { formatDate } from '../lib/dateFormat.js';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-11 — cross-patient medical reports roster, the counterpart to
 * `InvestigationsPage.jsx`. Backed by the real `GET /reports`
 * (`REPORTS_READ`, `report.routes.js`) — same reasoning as that page
 * for why this exists as a standalone screen while prescriptions
 * (FET-10) deliberately doesn't get one: an actual roster endpoint
 * exists here, prescriptions has none. Uploading a report still
 * requires a specific patient context (`UploadReportDialog` needs a
 * `patientProfileId`), so that action lives only in the Reports tab
 * inside `PatientWorkspacePage` — this page is for finding/reviewing/
 * verifying reports across patients (e.g. "what's in NEEDS_REVIEW
 * today").
 *
 * `patientProfile` isn't populated on the list endpoint (confirmed by
 * reading `report.service.js#listReports` directly), so names come
 * from `usePatientNames`, same as the investigations roster.
 *
 * FET-17 — fully localized. Also fixed a raw-date bypass on the
 * "Uploaded" column (`toLocaleDateString()` → shared `formatDate`).
 */
export default function ReportsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = REPORTS_WRITE_ROLES.includes(user?.role);
  const canVerify = REPORTS_VERIFY_ROLES.includes(user?.role);
  const canAccessIntake = canVerify;

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [reportType, setReportType] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await reportsService.listReports({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
        ...(reportType ? { reportType } : {}),
      });
      setItems(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, search, status, reportType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status, reportType]);

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
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.reports') }]}
        title={t('nav.reports')}
        description={t('clinical.report.rosterDescription')}
      />

      {canWrite ? (
        <div className="mb-4">
          <ReportDropzone
            onFile={(file) => {
              setDroppedFile(file);
              setUploadOpen(true);
            }}
            title="patient document"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx"
            formatsLabel="PDF, JPG, PNG, WEBP, DOCX, XLSX"
            privacyNote="You'll choose the patient next · Access follows your clinic permissions"
          />
        </div>
      ) : null}

      {canAccessIntake ? (
        <Link
          to="/dashboard/reports/intake"
          className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10 transition-colors"
        >
          <Inbox size={18} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-primary">{t('nav.reportIntake', 'Report Intake Inbox')}</p>
            <p className="text-muted-foreground text-xs">
              {t('clinical.intake.bannerDescription', 'Review patient-submitted reports and accept or reject them into the chart.')}
            </p>
          </div>
          <span className="text-primary text-xs font-medium shrink-0">{t('common.openArrow', 'Open →')}</span>
        </Link>
      ) : null}

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder={t('clinical.report.searchPlaceholder')}>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('clinical.investigation.filterByStatus')}
        >
          <option value="">{t('clinical.investigation.allStatuses')}</option>
          {REPORT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {reportStatusLabel(value, t)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          aria-label={t('clinical.report.filterByType')}
        >
          <option value="">{t('clinical.report.allTypes')}</option>
          {REPORT_TYPES.map((value) => (
            <option key={value} value={value}>
              {reportTypeLabel(value, t)}
            </option>
          ))}
        </select>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clinical.report.uploaded')}</TableHead>
                <TableHead>{t('clinical.fields.patient', 'Patient')}</TableHead>
                <TableHead>{t('clinical.report.titleColumn')}</TableHead>
                <TableHead>{t('clinical.report.type')}</TableHead>
                <TableHead>{t('clinical.fields.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={5} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState icon={FileText} title={t('clinical.report.noneFoundTitle')} description={t('clinical.report.noneFoundDescription')} />
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {items.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setDetailId(report.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{report.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {patientLabel(report.patientProfile)}
                    </p>
                  </div>
                  <Badge variant={reportStatusVariant(report.status)}>{reportStatusLabel(report.status, t)}</Badge>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('clinical.report.uploaded')}</TableHead>
                    <TableHead>{t('clinical.fields.patient', 'Patient')}</TableHead>
                    <TableHead>{t('clinical.report.titleColumn')}</TableHead>
                    <TableHead>{t('clinical.report.type')}</TableHead>
                    <TableHead>{t('clinical.fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((report) => (
                    <TableRow key={report.id} className="cursor-pointer" onClick={() => setDetailId(report.id)}>
                      <TableCell>{formatDate(report.uploadDate)}</TableCell>
                      <TableCell
                        className="text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/patients/${report.patientProfile}?tab=reports`);
                        }}
                      >
                        {patientLabel(report.patientProfile)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{report.title}</TableCell>
                      <TableCell>{reportTypeLabel(report.reportType, t)}</TableCell>
                      <TableCell>
                        <Badge variant={reportStatusVariant(report.status)}>{reportStatusLabel(report.status, t)}</Badge>
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

      <ReportDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        reportId={detailId}
        canWrite={canWrite}
        canVerify={canVerify}
        onChanged={load}
      />

      {canWrite && uploadOpen ? (
        <StaffUploadReportDialog
          open={uploadOpen}
          onOpenChange={(next) => {
            setUploadOpen(next);
            if (!next) setDroppedFile(null);
          }}
          initialFile={droppedFile}
          onUploaded={() => {
            setUploadOpen(false);
            setDroppedFile(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
