import { useState } from 'react';
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
import * as encountersService from '../../services/encountersService.js';
import { extractApiError } from '../../services/apiClient.js';
import EncounterClinicalFields from './EncounterClinicalFields.jsx';

const CLINICAL_FIELDS = [
  'chiefComplaint',
  'examinationFindings',
  'vitals',
  'diagnoses',
  'clinicalFindings',
  'assessment',
  'treatmentPlan',
  'instructions',
  'followUp',
];

const toFormValue = (encounter) => ({
  chiefComplaint: encounter.chiefComplaint || '',
  examinationFindings: encounter.examinationFindings || '',
  vitals: encounter.vitals || {},
  diagnoses: encounter.diagnoses || [],
  clinicalFindings: encounter.clinicalFindings || '',
  assessment: encounter.assessment || '',
  treatmentPlan: encounter.treatmentPlan || '',
  instructions: encounter.instructions || '',
  followUp: encounter.followUp || {},
});

/**
 * FET-08 — amend a FINALIZED encounter. Mirrors
 * `encounter.service.js`'s `amendEncounter` contract exactly: a
 * required `reason` plus the corrected clinical fields, applied on
 * top of an append-only `amendments` snapshot the backend keeps
 * automatically. This dialog never lets a finalized note be
 * silently rewritten — see `ConsultationPage`, which only ever
 * calls `updateEncounter` while `status === 'DRAFT'`.
 */
export default function AmendEncounterDialog({ open, onOpenChange, encounter, onAmended }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [fields, setFields] = useState(() => toFormValue(encounter));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClose = (nextOpen) => {
    if (nextOpen) {
      setFields(toFormValue(encounter));
      setReason('');
    }
    if (!saving) setError('');
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError(t('clinical.amendDialog.reasonRequiredError'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {};
      CLINICAL_FIELDS.forEach((field) => {
        payload[field] = fields[field];
      });
      const updated = await encountersService.amendEncounter(encounter._id || encounter.id, reason.trim(), payload);
      onAmended(updated);
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-2xl">
      <DialogCloseButton onClose={() => handleClose(false)} />
      <DialogHeader>
        <DialogTitle>{t('clinical.amendDialog.title')}</DialogTitle>
        <DialogDescription>{t('clinical.amendDialog.description')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <label className="text-xs font-medium space-y-1 block">
          {t('clinical.amendDialog.reasonLabel')}
          <textarea
            required
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <EncounterClinicalFields value={fields} onChange={setFields} disabled={saving} />

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? t('common.saving') : t('clinical.amendDialog.saveAmendment')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
