import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldOff, ShieldCheck } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as billingService from '../../services/billingService.js';
import { extractApiError } from '../../services/apiClient.js';
import { FEE_SERVICE_TYPES, serviceTypeLabel } from '../../constants/billing.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const toDraft = (fee) => ({
  name: fee?.name || '',
  serviceType: fee?.serviceType || 'NEW_CONSULTATION',
  description: fee?.description || '',
  amount: fee?.amount ?? '',
  currency: fee?.currency || 'BDT',
});

/**
 * FET-12 — the service price catalog's own create/edit screen
 * (`Fee`, BET-15.1), same "create/edit + soft-deactivate toggle"
 * shape `MedicineFormDialog.jsx` established for a reference catalog
 * that must stay resolvable in past invoices even once retired.
 */
export default function FeeFormDialog({ open, onOpenChange, fee, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => toDraft(fee));
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(fee);

  useEffect(() => {
    if (open) {
      setForm(toDraft(fee));
      setError('');
    }
  }, [open, fee]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        amount: Number(form.amount),
        currency: form.currency,
        ...(isEdit ? {} : { serviceType: form.serviceType }),
      };
      if (isEdit) {
        await billingService.updateFee(fee.id, payload);
      } else {
        await billingService.createFee(payload);
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    setError('');
    try {
      await billingService.setFeeActive(fee.id, !fee.isActive);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{isEdit ? t('billing.fees.editTitle') : t('billing.fees.createTitle')}</DialogTitle>
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div>
          <label className={labelClass}>{t('billing.fees.name')}</label>
          <input className={inputClass} value={form.name} onChange={update('name')} disabled={saving} />
        </div>

        <div>
          <label className={labelClass}>{t('billing.fees.serviceType')}</label>
          <select
            className={inputClass}
            value={form.serviceType}
            onChange={update('serviceType')}
            disabled={saving || isEdit}
          >
            {FEE_SERVICE_TYPES.map((value) => (
              <option key={value} value={value}>
                {serviceTypeLabel(value, t)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('billing.fees.amount')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.amount}
              onChange={update('amount')}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass}>{t('billing.fees.currency')}</label>
            <input
              className={inputClass}
              value={form.currency}
              onChange={update('currency')}
              maxLength={3}
              disabled={saving}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('billing.fees.description')}</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={form.description}
            onChange={update('description')}
            disabled={saving}
          />
        </div>
      </div>

      <DialogFooter className="justify-between sm:justify-between">
        {isEdit ? (
          <Button type="button" variant="outline" onClick={handleToggleActive} disabled={togglingActive || saving}>
            {fee.isActive ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
            {fee.isActive ? t('billing.fees.deactivate') : t('billing.fees.activate')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !form.name.trim() || !form.amount}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
