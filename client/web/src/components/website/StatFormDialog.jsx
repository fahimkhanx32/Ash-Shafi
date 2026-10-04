import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = { label: '', value: '', icon: '' };

export default function StatFormDialog({ open, onOpenChange, stat, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(stat);

  useEffect(() => {
    if (!open) return;
    setForm({
      label: stat?.label || '',
      value: stat?.value || '',
      icon: stat?.icon || '',
    });
    setError('');
  }, [open, stat]);

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving) setError('');
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        label: form.label.trim(),
        value: form.value.trim(),
        icon: form.icon.trim(),
      };
      if (isEdit) {
        await websiteService.updateStat(stat._id, payload);
      } else {
        await websiteService.createStat(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-md">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{isEdit ? t('website.statDialog.editTitle', 'Edit stat') : t('website.statDialog.addTitle', 'Add stat')}</DialogTitle>
            <DialogDescription>
              {t('website.statDialog.description', 'Shown in the homepage stats strip, e.g. "15+" / "Years of Excellence".')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <label className={labelClass}>{t('website.statDialog.value', 'Value')}</label>
              <input
                required
                maxLength={30}
                className={inputClass}
                placeholder="15+"
                value={form.value}
                onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t('website.statDialog.label', 'Label')}</label>
              <input
                required
                maxLength={80}
                className={inputClass}
                placeholder="Years of Excellence"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t('website.statDialog.icon', 'Icon (optional)')}</label>
              <input
                maxLength={50}
                className={inputClass}
                placeholder="Award"
                value={form.icon}
                onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.saveChanges') : t('website.stats.addStat', 'Add stat')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
