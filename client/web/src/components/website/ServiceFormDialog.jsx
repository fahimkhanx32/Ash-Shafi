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
import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = { title: '', description: '', icon: '' };

/** Create/edit dialog for a homepage "Our Care Services" card. */
export default function ServiceFormDialog({ open, onOpenChange, service, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(service);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: service?.title || '',
      description: service?.description || '',
      icon: service?.icon || '',
    });
    setError('');
  }, [open, service]);

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
        title: form.title.trim(),
        description: form.description.trim(),
        icon: form.icon.trim(),
      };
      if (isEdit) {
        await websiteService.updateService(service._id, payload);
      } else {
        await websiteService.createService(payload);
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
    <Dialog open={open} onOpenChange={handleClose} className="max-w-lg">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{isEdit ? t('website.serviceDialog.editTitle') : t('website.serviceDialog.addTitle')}</DialogTitle>
            <DialogDescription>{t('website.serviceDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <label className={labelClass}>{t('website.serviceDialog.titleField')}</label>
              <input
                required
                maxLength={120}
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t('website.serviceDialog.descriptionField')}</label>
              <textarea
                required
                rows={3}
                maxLength={500}
                className={textareaClass}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t('website.serviceDialog.icon')}</label>
              <input
                maxLength={50}
                className={inputClass}
                placeholder="Stethoscope"
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
              {saving ? t('common.saving') : isEdit ? t('common.saveChanges') : t('website.services.addService')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
