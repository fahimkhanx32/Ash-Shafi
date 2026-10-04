import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as investigationsService from '../../services/investigationsService.js';
import { extractApiError } from '../../services/apiClient.js';
import {
  INVESTIGATION_CATEGORIES,
  INVESTIGATION_PRIORITIES,
  investigationCategoryLabel,
  investigationPriorityLabel,
} from '../../constants/investigations.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const selectClass = inputClass;
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = {
  category: '',
  name: '',
  priority: 'ROUTINE',
  clinicalIndication: '',
  clinicalNotes: '',
  scheduledDate: '',
};

/**
 * FET-11 — "Investigation ordering". Creates a new `Investigation`
 * (BET-12) in `ORDERED` status against `patientProfileId`, optionally
 * pre-scheduled. `category` is a fixed enum the backend uses to
 * server-compute `isSensitive` — never client-labeled — so this
 * dialog only ever offers the real backend categories, same
 * "never invent a value the backend doesn't accept" rule
 * `PrescriptionFormDialog` already follows.
 *
 * FET-17 — fully localized; the one client-side validation message
 * resolves through `validation.clinical.*`, same pattern the auth/
 * billing schemas already established.
 */
export default function OrderInvestigationDialog({ open, onOpenChange, patientProfileId, onOrdered }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setError('');
    }
  }, [open]);

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.category || !form.name.trim()) {
      setError(t('validation.clinical.investigationCategoryNameRequired', 'Category and investigation name are required.'));
      return;
    }
    setSaving(true);
    try {
      const saved = await investigationsService.orderInvestigation(patientProfileId, {
        category: form.category,
        name: form.name.trim(),
        priority: form.priority,
        clinicalIndication: form.clinicalIndication,
        clinicalNotes: form.clinicalNotes,
        scheduledDate: form.scheduledDate || null,
      });
      onOrdered?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)} className="max-w-lg">
      <DialogCloseButton onClose={() => !saving && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('clinical.investigation.orderTitle')}</DialogTitle>
        <DialogDescription>{t('clinical.investigation.orderDescription')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('clinical.investigation.category')}</label>
            <select className={selectClass} value={form.category} disabled={saving} onChange={set('category')}>
              <option value="">{t('clinical.investigation.selectPlaceholder')}</option>
              {INVESTIGATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {investigationCategoryLabel(c, t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('clinical.investigation.priority')}</label>
            <select className={selectClass} value={form.priority} disabled={saving} onChange={set('priority')}>
              {INVESTIGATION_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {investigationPriorityLabel(p, t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('clinical.investigation.name')}</label>
          <input
            className={inputClass}
            value={form.name}
            disabled={saving}
            onChange={set('name')}
            placeholder={t('clinical.investigation.namePlaceholder')}
            maxLength={200}
          />
        </div>

        <div>
          <label className={labelClass}>{t('clinical.investigation.scheduledDateOptional')}</label>
          <input
            type="date"
            className={inputClass}
            value={form.scheduledDate}
            disabled={saving}
            onChange={set('scheduledDate')}
          />
        </div>

        <div>
          <label className={labelClass}>{t('clinical.investigation.clinicalIndication')}</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={form.clinicalIndication}
            disabled={saving}
            onChange={set('clinicalIndication')}
            maxLength={500}
          />
        </div>

        <div>
          <label className={labelClass}>{t('clinical.investigation.clinicalNotes')}</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={form.clinicalNotes}
            disabled={saving}
            onChange={set('clinicalNotes')}
            maxLength={1000}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t('clinical.investigation.ordering') : t('clinical.investigation.order')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
