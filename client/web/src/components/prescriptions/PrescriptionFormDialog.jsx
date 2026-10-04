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
import PrescriptionItemsEditor from './PrescriptionItemsEditor.jsx';
import LabTestsEditor from './LabTestsEditor.jsx';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { emptyPrescriptionItem } from '../../constants/prescriptions.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const toDraft = (prescription) => ({
  encounter: prescription?.encounter || null,
  diagnosisSummary: prescription?.diagnosisSummary || '',
  items:
    prescription?.items?.length > 0
      ? prescription.items.map((item) => ({ ...item, durationValue: item.durationValue ?? '' }))
      : [emptyPrescriptionItem()],
  labTests: prescription?.labTests?.length > 0 ? prescription.labTests : [],
  generalInstructions: prescription?.generalInstructions || '',
  followUpDate: prescription?.followUpDate ? prescription.followUpDate.slice(0, 10) : '',
});

/**
 * FET-10 — "Prescription builder", "Draft/final states". Creates a
 * new `DRAFT` prescription (`patientProfileId` fixed, matching the
 * `encounter`/consultation write pattern from FET-08) or edits an
 * existing one still in `DRAFT` — the backend's `updatePrescription`
 * rejects anything else with `PRESCRIPTION_NOT_DRAFT`, so this dialog
 * is never shown for a `FINALIZED`/`SUPERSEDED` prescription
 * (`PrescriptionsTab`/`PrescriptionDetailDialog` route those into
 * `RevisePrescriptionDialog` instead).
 */
export default function PrescriptionFormDialog({
  open,
  onOpenChange,
  patientProfileId,
  prescription = null,
  onSaved,
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(prescription);
  const [form, setForm] = useState(() => toDraft(prescription));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(toDraft(prescription));
      setError('');
    }
  }, [open, prescription]);

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const handleSubmit = async (event, finalizeAfter = false) => {
    event.preventDefault();
    setError('');

    const items = form.items.filter((item) => item.genericName.trim());
    if (items.length === 0) {
      setError(t('clinical.prescription.addAtLeastOneError'));
      return;
    }

    const labTests = form.labTests
      .filter((test) => test.testName.trim())
      .map((test) => ({ ...test, cost: Number(test.cost) || 0 }));

    const payload = {
      diagnosisSummary: form.diagnosisSummary,
      items: items.map((item) => ({
        ...item,
        durationValue: item.durationValue === '' ? null : Number(item.durationValue),
      })),
      labTests,
      generalInstructions: form.generalInstructions,
      followUpDate: form.followUpDate || null,
    };

    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        saved = await prescriptionsService.updatePrescription(prescription.id, payload);
      } else {
        saved = await prescriptionsService.createPrescription(patientProfileId, payload);
      }
      if (finalizeAfter) {
        saved = await prescriptionsService.finalizePrescription(saved.id);
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)} className="max-w-2xl">
      <DialogCloseButton onClose={() => !saving && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{isEdit ? t('clinical.prescription.editDraftTitle') : t('clinical.prescription.newTitle')}</DialogTitle>
        <DialogDescription>{t('clinical.prescription.formDescription')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={(event) => handleSubmit(event, false)} className="mt-4 flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div>
          <label className={labelClass}>{t('clinical.prescription.diagnosisSummary')}</label>
          <input
            className={inputClass}
            value={form.diagnosisSummary}
            disabled={saving}
            onChange={set('diagnosisSummary')}
            maxLength={500}
          />
        </div>

        <div>
          <label className={labelClass}>{t('clinical.prescription.medicines')}</label>
          <PrescriptionItemsEditor
            items={form.items}
            disabled={saving}
            onChange={(items) => setForm((prev) => ({ ...prev, items }))}
          />
        </div>

        <div>
          <label className={labelClass}>{t('clinical.prescription.labTests')}</label>
          <LabTestsEditor
            labTests={form.labTests}
            disabled={saving}
            onChange={(labTests) => setForm((prev) => ({ ...prev, labTests }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('clinical.encounter.followUpDate')}</label>
            <input
              type="date"
              className={inputClass}
              value={form.followUpDate}
              disabled={saving}
              onChange={set('followUpDate')}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('clinical.prescription.generalInstructions')}</label>
          <textarea
            data-voice-field="generalInstructions"
            className={textareaClass}
            rows={2}
            value={form.generalInstructions}
            disabled={saving}
            onChange={set('generalInstructions')}
            maxLength={1000}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? t('common.saving') : t('clinical.prescription.saveDraft')}
          </Button>
          <Button type="button" onClick={(event) => handleSubmit(event, true)} disabled={saving}>
            {saving ? t('common.saving') : t('clinical.prescription.saveAndFinalize')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
