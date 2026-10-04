import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as billingService from '../../services/billingService.js';
import { extractApiError } from '../../services/apiClient.js';
import { FEE_SERVICE_TYPES, serviceTypeLabel, formatMoney } from '../../constants/billing.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

/**
 * The complement to `CreateInvoiceDialog` for a doctor who'd rather
 * not deal with line items/pricing right now: flags what the patient
 * should be charged for (new visit, follow-up, reviewing a report,
 * or anything else — `FEE_SERVICE_TYPES`) and hands it to billing
 * staff as a `ChargeSuggestion` (`POST /billing/charge-suggestions`)
 * to turn into the real invoice. Never creates an Invoice itself.
 */
export default function SuggestChargeDialog({ open, onOpenChange, patientProfileId, fees = [], onCreated }) {
  const { t } = useTranslation();
  const [serviceType, setServiceType] = useState('FOLLOW_UP_CONSULTATION');
  const [feeId, setFeeId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setServiceType('FOLLOW_UP_CONSULTATION');
      setFeeId('');
      setNote('');
      setError('');
    }
  }, [open]);

  const matchingFees = fees.filter((f) => f.serviceType === serviceType && f.isActive !== false);

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await billingService.createChargeSuggestion({
        patientProfileId,
        serviceType,
        feeId: feeId || undefined,
        note: note.trim(),
      });
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogCloseButton onClose={() => !saving && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('billing.suggestCharge.title', 'Suggest a charge')}</DialogTitle>
        <DialogDescription>
          {t(
            'billing.suggestCharge.description',
            "Flag what this patient should be charged for — reception will create the invoice. You aren't charging them directly.",
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div>
          <span className={labelClass}>{t('billing.suggestCharge.serviceType', 'Charge for')}</span>
          <select
            className={inputClass}
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value);
              setFeeId('');
            }}
          >
            {FEE_SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {serviceTypeLabel(type, t)}
              </option>
            ))}
          </select>
        </div>

        {matchingFees.length > 0 ? (
          <div>
            <span className={labelClass}>
              {t('billing.suggestCharge.suggestedFee', 'Suggested price (optional)')}
            </span>
            <select className={inputClass} value={feeId} onChange={(e) => setFeeId(e.target.value)}>
              <option value="">{t('billing.suggestCharge.letReceptionPick', "Let reception pick")}</option>
              {matchingFees.map((fee) => (
                <option key={fee.id} value={fee.id}>
                  {fee.name} — {formatMoney(fee.amount, fee.currency)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <span className={labelClass}>{t('billing.suggestCharge.note', 'Note (optional)')}</span>
          <textarea
            rows={3}
            className={textareaClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('billing.suggestCharge.notePlaceholder', 'e.g. reviewed lab report, advise follow-up in 2 weeks')}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          <Send size={16} /> {saving ? t('common.sending', 'Sending...') : t('billing.suggestCharge.send', 'Send to reception')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
