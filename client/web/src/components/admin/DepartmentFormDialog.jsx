import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldOff, ShieldCheck } from 'lucide-react';

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
import * as departmentsService from '../../services/departmentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';

const inputClass =
  'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = { name: '', description: '' };

/**
 * Create/edit dialog for the Departments catalog
 * (`server/src/modules/departments`). Same shape as
 * `RoleFormDialog.jsx` (FET-05): `department` null → create,
 * otherwise edit-in-place with a deactivate/reactivate toggle
 * (soft-delete, same convention as the medicine catalog — never a
 * hard delete).
 */
export default function DepartmentFormDialog({ open, onOpenChange, department, onSaved }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(department);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: department?.name || '',
      description: department?.description || '',
    });
    setError('');
  }, [open, department]);

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving && !togglingActive) {
      setForm(emptyForm);
      setError('');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() };
      if (isEdit) {
        await departmentsService.updateDepartment(department.id, payload);
      } else {
        await departmentsService.createDepartment(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const activating = !department.isActive;
    const ok = await confirm({
      title: activating ? t('departments.reactivateTitle', 'Reactivate this department?') : t('departments.deactivateTitle', 'Deactivate this department?'),
      description: activating
        ? t('departments.reactivateDescription', 'It will reappear in department pickers and lists.')
        : t('departments.deactivateDescription', 'It will stop appearing as an option for new staff assignments. Staff profiles that already reference it are unaffected.'),
      confirmLabel: activating ? t('common.reactivate', 'Reactivate') : t('common.deactivate', 'Deactivate'),
      variant: activating ? 'default' : 'destructive',
    });
    if (!ok) return;

    setTogglingActive(true);
    setError('');
    try {
      if (activating) {
        await departmentsService.reactivateDepartment(department.id);
      } else {
        await departmentsService.deactivateDepartment(department.id);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-lg">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{isEdit ? department.name : t('departments.addDepartment', 'Add department')}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? t('departments.editDescription', 'Rename or update this department. It stays linked to any staff profile that already references it.')
                : t('departments.createDescription', 'Departments appear as an option when adding or editing a staff profile.')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <label className={labelClass}>{t('departments.fieldName', 'Department name')}</label>
              <input
                required
                minLength={2}
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t('departments.colDescription', 'Description')}</label>
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className={isEdit ? 'sm:justify-between' : undefined}>
            {isEdit ? (
              <Button
                type="button"
                variant={department.isActive ? 'destructive' : 'default'}
                size="sm"
                onClick={handleToggleActive}
                disabled={saving || togglingActive}
                className="sm:mr-auto"
              >
                {department.isActive ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                {togglingActive ? t('common.pleaseWait', 'Please wait…') : department.isActive ? t('common.deactivate', 'Deactivate') : t('common.reactivate', 'Reactivate')}
              </Button>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleClose(false)}
                disabled={saving || togglingActive}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={saving || togglingActive}>
                {saving ? t('common.saving', 'Saving…') : isEdit ? t('common.saveChanges', 'Save changes') : t('departments.addDepartment', 'Add department')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
