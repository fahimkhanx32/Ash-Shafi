import { useEffect, useState } from 'react';
import { Plus, Pill, ExternalLink, Printer, Download, Share2, QrCode, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import * as prescriptionsService from '../../services/prescriptionsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table.jsx';
import { prescriptionStatusLabel, prescriptionStatusVariant } from '../../constants/prescriptions.js';
import PrescriptionDetailDialog from '../prescriptions/PrescriptionDetailDialog.jsx';
import SharePrescriptionDialog from '../prescriptions/SharePrescriptionDialog.jsx';
import BarcodeQrScannerModal from '../prescriptions/BarcodeQrScannerModal.jsx';
import { formatDate } from '../../lib/dateFormat.js';

export default function PrescriptionsTab({ patientProfileId, canWrite = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [sharePrescription, setSharePrescription] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = () => {
    setState('loading');
    prescriptionsService
      .listPrescriptionsByPatient(patientProfileId)
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

  const handleOpenWorkspace = (prescriptionId = 'new') => {
    navigate(`/dashboard/patients/${patientProfileId}/prescriptions/${prescriptionId}/edit`);
  };

  const handleDownloadPdf = async (e, id, prescription) => {
    e.stopPropagation();
    try {
      const blobUrl = await prescriptionsService.getPrescriptionPdfBlobUrl(id);
      const patName = prescription?.patientSnapshot?.name || 'Patient';
      const dateStr = new Date(prescription?.prescriptionDate || Date.now()).toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Ash-Shafi_Prescription_${patName.replace(/\s+/g, '_')}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // fallback to opening detail
      setDetailId(id);
    }
  };

  const newButton = canWrite ? (
    <Button
      size="sm"
      className="gap-1.5"
      onClick={() => handleOpenWorkspace('new')}
    >
      <Plus size={14} /> {t('clinical.prescription.new', 'New Prescription')}
    </Button>
  ) : null;

  if (state === 'loading') {
    return (
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prescription ID</TableHead>
              <TableHead>{t('clinical.fields.date')}</TableHead>
              <TableHead>{t('clinical.fields.provider')}</TableHead>
              <TableHead>{t('clinical.prescription.diagnosisColumn')}</TableHead>
              <TableHead>{t('clinical.prescription.itemsColumn')}</TableHead>
              <TableHead>{t('clinical.prescription.versionColumn')}</TableHead>
              <TableHead>{t('clinical.fields.status')}</TableHead>
              <TableHead className="text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton rows={4} columns={8} />
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
        title={t('clinical.prescription.emptyTitle', 'No prescriptions yet')}
        description={t('clinical.prescription.emptyDescription', 'Create the first full prescription with the Legal 8.5" × 14" workspace.')}
        action={newButton}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setScannerOpen(true)}
          >
            <QrCode size={13} /> {t('clinical.prescription.lookupQr', 'Lookup / Scan QR')}
          </Button>
        </div>

        {canWrite ? (
          <div className="flex items-center gap-2">
            {newButton}
          </div>
        ) : null}
      </div>

      {/* Cards for small screens */}
      <div className="grid gap-3 lg:hidden">
        {items.map((prescription) => (
          <div
            key={prescription.id || prescription._id}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm space-y-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-primary">{prescription.prescriptionId || 'RX-RECORD'}</span>
                  <Badge variant={prescriptionStatusVariant(prescription.status)}>
                    {prescriptionStatusLabel(prescription.status, t)}
                  </Badge>
                </div>
                <p className="mt-1 font-semibold text-foreground text-sm">{formatDate(prescription.prescriptionDate)}</p>
                <p className="text-xs text-muted-foreground">
                  Dr. {prescription.provider?.name || prescription.doctorSnapshot?.name || '—'} · v{prescription.versionNumber || 1}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleOpenWorkspace(prescription.id || prescription._id)}
                  title="Open Workspace"
                >
                  <ExternalLink size={14} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => handleDownloadPdf(e, prescription.id || prescription._id, prescription)}
                  title="Download PDF"
                >
                  <Download size={14} />
                </Button>
              </div>
            </div>

            <div className="text-xs border-t border-border/60 pt-2 space-y-1">
              <p>
                <span className="font-semibold text-muted-foreground">{t('clinical.prescription.diagnosisColumn')}: </span>
                <span className="text-foreground">{prescription.diagnosisSummary || (prescription.diagnoses?.map((d) => d.name).join(', ')) || '—'}</span>
              </p>
              <p className="text-muted-foreground">
                {prescription.items?.length || 0} prescribed medicines
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table for large screens */}
      <div className="hidden lg:block">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prescription ID</TableHead>
                <TableHead>{t('clinical.fields.date')}</TableHead>
                <TableHead>{t('clinical.fields.provider')}</TableHead>
                <TableHead>{t('clinical.prescription.diagnosisColumn')}</TableHead>
                <TableHead>{t('clinical.prescription.itemsColumn')}</TableHead>
                <TableHead>{t('clinical.prescription.versionColumn')}</TableHead>
                <TableHead>{t('clinical.fields.status')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((prescription) => (
                <TableRow
                  key={prescription.id || prescription._id}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <TableCell className="font-mono font-bold text-xs text-primary">
                    {prescription.prescriptionId || 'RX-DRAFT'}
                  </TableCell>
                  <TableCell>{formatDate(prescription.prescriptionDate)}</TableCell>
                  <TableCell>{prescription.provider?.name || prescription.doctorSnapshot?.name || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {prescription.diagnosisSummary || (prescription.diagnoses?.map((d) => d.name).join(', ')) || '—'}
                  </TableCell>
                  <TableCell>{prescription.items?.length ?? 0} meds</TableCell>
                  <TableCell>v{prescription.versionNumber || 1}</TableCell>
                  <TableCell>
                    <Badge variant={prescriptionStatusVariant(prescription.status)}>
                      {prescriptionStatusLabel(prescription.status, t)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => handleOpenWorkspace(prescription.id || prescription._id)}
                      >
                        <ExternalLink size={13} /> Open
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => handleDownloadPdf(e, prescription.id || prescription._id, prescription)}
                        title="Download PDF"
                      >
                        <Download size={14} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setSharePrescription(prescription)}
                        title="Share"
                      >
                        <Share2 size={14} />
                      </Button>
                    </div>
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
        canWrite={canWrite}
        onEdit={(p) => {
          setDetailId(null);
          handleOpenWorkspace(p.id || p._id);
        }}
        onChanged={load}
      />

      <SharePrescriptionDialog
        open={Boolean(sharePrescription)}
        onOpenChange={(next) => !next && setSharePrescription(null)}
        prescription={sharePrescription}
      />

      <BarcodeQrScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
      />
    </div>
  );
}
