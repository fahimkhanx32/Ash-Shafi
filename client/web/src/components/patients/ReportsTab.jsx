import { useEffect, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as reportsService from '../../services/reportsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table.jsx';
import { reportStatusLabel, reportStatusVariant, reportTypeLabel } from '../../constants/reports.js';
import UploadReportDialog from '../reports/UploadReportDialog.jsx';
import ReportDetailDialog from '../reports/ReportDetailDialog.jsx';
import { formatDate } from '../../lib/dateFormat.js';

/**
 * FET-11 — Reports tab inside the unified patient workspace
 * (`PatientWorkspacePage.jsx`, FET-06), replacing the "coming soon"
 * placeholder. Same shape as `InvestigationsTab.jsx`: a thin list
 * backed by `GET /reports/patient/:patientProfileId` (BET-12), with
 * the upload/review/verify/finalize/amend workflow living in the
 * dialogs it opens. `canVerify` (REPORTS_VERIFY) is a strictly
 * narrower grant than `canWrite` (REPORTS_WRITE) — a role can upload
 * without being able to verify/finalize, mirroring the backend split.
 */
export default function ReportsTab({ patientProfileId, canWrite = false, canVerify = false }) {
  const { t } = useTranslation();
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setState('loading');
    reportsService
      .listReportsByPatient(patientProfileId)
      .then((data) => {
        setItems(data);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientProfileId]);

  const newButton = canWrite ? (
    <Button size="sm" onClick={() => setUploadOpen(true)}>
      <Upload size={14} /> {t('clinical.report.upload')}
    </Button>
  ) : null;

  if (state === 'loading') {
    return (
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clinical.report.uploaded')}</TableHead>
              <TableHead>{t('clinical.report.titleColumn')}</TableHead>
              <TableHead>{t('clinical.report.type')}</TableHead>
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

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('clinical.report.emptyTitle')}
          description={t('clinical.report.emptyDescription')}
          action={newButton}
        />
      ) : (
        <>
          {canWrite ? <div className="flex justify-end">{newButton}</div> : null}

          {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
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
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(report.uploadDate)}</p>
                  </div>
                  <Badge variant={reportStatusVariant(report.status)}>{reportStatusLabel(report.status, t)}</Badge>
                </div>
                <div className="mt-3 text-xs">
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {t('clinical.report.type')}
                  </span>
                  {reportTypeLabel(report.reportType, t)}
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
                    <TableHead>{t('clinical.report.titleColumn')}</TableHead>
                    <TableHead>{t('clinical.report.type')}</TableHead>
                    <TableHead>{t('clinical.fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((report) => (
                    <TableRow key={report.id} className="cursor-pointer" onClick={() => setDetailId(report.id)}>
                      <TableCell>{formatDate(report.uploadDate)}</TableCell>
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
        </>
      )}

      <UploadReportDialog open={uploadOpen} onOpenChange={setUploadOpen} patientProfileId={patientProfileId} onUploaded={load} />

      <ReportDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        reportId={detailId}
        canWrite={canWrite}
        canVerify={canVerify}
        onChanged={load}
      />
    </div>
  );
}
