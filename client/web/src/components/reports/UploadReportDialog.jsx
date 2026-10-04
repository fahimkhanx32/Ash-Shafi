import { useEffect, useRef, useState } from 'react';
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
import * as reportsService from '../../services/reportsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { REPORT_TYPES, REPORT_TYPE_BY_CATEGORY, reportTypeLabel } from '../../constants/reports.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

/**
 * FET-11 — "Upload" (Files). Uploads a `MedicalReport` document
 * (BET-12) as authenticated `multipart/form-data`, exactly the shape
 * `receiveReportFile` on the backend requires (`file` field, plus the
 * body fields `uploadReportBodySchema` validates). Never guesses or
 * infers `reportType` from the file itself (the backend's own
 * docstring is explicit that a mis-inferred type would silently
 * steer the OCR/extraction parser down the wrong path) — this dialog
 * only pre-selects a sensible default from the linked investigation's
 * category, which the uploader can always change.
 *
 * FET-17 — fully localized; both client-side validation messages
 * resolve through `validation.clinical.*`.
 */
export default function UploadReportDialog({ open, onOpenChange, patientProfileId, investigation = null, onUploaded }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [performingFacility, setPerformingFacility] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setFile(null);
      setError('');
      setTitle(investigation?.name || '');
      setReportType((investigation && REPORT_TYPE_BY_CATEGORY[investigation.category]) || 'LABORATORY');
      setReportDate('');
      setPerformingFacility('');
      setClinicalIndication(investigation?.clinicalIndication || '');
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open, investigation]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!file) {
      setError(t('validation.clinical.fileRequired', 'Choose a file to upload.'));
      return;
    }
    if (!title.trim()) {
      setError(t('validation.clinical.reportTitleRequired', 'A report title is required.'));
      return;
    }
    setSaving(true);
    try {
      const saved = await reportsService.uploadReport(file, {
        patientProfileId,
        investigationId: investigation?.id || '',
        reportType,
        title: title.trim(),
        clinicalIndication,
        reportDate: reportDate || '',
        performingFacility,
      });
      onUploaded?.(saved);
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
        <DialogTitle>{t('clinical.report.upload')}</DialogTitle>
        <DialogDescription>
          {investigation
            ? t('clinical.report.linkedToInvestigation', { name: investigation.name, defaultValue: 'Linked to "{{name}}"' })
            : t('clinical.report.uploadHint')}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div>
          <label className={labelClass}>{t('clinical.report.file')}</label>
          <input
            ref={fileRef}
            type="file"
            className="w-full text-sm"
            disabled={saving}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('clinical.report.titleColumn')}</label>
            <input className={inputClass} value={title} disabled={saving} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className={labelClass}>{t('clinical.report.type')}</label>
            <select className={inputClass} value={reportType} disabled={saving} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {reportTypeLabel(type, t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('clinical.report.reportDate')}</label>
            <input type="date" className={inputClass} value={reportDate} disabled={saving} onChange={(e) => setReportDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t('clinical.report.performingFacility')}</label>
            <input className={inputClass} value={performingFacility} disabled={saving} onChange={(e) => setPerformingFacility(e.target.value)} maxLength={200} />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('clinical.investigation.clinicalIndication')}</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={clinicalIndication}
            disabled={saving}
            onChange={(e) => setClinicalIndication(e.target.value)}
            maxLength={500}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t('clinical.report.uploading') : t('clinical.report.upload')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
