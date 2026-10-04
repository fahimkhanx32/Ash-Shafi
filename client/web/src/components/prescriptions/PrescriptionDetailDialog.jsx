import { useEffect, useState } from 'react';
import { CheckCircle2, FileEdit, History, Printer, Download, Share2, ExternalLink, Activity, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import { extractApiError } from '../../services/apiClient.js';
import {
  prescriptionStatusLabel,
  prescriptionStatusVariant,
} from '../../constants/prescriptions.js';
import LegalPrescriptionDocument from './LegalPrescriptionDocument.jsx';
import RevisePrescriptionDialog from './RevisePrescriptionDialog.jsx';
import SharePrescriptionDialog from './SharePrescriptionDialog.jsx';
import { formatDate } from '../../lib/dateFormat.js';

const fmtDate = (value) => (value ? formatDate(value) : '—');

export default function PrescriptionDetailDialog({
  open,
  onOpenChange,
  prescriptionId,
  canWrite = false,
  onEdit,
  onChanged,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [prescription, setPrescription] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = (id) => {
    setState('loading');
    setErrorMessage('');
    prescriptionsService
      .getPrescription(id)
      .then((data) => {
        setPrescription(data);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(() => {
    if (open && prescriptionId) {
      load(prescriptionId);
      setShowHistory(false);
      setActionError('');
    }
  }, [open, prescriptionId]);

  const loadHistory = () => {
    if (!prescription) return;
    prescriptionsService
      .getPrescriptionHistory(prescription.id || prescription._id)
      .then(setHistory)
      .catch(() => setHistory([]));
    setShowHistory(true);
  };

  const handleFinalize = async () => {
    setActionError('');
    setFinalizing(true);
    try {
      const updated = await prescriptionsService.finalizePrescription(prescription.id || prescription._id);
      setPrescription(updated);
      onChanged?.(updated);
    } catch (error) {
      setActionError(extractApiError(error).message);
    } finally {
      setFinalizing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!prescription) return;
    try {
      const blobUrl = await prescriptionsService.getPrescriptionPdfBlobUrl(prescription.id || prescription._id);
      const patName = prescription.patientSnapshot?.name || 'Patient';
      const dateStr = new Date(prescription.prescriptionDate || Date.now()).toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Ash-Shafi_Prescription_${patName.replace(/\s+/g, '_')}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setActionError(extractApiError(err).message);
    }
  };

  const handleOpenWorkspace = () => {
    if (!prescription) return;
    const pid = prescription.patientProfile?.id || prescription.patientProfile?._id || prescription.patientProfile;
    onOpenChange(false);
    navigate(`/dashboard/patients/${pid}/prescriptions/${prescription.id || prescription._id}/edit`);
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} className="max-w-3xl">
        <DialogCloseButton onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <span>{prescription?.prescriptionId || t('clinical.prescription.detailTitle', 'Prescription Detail')}</span>
                {prescription ? (
                  <Badge variant={prescriptionStatusVariant(prescription.status)}>
                    {prescriptionStatusLabel(prescription.status, t)}
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                {prescription
                  ? t('clinical.prescription.versionLine', {
                      version: prescription.versionNumber || 1,
                      date: fmtDate(prescription.prescriptionDate),
                    })
                  : ''}
              </DialogDescription>
            </div>

            {prescription ? (
              <Button type="button" size="sm" variant="outline" className="gap-1 text-xs" onClick={handleOpenWorkspace}>
                <ExternalLink size={13} /> {t('clinical.prescription.openWorkspace', 'Open Workspace')}
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="mt-4">
          {state === 'loading' ? <SkeletonList rows={4} /> : null}
          {state === 'error' ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {state === 'ready' && prescription ? (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {actionError ? (
                <Alert variant="destructive">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              ) : null}

              {/* Toggle Document Preview vs Structured Details */}
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span><strong className="text-foreground">Patient:</strong> {prescription.patientSnapshot?.name || '—'}</span>
                  <span><strong className="text-foreground">Doctor:</strong> Dr. {prescription.provider?.name || prescription.doctorSnapshot?.name || '—'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={!showDocumentPreview ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowDocumentPreview(false)}
                  >
                    Details
                  </Button>
                  <Button
                    type="button"
                    variant={showDocumentPreview ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowDocumentPreview(true)}
                  >
                    Legal Preview
                  </Button>
                </div>
              </div>

              {showDocumentPreview ? (
                <div className="p-4 flex justify-center bg-slate-900/5 dark:bg-slate-950/50 rounded-2xl border border-border overflow-x-auto">
                  <LegalPrescriptionDocument prescription={prescription} scale={0.7} />
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Diagnoses */}
                  <div className="rounded-xl border border-border p-3 bg-card space-y-1">
                    <span className="font-bold text-foreground">Diagnosis:</span>
                    <p className="text-foreground font-medium">
                      {(prescription.diagnoses?.map((d) => d.name).join(', ')) || prescription.diagnosisSummary || '—'}
                    </p>
                  </div>

                  {/* Medicines */}
                  <div className="rounded-xl border border-border p-3 bg-card space-y-2">
                    <span className="font-bold text-foreground">Prescribed Medicines ({prescription.items?.length || 0}):</span>
                    <div className="space-y-2 divide-y divide-border/60">
                      {(prescription.items || []).map((item, idx) => (
                        <div key={item.id || item._id || idx} className="pt-2 first:pt-0">
                          <p className="font-bold text-foreground text-sm">
                            {idx + 1}. {item.medicineType ? `${item.medicineType.slice(0, 3)}. ` : ''}{item.brandName || item.genericName}{item.strength ? ` ${item.strength} ${item.strengthUnit || ''}` : ''}
                            {item.genericName && item.brandName ? <span className="font-normal text-muted-foreground italic ml-1">({item.genericName})</span> : null}
                          </p>
                          <div className="flex flex-wrap gap-x-4 mt-0.5 text-primary font-medium">
                            <span>{item.dosage || item.frequency || '1 + 0 + 0'}</span>
                            {item.foodInstruction ? <span>{item.foodInstruction}</span> : null}
                            {item.durationValue ? <span>{item.durationValue} {item.durationUnit}</span> : null}
                            {item.continuation ? <span className="text-emerald-700 dark:text-emerald-400">{item.continuation}</span> : null}
                          </div>
                          {item.specialInstruction ? <p className="text-muted-foreground italic mt-0.5">{item.specialInstruction}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Investigations & Advice */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {prescription.investigations?.length || prescription.labTests?.length ? (
                      <div className="rounded-xl border border-border p-3 bg-card space-y-1.5">
                        <span className="font-bold text-foreground">Investigations:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-foreground">
                          {(prescription.investigations?.length ? prescription.investigations : prescription.labTests).map((inv, i) => (
                            <li key={i}>{inv.testName || inv.name}{inv.notes ? ` (${inv.notes})` : ''}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {prescription.advice?.length || prescription.generalInstructions ? (
                      <div className="rounded-xl border border-border p-3 bg-card space-y-1.5">
                        <span className="font-bold text-foreground">Advice:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-foreground">
                          {Array.isArray(prescription.advice)
                            ? prescription.advice.map((a, i) => <li key={i}>{typeof a === 'string' ? a : a.text}</li>)
                            : null}
                          {prescription.generalInstructions ? <li>{prescription.generalInstructions}</li> : null}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                <div className="flex flex-wrap items-center gap-2">
                  {canWrite && prescription.status === 'DRAFT' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={handleOpenWorkspace}>
                        <FileEdit size={14} /> {t('clinical.prescription.editDraft', 'Edit Draft')}
                      </Button>
                      <Button size="sm" onClick={handleFinalize} disabled={finalizing}>
                        <CheckCircle2 size={14} /> {finalizing ? t('clinical.prescription.finalizing') : t('clinical.prescription.finalize')}
                      </Button>
                    </>
                  ) : null}

                  {canWrite && prescription.status === 'FINALIZED' ? (
                    <Button size="sm" variant="outline" onClick={() => setReviseOpen(true)}>
                      <FileEdit size={14} /> {t('clinical.prescription.revise', 'Revise (Create v2)')}
                    </Button>
                  ) : null}

                  <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
                    <Download size={14} /> {t('clinical.prescription.downloadPdf', 'Download PDF')}
                  </Button>

                  <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                    <Share2 size={14} /> {t('clinical.prescription.share', 'Share')}
                  </Button>
                </div>

                <Button size="sm" variant="ghost" onClick={loadHistory}>
                  <History size={14} /> {t('clinical.prescription.versionHistory', 'Version History')}
                </Button>
              </div>

              {/* History list expansion */}
              {showHistory && (
                <div className="rounded-xl border border-border divide-y divide-border text-xs">
                  {history.map((ver) => (
                    <button
                      key={ver.id || ver._id}
                      type="button"
                      className="w-full flex items-center justify-between p-2.5 hover:bg-accent transition-colors text-left"
                      onClick={() => load(ver.id || ver._id)}
                    >
                      <div>
                        <span className="font-bold text-foreground">v{ver.versionNumber || 1} • {ver.prescriptionId || 'RX-RECORD'}</span>
                        <span className="text-muted-foreground ml-2">{formatDate(ver.prescriptionDate)}</span>
                      </div>
                      <Badge variant={prescriptionStatusVariant(ver.status)}>
                        {ver.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Dialog>

      {/* Revise Dialog */}
      {prescription && (
        <RevisePrescriptionDialog
          open={reviseOpen}
          onOpenChange={setReviseOpen}
          prescription={prescription}
          onRevised={(rev) => {
            setPrescription(rev);
            onChanged?.(rev);
          }}
        />
      )}

      {/* Share Dialog */}
      {prescription && (
        <SharePrescriptionDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          prescription={prescription}
        />
      )}
    </>
  );
}
