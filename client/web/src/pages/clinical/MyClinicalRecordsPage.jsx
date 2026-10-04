import { useEffect, useState, useMemo } from 'react';
import { HeartPulse, Baby, Pill, FlaskConical, FileText, FileCheck, Receipt, Upload, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '../../components/ui/page-header.jsx';
import GynecologyPanel from '../../components/clinical/GynecologyPanel.jsx';
import PregnancyPanel from '../../components/clinical/PregnancyPanel.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Button } from '../../components/ui/button.jsx';
import { EmptyState, ErrorState } from '../../components/ui/empty-state.jsx';
import { TableSkeleton } from '../../components/ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table.jsx';
import PrescriptionDetailDialog from '../../components/prescriptions/PrescriptionDetailDialog.jsx';
import InvestigationDetailDialog from '../../components/reports/InvestigationDetailDialog.jsx';
import ReportDetailDialog from '../../components/reports/ReportDetailDialog.jsx';
import LabRequisitionDetailDialog from '../../components/requisitions/LabRequisitionDetailDialog.jsx';
import PatientUploadReportDialog from '../../components/reports/PatientUploadReportDialog.jsx';
import ReportDropzone from '../../components/reports/ReportDropzone.jsx';
import ShareReportDialog from '../../components/reports/ShareReportDialog.jsx';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import * as investigationsService from '../../services/investigationsService.js';
import * as reportsService from '../../services/reportsService.js';
import * as labRequisitionsService from '../../services/labRequisitionsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { prescriptionStatusLabel, prescriptionStatusVariant } from '../../constants/prescriptions.js';
import {
  investigationCategoryLabel,
  investigationStatusLabel,
  investigationStatusVariant,
} from '../../constants/investigations.js';
import { reportStatusLabel, reportStatusVariant, reportTypeLabel, intakeStatusLabel, intakeStatusVariant } from '../../constants/reports.js';
import { formatDate } from '../../lib/dateFormat.js';

/**
 * FET-10 — "download prescriptions" in the patient portal (master
 * prompt §37/§86, and the rationale documented directly in
 * `prescription.routes.js`'s `authorizeReadOrSelf`). Read-only, same
 * as the Gynecology/Pregnancy tabs on this page: `GET /prescriptions/me`
 * already excludes any still-`DRAFT` prescription server-side (a
 * patient never sees an unfinished draft), and
 * `PrescriptionDetailDialog` with `canWrite={false}` already hides
 * every write action (edit/finalize/revise) — it still offers "A4 /
 * Print" for `FINALIZED`/`SUPERSEDED` prescriptions, which is exactly
 * the download path this tab exists for.
 *
 * FET-17 — fully localized.
 */
function MyPrescriptionsTab() {
  const { t } = useTranslation();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setState('loading');
    prescriptionsService
      .getMyPrescriptions()
      .then((data) => {
        setItems(data);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(load, []);

  if (state === 'loading') {
    return (
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clinical.fields.date')}</TableHead>
              <TableHead hideBelow="sm">{t('clinical.fields.provider')}</TableHead>
              <TableHead hideBelow="md">{t('clinical.prescription.diagnosisColumn')}</TableHead>
              <TableHead hideBelow="sm">{t('clinical.prescription.itemsColumn')}</TableHead>
              <TableHead hideBelow="md">{t('clinical.prescription.versionColumn')}</TableHead>
              <TableHead>{t('clinical.fields.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton rows={4} columns={6} />
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  if (state === 'error') return <ErrorState description={errorMessage} onRetry={load} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title={t('clinical.myRecords.noPrescriptionsTitle')}
        description={t('clinical.myRecords.noPrescriptionsDescription')}
      />
    );
  }

  return (
    <>
      {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
      <div className="grid gap-3 lg:hidden">
        {items.map((prescription) => (
          <button
            key={prescription.id}
            type="button"
            onClick={() => setDetailId(prescription.id)}
            className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{formatDate(prescription.prescriptionDate)}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {prescription.provider?.name || '—'} · v{prescription.versionNumber || 1}
                </p>
              </div>
              <Badge variant={prescriptionStatusVariant(prescription.status)}>
                {prescriptionStatusLabel(prescription.status, t)}
              </Badge>
            </div>
            <p className="mt-3 truncate text-xs text-muted-foreground">
              {prescription.diagnosisSummary || '—'} · {prescription.items?.length ?? 0} {t('clinical.prescription.itemsColumn')}
            </p>
          </button>
        ))}
      </div>

      <div className="hidden lg:block">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clinical.fields.date')}</TableHead>
                <TableHead hideBelow="sm">{t('clinical.fields.provider')}</TableHead>
                <TableHead hideBelow="md">{t('clinical.prescription.diagnosisColumn')}</TableHead>
                <TableHead hideBelow="sm">{t('clinical.prescription.itemsColumn')}</TableHead>
                <TableHead hideBelow="md">{t('clinical.prescription.versionColumn')}</TableHead>
                <TableHead>{t('clinical.fields.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((prescription) => (
                <TableRow
                  key={prescription.id}
                  className="cursor-pointer"
                  onClick={() => setDetailId(prescription.id)}
                >
                  <TableCell>{formatDate(prescription.prescriptionDate)}</TableCell>
                  <TableCell hideBelow="sm">{prescription.provider?.name || '—'}</TableCell>
                  <TableCell hideBelow="md" className="max-w-[200px] truncate">{prescription.diagnosisSummary || '—'}</TableCell>
                  <TableCell hideBelow="sm">{prescription.items?.length ?? 0}</TableCell>
                  <TableCell hideBelow="md">v{prescription.versionNumber || 1}</TableCell>
                  <TableCell>
                    <Badge variant={prescriptionStatusVariant(prescription.status)}>
                      {prescriptionStatusLabel(prescription.status, t)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <PrescriptionDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        prescriptionId={detailId}
        canWrite={false}
      />
    </>
  );
}

/**
 * FET-11 — patient self-service view of their own investigations,
 * same shape as `MyPrescriptionsTab` above. `GET /investigations/me`
 * is resolved by identity server-side (`investigation.routes.js`'s
 * `/me`, reachable by any authenticated user — `PATIENT` holds none
 * of `INVESTIGATIONS_READ`/`WRITE` itself, so this is the only path a
 * patient has to see their own orders) and already applies the same
 * sensitive-category gating `GynecologyPanel`/`PregnancyPanel` rely
 * on. `InvestigationDetailDialog` with `canWrite={false}` hides every
 * ordering/lifecycle action — a patient can look, not act.
 *
 * FET-17 — fully localized.
 */
function MyInvestigationsTab() {
  const { t } = useTranslation();
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setState('loading');
    investigationsService
      .getMyInvestigations()
      .then((data) => {
        setItems(data.items || []);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(load, []);

  if (state === 'loading') {
    return (
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clinical.investigation.ordered')}</TableHead>
              <TableHead>{t('nav.investigations')}</TableHead>
              <TableHead hideBelow="sm">{t('clinical.investigation.category')}</TableHead>
              <TableHead>{t('clinical.fields.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton rows={4} columns={4} />
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  if (state === 'error') return <ErrorState description={errorMessage} onRetry={load} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title={t('clinical.myRecords.noInvestigationsTitle')}
        description={t('clinical.myRecords.noInvestigationsDescription')}
      />
    );
  }

  return (
    <>
      {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
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
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(investigation.orderedDate)}</p>
              </div>
              <Badge variant={investigationStatusVariant(investigation.status)}>
                {investigationStatusLabel(investigation.status, t)}
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{investigationCategoryLabel(investigation.category, t)}</p>
          </button>
        ))}
      </div>

      <div className="hidden lg:block">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clinical.investigation.ordered')}</TableHead>
                <TableHead>{t('nav.investigations')}</TableHead>
                <TableHead hideBelow="sm">{t('clinical.investigation.category')}</TableHead>
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
                  <TableCell className="max-w-[200px] truncate">{investigation.name}</TableCell>
                  <TableCell hideBelow="sm">{investigationCategoryLabel(investigation.category, t)}</TableCell>
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

      <InvestigationDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        investigationId={detailId}
        canWrite={false}
      />
    </>
  );
}

/**
 * FET-11 — patient self-service view of their own medical reports.
 * Checkpoint 19 extension: patients can now also upload new reports
 * (PatientUploadReportDialog) and share existing ones with a doctor
 * (ShareReportDialog). Intake status is shown per report so patients
 * can track whether a shared report was accepted into the chart.
 *
 * FET-17 — fully localized.
 */
function MyReportsTab() {
  const { t } = useTranslation();
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [shareReport, setShareReport] = useState(null); // report object to share
  const [showUpload, setShowUpload] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const [myProfileId, setMyProfileId] = useState(null);

  const load = () => {
    setState('loading');
    reportsService
      .getMyReports()
      .then((data) => {
        setItems(data.items || []);
        // Capture patient profile id from first item for upload dialog
        if ((data.items || []).length > 0 && data.items[0].patientProfile) {
          setMyProfileId(data.items[0].patientProfile);
        }
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(load, []);

  if (state === 'loading') {
    return (
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clinical.fields.date')}</TableHead>
              <TableHead>{t('clinical.report.titleColumn')}</TableHead>
              <TableHead hideBelow="sm">{t('clinical.report.type')}</TableHead>
              <TableHead>{t('clinical.fields.status')}</TableHead>
              <TableHead hideBelow="md">{t('clinical.intake.statusColumn', 'Intake')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton rows={4} columns={5} />
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  if (state === 'error') return <ErrorState description={errorMessage} onRetry={load} />;

  return (
    <>
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? t('clinical.myRecords.noReportsDescription')
            : t('clinical.myRecords.reportsCount', { count: items.length }, `${items.length} report${items.length === 1 ? '' : 's'}`)}
        </p>
        <Button size="sm" onClick={() => { setDroppedFile(null); setShowUpload(true); }}>
          <Upload size={14} className="mr-1.5" />
          {t('clinical.report.uploadNew', 'Upload Report')}
        </Button>
      </div>

      {items.length === 0 ? (
        <ReportDropzone
          onFile={(file) => {
            setDroppedFile(file);
            setShowUpload(true);
          }}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
          <div className="grid gap-3 lg:hidden">
            {items.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-border bg-card p-4 shadow-one-ui"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{report.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(report.uploadDate)}</p>
                  </div>
                  <Badge variant={reportStatusVariant(report.status)}>{reportStatusLabel(report.status, t)}</Badge>
                </div>
                {report.submission?.intakeStatus ? (
                  <div className="mt-1">
                    <Badge variant={intakeStatusVariant(report.submission.intakeStatus)} className="text-[10px]">
                      {intakeStatusLabel(report.submission.intakeStatus, t)}
                    </Badge>
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">{reportTypeLabel(report.reportType, t)}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(report.id)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    {t('common.view', 'View')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareReport(report)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Share2 size={12} /> {t('clinical.report.share', 'Share')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('clinical.fields.date')}</TableHead>
                    <TableHead>{t('clinical.report.titleColumn')}</TableHead>
                    <TableHead hideBelow="sm">{t('clinical.report.type')}</TableHead>
                    <TableHead>{t('clinical.fields.status')}</TableHead>
                    <TableHead hideBelow="md">{t('clinical.intake.statusColumn', 'Intake')}</TableHead>
                    <TableHead>{t('common.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((report) => (
                    <TableRow key={report.id} className="cursor-pointer" onClick={() => setDetailId(report.id)}>
                      <TableCell>{formatDate(report.uploadDate)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{report.title}</TableCell>
                      <TableCell hideBelow="sm">{reportTypeLabel(report.reportType, t)}</TableCell>
                      <TableCell>
                        <Badge variant={reportStatusVariant(report.status)}>{reportStatusLabel(report.status, t)}</Badge>
                      </TableCell>
                      <TableCell hideBelow="md">
                        {report.submission?.intakeStatus ? (
                          <Badge variant={intakeStatusVariant(report.submission.intakeStatus)}>
                            {intakeStatusLabel(report.submission.intakeStatus, t)}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShareReport(report); }}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          aria-label={t('clinical.report.share', 'Share')}
                        >
                          <Share2 size={12} /> {t('clinical.report.share', 'Share')}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </>
      )}

      <ReportDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        reportId={detailId}
        canWrite={false}
        canVerify={false}
      />

      {showUpload ? (
        <PatientUploadReportDialog
          open={showUpload}
          onOpenChange={(next) => {
            setShowUpload(next);
            if (!next) setDroppedFile(null);
          }}
          initialFile={droppedFile}
          // Refresh the list behind the dialog; the dialog itself stays open
          // so the patient can see the confirmation and OCR status.
          onUploaded={() => load()}
        />
      ) : null}

      {shareReport ? (
        <ShareReportDialog
          open={Boolean(shareReport)}
          onOpenChange={(next) => !next && setShareReport(null)}
          reportId={shareReport.id}
          reportTitle={shareReport.title}
          onShared={() => { setShareReport(null); load(); }}
        />
      ) : null}
    </>
  );
}

/**
 * Patient self-service view of Advised Lab Requisitions and Test Costs.
 */
function MyLabRequisitionsTab() {
  const { t } = useTranslation();
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setState('loading');
    labRequisitionsService
      .getMyRequisitions()
      .then((data) => {
        setItems(data.items || []);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(load, []);

  const totalAdvisedCost = useMemo(() => {
    return items.reduce((acc, req) => acc + (req.totalCostBDT || 0), 0);
  }, [items]);

  if (state === 'loading') {
    return <TableSkeleton rows={4} cols={5} />;
  }

  if (state === 'error') {
    return (
      <ErrorState
        title="Failed to load lab requisitions"
        message={errorMessage}
        onRetry={load}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No Lab Requisitions Advised"
        description="When your doctor advises lab investigations, you will see the complete checklist and estimated costs here."
      />
    );
  }

  return (
    <>
      {/* Total Estimated Cost Banner */}
      <div className="mb-4 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt size={15} /> Total Advised Lab Tests Cost
          </h3>
          <p className="text-xs text-muted-foreground">
            Estimated private hospital test fee across {items.length} requisition form{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
          ৳{totalAdvisedCost.toLocaleString('en-BD')} BDT
        </div>
      </div>

      {/* Requisitions List */}
      <div className="space-y-3">
        {items.map((req) => (
          <div
            key={req.id}
            onClick={() => setDetailId(req.id)}
            className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer space-y-2 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-primary" />
                <span className="font-bold text-sm font-mono text-foreground">
                  {req.requisitionReference}
                </span>
                <Badge variant={req.status === 'ISSUED' ? 'success' : 'warning'}>
                  {req.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Date: {formatDate(req.createdAt)}</span>
                <span>•</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  ৳{(req.totalCostBDT || 0).toLocaleString('en-BD')} BDT
                </span>
              </div>
            </div>

            {req.clinicalDiagnosis && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Diagnosis:</span> {req.clinicalDiagnosis}
              </p>
            )}

            {/* Test Tags with prices */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(req.tests || []).map((t, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-foreground border border-border flex items-center gap-1 font-medium"
                >
                  <span>{t.name}</span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    (৳{t.costBDT})
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <LabRequisitionDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        requisitionId={detailId}
      />
    </>
  );
}

/**
 * FET-07 — patient's own view of their clinical records inside AppShell.
 */
export default function MyClinicalRecordsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('requisitions');

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.myRecords') }]}
        title={t('clinical.myRecords.pageTitle')}
        description={t('clinical.myRecords.pageDescription')}
      />

      <div className="flex gap-2 border-b border-border pb-1 mb-5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setTab('requisitions')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
            tab === 'requisitions'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt size={15} className="text-emerald-500" /> Lab Tests & Costs
        </button>
        <button
          type="button"
          onClick={() => setTab('prescriptions')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
            tab === 'prescriptions'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Pill size={15} /> {t('nav.prescriptions')}
        </button>
        <button
          type="button"
          onClick={() => setTab('investigations')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
            tab === 'investigations'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FlaskConical size={15} /> {t('nav.investigations')}
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
            tab === 'reports'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText size={15} /> {t('nav.reports')}
        </button>
        <button
          type="button"
          onClick={() => setTab('gynecology')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
            tab === 'gynecology'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <HeartPulse size={15} /> {t('clinical.record.tabGynecology')}
        </button>
        <button
          type="button"
          onClick={() => setTab('pregnancy')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
            tab === 'pregnancy'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Baby size={15} /> {t('clinical.record.tabPregnancy')}
        </button>
      </div>

      {tab === 'requisitions' ? <MyLabRequisitionsTab /> : null}
      {tab === 'prescriptions' ? <MyPrescriptionsTab /> : null}
      {tab === 'investigations' ? <MyInvestigationsTab /> : null}
      {tab === 'reports' ? <MyReportsTab /> : null}
      {tab === 'gynecology' ? <GynecologyPanel selfMode canWrite={false} /> : null}
      {tab === 'pregnancy' ? <PregnancyPanel selfMode canWrite={false} /> : null}
    </div>
  );
}
