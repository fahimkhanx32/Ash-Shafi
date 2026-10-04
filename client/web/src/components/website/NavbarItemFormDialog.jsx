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

const inputClass =
  'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = { label: '', href: '', parentId: '', openInNewTab: false };

/**
 * Create/edit dialog for a single navbar item. `topLevelItems` (passed
 * from `NavbarTab`) populates the "Show as dropdown under" picker —
 * only one nesting level is supported (mirrors
 * `dynamic-site.service.js`'s `NAVBAR_DEPTH_EXCEEDED` guard), so only
 * top-level items are offered as a parent.
 */
export default function NavbarItemFormDialog({ open, onOpenChange, item, topLevelItems, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(item);

  useEffect(() => {
    if (!open) return;
    setForm({
      label: item?.label || '',
      href: item?.href || '',
      parentId: item?.parentId ? String(item.parentId) : '',
      openInNewTab: item?.openInNewTab || false,
    });
    setError('');
  }, [open, item]);

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
        href: form.href.trim(),
        parentId: form.parentId || null,
        openInNewTab: form.openInNewTab,
      };
      if (isEdit) {
        await websiteService.updateNavbarItem(item._id || item.id, payload);
      } else {
        await websiteService.createNavbarItem(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = (topLevelItems || []).filter((candidate) => candidate._id !== item?._id);

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-lg">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{isEdit ? t('website.navbarItemDialog.editTitle') : t('website.navbarItemDialog.addTitle')}</DialogTitle>
            <DialogDescription>
              {t('website.navbarItemDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <label className={labelClass}>{t('website.navbarItemDialog.label')}</label>
              <input
                required
                maxLength={60}
                className={inputClass}
                placeholder={t('website.navbarItemDialog.labelPlaceholder')}
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t('website.navbarItemDialog.link')}</label>
              <input
                required
                maxLength={300}
                className={inputClass}
                placeholder="/services"
                value={form.href}
                onChange={(e) => setForm((prev) => ({ ...prev, href: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t('website.navbarItemDialog.parent')}</label>
              <select
                className={inputClass}
                value={form.parentId}
                onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}
              >
                <option value="">{t('website.navbarItemDialog.topLevel')}</option>
                {parentOptions.map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.openInNewTab}
                onChange={(e) => setForm((prev) => ({ ...prev, openInNewTab: e.target.checked }))}
              />
              {t('website.navbarItemDialog.openInNewTab')}
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.saveChanges') : t('website.navbarItemDialog.addItem')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
