import { useEffect, useState } from 'react';
import { ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
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
import * as medicinesService from '../../services/medicinesService.js';
import { extractApiError } from '../../services/apiClient.js';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { ROLES } from '../../constants/roles.js';
import {
  DOSAGE_FORMS,
  ROUTES,
  VERIFICATION_STATUSES,
  dosageFormLabel,
  routeLabel,
  verificationStatusLabel,
} from '../../constants/prescriptions.js';

const inputClass =
  'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

// Multi-value clinical-reference fields (indications, contraindications,
// warnings, adverse effects, interactions) are arrays of strings on the
// backend model (`medicine.model.js`) — edited here as one line per
// entry rather than a repeating-row editor, since these are short
// reference notes, not structured records the way prescription items
// are (`PrescriptionItemsEditor.jsx`).
const toLines = (arr) => (Array.isArray(arr) ? arr.join('\n') : '');
const fromLines = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const toDraft = (medicine) => ({
  genericName: medicine?.genericName || '',
  brandName: medicine?.brandName || '',
  manufacturer: medicine?.manufacturer || '',
  strength: medicine?.strength || '',
  unit: medicine?.unit || '',
  dosageForm: medicine?.dosageForm || 'OTHER',
  route: medicine?.route || 'ORAL',
  price: medicine?.price ?? '',
  currency: medicine?.currency || 'BDT',
  verificationStatus: medicine?.verificationStatus || 'UNVERIFIED',
  indications: toLines(medicine?.indications),
  contraindications: toLines(medicine?.contraindications),
  warnings: toLines(medicine?.warnings),
  adverseEffects: toLines(medicine?.adverseEffects),
  interactions: toLines(medicine?.interactions),
  notes: medicine?.notes || '',
});

/**
 * FET-10 — "Medicine details" / catalog management. Create/edit a
 * `Medicine` reference-data document (`server/src/modules/medicines`,
 * BET-11). Same shape as `DepartmentFormDialog.jsx`: `medicine` null →
 * create, otherwise edit-in-place with a deactivate/reactivate
 * soft-delete toggle rather than a hard delete — a medicine that's
 * already been prescribed must stay resolvable in prescription
 * history even after it's retired from the active picker
 * (`PrescriptionItemsEditor.jsx`'s `MedicineSearchField` only searches
 * `isActive: true`).
 */
export default function MedicineFormDialog({ open, onOpenChange, medicine, onSaved }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState(() => toDraft(medicine));
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(medicine);
  const isSuperOrOwner = currentUser?.role === ROLES.SOFTWARE_OWNER || currentUser?.role === ROLES.SUPER_ADMIN;

  useEffect(() => {
    if (open) {
      setForm(toDraft(medicine));
      setError('');
    }
  }, [open, medicine]);

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const handleClose = (nextOpen) => {
    if (!nextOpen && (saving || togglingActive)) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        genericName: form.genericName.trim(),
        brandName: form.brandName.trim(),
        manufacturer: form.manufacturer.trim(),
        strength: form.strength.trim(),
        unit: form.unit.trim(),
        dosageForm: form.dosageForm,
        route: form.route,
        price: form.price === '' ? null : Number(form.price),
        currency: form.currency.trim() || 'BDT',
        verificationStatus: form.verificationStatus,
        indications: fromLines(form.indications),
        contraindications: fromLines(form.contraindications),
        warnings: fromLines(form.warnings),
        adverseEffects: fromLines(form.adverseEffects),
        interactions: fromLines(form.interactions),
        notes: form.notes.trim(),
      };
      if (isEdit) {
        await medicinesService.updateMedicine(medicine.id, payload);
      } else {
        await medicinesService.createMedicine(payload);
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
    const activating = !medicine.isActive;
    const ok = await confirm({
      title: activating ? t('clinical.medicine.confirmReactivateTitle') : t('clinical.medicine.confirmDeactivateTitle'),
      description: activating
        ? t('clinical.medicine.confirmReactivateDescription')
        : t('clinical.medicine.confirmDeactivateDescription'),
      confirmLabel: activating ? t('clinical.medicine.reactivate') : t('clinical.medicine.deactivate'),
      variant: activating ? 'default' : 'destructive',
    });
    if (!ok) return;

    setTogglingActive(true);
    setError('');
    try {
      if (activating) {
        await medicinesService.reactivateMedicine(medicine.id);
      } else {
        await medicinesService.deactivateMedicine(medicine.id);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setTogglingActive(false);
    }
  };

  const handleSoftDelete = async () => {
    const ok = await confirm({
      title: t('clinical.medicine.confirmDeleteTitle', 'Delete medicine {{name}}?', { name: medicine.genericName }),
      description: t(
        'clinical.medicine.confirmDeleteDescription',
        'This will archive and hide the medicine from the active prescription builder. Owner and Super Admin can view, restore, or purge it.',
      ),
      confirmLabel: t('clinical.medicine.delete', 'Delete medicine'),
      variant: 'destructive',
    });
    if (!ok) return;

    setDeleting(true);
    setError('');
    try {
      await medicinesService.softDeleteMedicine(medicine.id);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleHardDelete = async () => {
    const ok = await confirm({
      title: t('clinical.medicine.confirmHardDeleteTitle', '⚠️ Permanently delete {{name}}?', { name: medicine.genericName }),
      description: t(
        'clinical.medicine.confirmHardDeleteDescription',
        'This action is IRREVERSIBLE. It physically removes the medicine from the database collection. Historical prescriptions with this medicine snapshot will keep their text.',
      ),
      confirmLabel: t('clinical.medicine.hardDelete', 'Yes, permanently delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    setDeleting(true);
    setError('');
    try {
      await medicinesService.hardDeleteMedicine(medicine.id);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-2xl">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{isEdit ? medicine.genericName : t('clinical.medicine.addMedicine')}</DialogTitle>
            <DialogDescription>
              {isEdit ? t('clinical.medicine.editDescription') : t('clinical.medicine.addDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>{t('clinical.prescription.genericName')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.genericName}
                  disabled={saving}
                  onChange={set('genericName')}
                  maxLength={200}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>{t('clinical.prescription.brandName')}</label>
                <input
                  className={inputClass}
                  value={form.brandName}
                  disabled={saving}
                  onChange={set('brandName')}
                  maxLength={200}
                />
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.manufacturer')}</label>
                <input
                  className={inputClass}
                  value={form.manufacturer}
                  disabled={saving}
                  onChange={set('manufacturer')}
                  maxLength={200}
                />
              </div>
              <div>
                <label className={labelClass}>{t('clinical.prescription.strength')}</label>
                <input
                  className={inputClass}
                  placeholder={t('clinical.medicine.strengthPlaceholder')}
                  value={form.strength}
                  disabled={saving}
                  onChange={set('strength')}
                  maxLength={60}
                />
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.unit')}</label>
                <input
                  className={inputClass}
                  placeholder={t('clinical.medicine.unitPlaceholder')}
                  list="medicine-unit-options"
                  value={form.unit}
                  disabled={saving}
                  onChange={set('unit')}
                  maxLength={20}
                />
                {/* Suggestions only, not a hard enum — same free-text
                    reasoning documented on the backend model: real-world
                    units are too varied to constrain to a fixed list. */}
                <datalist id="medicine-unit-options">
                  <option value="mg" />
                  <option value="mcg" />
                  <option value="g" />
                  <option value="mL" />
                  <option value="L" />
                  <option value="IU" />
                  <option value="%" />
                  <option value="mg/mL" />
                </datalist>
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.dosageFormLabel')}</label>
                <select className={inputClass} value={form.dosageForm} disabled={saving} onChange={set('dosageForm')}>
                  {DOSAGE_FORMS.map((value) => (
                    <option key={value} value={value}>
                      {dosageFormLabel(value, t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.routeLabel')}</label>
                <select className={inputClass} value={form.route} disabled={saving} onChange={set('route')}>
                  {ROUTES.map((value) => (
                    <option key={value} value={value}>
                      {routeLabel(value, t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.price')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={form.price}
                  disabled={saving}
                  onChange={set('price')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.currency')}</label>
                <input
                  className={inputClass}
                  value={form.currency}
                  disabled={saving}
                  onChange={set('currency')}
                  maxLength={10}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>{t('clinical.medicine.verificationStatusLabel')}</label>
                <select
                  className={inputClass}
                  value={form.verificationStatus}
                  disabled={saving}
                  onChange={set('verificationStatus')}
                >
                  {VERIFICATION_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {verificationStatusLabel(value, t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('clinical.medicine.indications')}</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.indications}
                  disabled={saving}
                  onChange={set('indications')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.contraindications')}</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.contraindications}
                  disabled={saving}
                  onChange={set('contraindications')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.warnings')}</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.warnings}
                  disabled={saving}
                  onChange={set('warnings')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('clinical.medicine.adverseEffects')}</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={form.adverseEffects}
                  disabled={saving}
                  onChange={set('adverseEffects')}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>{t('clinical.medicine.interactions')}</label>
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.interactions}
                  disabled={saving}
                  onChange={set('interactions')}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t('clinical.fields.notes')}</label>
              <textarea
                className={textareaClass}
                rows={2}
                value={form.notes}
                disabled={saving}
                onChange={set('notes')}
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter className={isEdit ? 'sm:justify-between' : undefined}>
            {isEdit ? (
              <div className="flex flex-wrap items-center gap-2 sm:mr-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  disabled={saving || togglingActive || deleting}
                >
                  {medicine.isActive ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                  {togglingActive ? t('clinical.medicine.pleaseWait') : medicine.isActive ? t('clinical.medicine.deactivate') : t('clinical.medicine.reactivate')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleSoftDelete}
                  disabled={saving || togglingActive || deleting}
                  title="Soft delete (archive)"
                >
                  <Trash2 size={14} />
                  {t('clinical.medicine.delete', 'Delete')}
                </Button>
                {isSuperOrOwner ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="bg-red-700 hover:bg-red-800"
                    onClick={handleHardDelete}
                    disabled={saving || togglingActive || deleting}
                    title="Permanently remove from database (Owner / Super Admin only)"
                  >
                    <Trash2 size={14} />
                    {t('clinical.medicine.purge', 'Purge')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleClose(false)}
                disabled={saving || togglingActive || deleting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={saving || togglingActive || deleting}>
                {saving ? t('common.saving') : isEdit ? t('clinical.medicine.saveChanges') : t('clinical.medicine.addMedicine')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
