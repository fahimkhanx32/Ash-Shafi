import { useState } from 'react';
import { QrCode, Search, FileText, CheckCircle2, User, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogCloseButton, DialogFooter } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Spinner } from '../ui/spinner.jsx';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import { formatDate } from '../../lib/dateFormat.js';

export default function BarcodeQrScannerModal({ open, onOpenChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleLookup = async (e) => {
    e?.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    const term = searchTerm.trim();

    try {
      // 1. Try verify token if term is token-like
      if (term.length >= 16 && !term.startsWith('RX-')) {
        try {
          const verified = await prescriptionsService.verifyPrescriptionToken(term);
          if (verified) {
            setResult({ type: 'token', data: verified });
            setLoading(false);
            return;
          }
        } catch {
          // fallback to list search
        }
      }

      // 2. Search list by prescriptionId / phone / name / patientId
      const res = await prescriptionsService.listPrescriptions({ search: term, limit: 5 });
      if (res.items && res.items.length > 0) {
        setResult({ type: 'list', items: res.items });
      } else {
        setError(t('clinical.prescription.noSearchResult', 'No prescription found for the provided code or term.'));
      }
    } catch (err) {
      setError(err.message || 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPrescription = (prescription) => {
    onOpenChange(false);
    if (prescription.patientProfile?.id || prescription.patientProfile?._id || prescription.patientProfile) {
      const pid = prescription.patientProfile?.id || prescription.patientProfile?._id || prescription.patientProfile;
      navigate(`/dashboard/patients/${pid}?tab=prescriptions`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <QrCode size={18} />
          </div>
          <div>
            <DialogTitle>{t('clinical.prescription.scannerTitle', 'QR / Barcode & Prescription Lookup')}</DialogTitle>
            <DialogDescription>
              {t('clinical.prescription.scannerDesc', 'Scan or type Prescription ID, Patient ID, Phone, or QR Token.')}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <form onSubmit={handleLookup} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="e.g. RX-2026-000001, PAT-2026-..., phone, or token"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-10 px-4 shrink-0 font-semibold" disabled={loading || !searchTerm.trim()}>
            {loading ? <Spinner className="h-4 w-4" /> : <Search size={15} />}
            {t('common.search', 'Lookup')}
          </Button>
        </form>

        {error ? (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {result.type === 'token' ? (
              <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <CheckCircle2 size={16} /> Authentic Medical Record Verified
                </div>
                <div className="text-xs space-y-1 text-slate-800 dark:text-slate-200">
                  <p><span className="font-semibold">Prescription ID:</span> {result.data.prescriptionId}</p>
                  <p><span className="font-semibold">Patient:</span> {result.data.patientName} ({result.data.patientId})</p>
                  <p><span className="font-semibold">Doctor:</span> {result.data.doctorName}</p>
                  <p><span className="font-semibold">Date:</span> {formatDate(result.data.prescriptionDate)}</p>
                </div>
              </div>
            ) : null}

            {result.type === 'list' ? (
              <div className="space-y-2">
                {result.items.map((item) => (
                  <div
                    key={item.id || item._id}
                    className="p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary font-mono">{item.prescriptionId || 'RX-RECORD'}</span>
                        <Badge variant="neutral" className="text-[10px]">{formatDate(item.prescriptionDate)}</Badge>
                      </div>
                      <p className="font-medium text-foreground mt-1">
                        {item.patientSnapshot?.name || item.patientProfile?.firstName || 'Patient'}
                        {item.patientSnapshot?.patientId ? ` (${item.patientSnapshot.patientId})` : ''}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {item.items?.length || 0} medicines prescribed • Dr. {item.provider?.name || item.doctorSnapshot?.name || 'Doctor'}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs shrink-0"
                      onClick={() => handleOpenPrescription(item)}
                    >
                      <span>Open Chart</span>
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {t('common.close', 'Close')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
