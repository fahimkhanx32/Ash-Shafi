import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FlaskConical, FileCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as investigationsService from '../../services/investigationsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table.jsx';
import {
  investigationCategoryLabel,
  investigationStatusLabel,
  investigationStatusVariant,
  investigationPriorityVariant,
  investigationPriorityLabel,
} from '../../constants/investigations.js';
import OrderInvestigationDialog from '../reports/OrderInvestigationDialog.jsx';
import InvestigationDetailDialog from '../reports/InvestigationDetailDialog.jsx';
import UploadReportDialog from '../reports/UploadReportDialog.jsx';
import { formatDate } from '../../lib/dateFormat.js';

/**
 * FET-11 — Investigations tab inside the unified patient workspace
 * (`PatientWorkspacePage.jsx`, FET-06), replacing the "coming soon"
 * placeholder that anticipated this module. Same shape as
 * `PrescriptionsTab.jsx` (FET-10): a thin list backed by
 * `GET /investigations?patientProfileId=` (BET-12), with the
 * ordering/lifecycle/upload workflow living in the dialogs it opens.
 */
export default function InvestigationsTab({ patientProfileId, canWrite = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [orderOpen, setOrderOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [uploadFor, setUploadFor] = useState(null);

  const load = () => {
    setState('loading');
    investigationsService
      .listInvestigationsByPatient(patientProfileId)
      .then(({ items: data }) => {
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

  const newButtons = canWrite ? (
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate(`/dashboard/patients/${patientProfileId}/lab-requisitions/new`)}
        className="gap-1.5 text-xs font-semibold"
      >
        <FlaskConical size={14} />
        <span>New Requisition Form</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOrderOpen(true)}
        className="gap-1.5 text-xs"
      >
        <Plus size={14} />
        <span>Quick Single Test</span>
      </Button>
    </div>
  ) : null;

  if (state === 'loading') {
    return (
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clinical.investigation.ordered')}</TableHead>
              <TableHead>{t('clinical.investigation.category')}</TableHead>
              <TableHead>{t('clinical.investigation.name')}</TableHead>
              <TableHead>{t('clinical.investigation.priority')}</TableHead>
              <TableHead>{t('clinical.fields.status')}</TableHead>
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
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={t('clinical.investigation.emptyTitle')}
          description={t('clinical.investigation.emptyDescription')}
          action={newButtons}
        />
      ) : (
        <>
          {canWrite ? <div className="flex justify-end">{newButtons}</div> : null}

          {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
          <div className="grid gap-3 lg:hidden">
            {items.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => setDetailId(inv.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inv.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(inv.orderedDate)}</p>
                  </div>
                  <Badge variant={investigationStatusVariant(inv.status)}>{investigationStatusLabel(inv.status, t)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('clinical.investigation.category')}
                    </span>
                    {investigationCategoryLabel(inv.category, t)}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('clinical.investigation.priority')}
                    </span>
                    <Badge variant={investigationPriorityVariant(inv.priority)}>{investigationPriorityLabel(inv.priority, t)}</Badge>
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
                    <TableHead>{t('clinical.investigation.category')}</TableHead>
                    <TableHead>{t('clinical.investigation.name')}</TableHead>
                    <TableHead>{t('clinical.investigation.priority')}</TableHead>
                    <TableHead>{t('clinical.fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer" onClick={() => setDetailId(inv.id)}>
                      <TableCell>{formatDate(inv.orderedDate)}</TableCell>
                      <TableCell>{investigationCategoryLabel(inv.category, t)}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{inv.name}</TableCell>
                      <TableCell>
                        <Badge variant={investigationPriorityVariant(inv.priority)}>{investigationPriorityLabel(inv.priority, t)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={investigationStatusVariant(inv.status)}>{investigationStatusLabel(inv.status, t)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </>
      )}

      <OrderInvestigationDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        patientProfileId={patientProfileId}
        onOrdered={load}
      />

      <InvestigationDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(next) => !next && setDetailId(null)}
        investigationId={detailId}
        canWrite={canWrite}
        onChanged={load}
        onUploadReport={
          canWrite
            ? (investigation) => {
                setDetailId(null);
                setUploadFor(investigation);
              }
            : undefined
        }
      />

      <UploadReportDialog
        open={Boolean(uploadFor)}
        onOpenChange={(next) => !next && setUploadFor(null)}
        patientProfileId={patientProfileId}
        investigation={uploadFor}
        onUploaded={load}
      />
    </div>
  );
}
