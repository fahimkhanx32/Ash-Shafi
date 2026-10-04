import { useState } from 'react';
import { Edit3, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogCloseButton, DialogFooter } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Spinner } from '../ui/spinner.jsx';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import { extractApiError } from '../../services/apiClient.js';

export default function RevisePrescriptionDialog({ open, onOpenChange, prescription, onRevised }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!prescription) return null;

  const handleRevise = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setLoading(true);
    setError('');

    try {
      const revision = await prescriptionsService.revisePrescription(
        prescription.id || prescription._id,
        reason.trim(),
        {},
      );
      onOpenChange(false);
      if (onRevised) onRevised(revision);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
            <Edit3 size={18} />
          </div>
          <div>
            <DialogTitle>{t('clinical.prescription.reviseTitle', 'Revise Finalized Prescription')}</DialogTitle>
            <DialogDescription>
              {t('clinical.prescription.reviseDesc', 'This will create Version {{nextVer}} and mark the current prescription as SUPERSEDED.', { nextVer: (prescription.versionNumber || 1) + 1 })}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleRevise} className="space-y-4 py-2">
        {error ? (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={15} /> {error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t('clinical.prescription.revisionReason', 'Clinical Reason for Revision')} *
          </label>
          <textarea
            required
            rows={3}
            placeholder="e.g. Adjusted dosage of Linagliptin, corrected investigation instructions..."
            className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:ring-2 focus:ring-primary/20"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={loading || !reason.trim()}>
            {loading ? <Spinner className="h-4 w-4" /> : <Edit3 size={14} />}
            {t('clinical.prescription.createRevision', 'Create Revision')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
