import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Award } from 'lucide-react';

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
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = { name: '', image: null };

/** Create/edit dialog for a single certificate/accreditation logo. */
export default function CertificateFormDialog({ open, onOpenChange, certificate, onSaved }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(certificate);

  useEffect(() => {
    if (!open) return;
    setForm({ name: certificate?.name || '', image: certificate?.image || null });
    setError('');
  }, [open, certificate]);

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving) setError('');
    onOpenChange(nextOpen);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await websiteService.uploadCertificateImage(file);
      setForm((p) => ({ ...p, image: uploaded }));
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.image?.url) {
      setError(t('validation.cms.uploadLogoRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name.trim(), image: form.image };
      if (isEdit) {
        await websiteService.updateCertificate(certificate._id, payload);
      } else {
        await websiteService.createCertificate(payload);
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
            <DialogTitle>{isEdit ? t('cms.certificates.form.editTitle') : t('cms.certificates.form.addTitle')}</DialogTitle>
            <DialogDescription>{t('cms.certificates.form.description')}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <label className={labelClass}>{t('cms.certificates.form.name')}</label>
              <input
                required
                maxLength={120}
                className={inputClass}
                placeholder={t('cms.certificates.form.namePlaceholder')}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div>
              <label className={labelClass}>{t('cms.certificates.form.logoImage')}</label>
              <div className="rounded-lg border border-dashed border-border p-3">
                {form.image?.url ? (
                  <div className="mb-2 flex h-24 items-center justify-center rounded-md bg-muted p-2">
                    <img src={form.image.url} alt="Certificate" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="mb-2 flex h-24 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Award size={24} />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> {uploading ? t('cms.certificates.form.uploading') : t('cms.certificates.form.uploadImage')}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving || uploading}>
              {saving ? t('common.saving') : isEdit ? t('cms.certificates.form.saveChanges') : t('cms.certificates.form.addCertificate')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
