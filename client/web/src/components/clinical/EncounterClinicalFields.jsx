import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui/button.jsx';

const inputClass =
  'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium space-y-1';

const numOrNull = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

/**
 * FET-08 — Consultation & Clinical Encounters.
 *
 * Every clinical field the `Encounter` model (BET-09) accepts:
 * chief complaint, examination findings, vitals, diagnoses (a
 * dynamic list, edited in-place — unlike gynecology/pregnancy's
 * `ArrayRecordSection`, an encounter's `diagnoses` is a plain
 * embedded array saved as part of the encounter document itself,
 * not a separate sub-resource endpoint, so it's edited as ordinary
 * component state here), clinical findings, assessment, treatment
 * plan, instructions, and follow-up.
 *
 * Purely controlled — `value`/`onChange` — so the same component
 * drives the "new consultation" create form, the draft editor, and
 * (read-only, `disabled`) a finalized encounter's display, without
 * three separate implementations.
 */
export default function EncounterClinicalFields({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  const set = (field) => (fieldValue) => onChange({ ...value, [field]: fieldValue });
  const setVitals = (field) => (event) =>
    onChange({ ...value, vitals: { ...value.vitals, [field]: numOrNull(event.target.value) } });
  const setFollowUp = (field) => (fieldValue) =>
    onChange({ ...value, followUp: { ...value.followUp, [field]: fieldValue } });

  const addDiagnosis = () => {
    onChange({
      ...value,
      diagnoses: [...(value.diagnoses || []), { description: '', code: '', type: 'PRIMARY' }],
    });
  };

  const updateDiagnosis = (index, field, fieldValue) => {
    const next = [...(value.diagnoses || [])];
    next[index] = { ...next[index], [field]: fieldValue };
    onChange({ ...value, diagnoses: next });
  };

  const removeDiagnosis = (index) => {
    const next = [...(value.diagnoses || [])];
    next.splice(index, 1);
    onChange({ ...value, diagnoses: next });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          {t('clinical.encounter.chiefComplaint')}
          <textarea
            rows={2}
            disabled={disabled}
            className={textareaClass}
            value={value.chiefComplaint}
            onChange={(e) => set('chiefComplaint')(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          {t('clinical.encounter.examinationFindings')}
          <textarea
            rows={2}
            disabled={disabled}
            className={textareaClass}
            value={value.examinationFindings}
            onChange={(e) => set('examinationFindings')(e.target.value)}
          />
        </label>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">{t('clinical.encounter.vitalsHeading')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className={labelClass}>
            {t('clinical.encounter.bpSystolic')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.bloodPressureSystolic ?? ''}
              onChange={setVitals('bloodPressureSystolic')}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.bpDiastolic')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.bloodPressureDiastolic ?? ''}
              onChange={setVitals('bloodPressureDiastolic')}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.pulse')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.pulseBpm ?? ''}
              onChange={setVitals('pulseBpm')}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.temperature')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.temperatureCelsius ?? ''}
              onChange={setVitals('temperatureCelsius')}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.weight')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.weightKg ?? ''}
              onChange={setVitals('weightKg')}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.height')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.heightCm ?? ''}
              onChange={setVitals('heightCm')}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.respRate')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.respiratoryRate ?? ''}
              onChange={setVitals('respiratoryRate')}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.spo2')}
            <input
              type="number"
              disabled={disabled}
              className={inputClass}
              value={value.vitals?.oxygenSaturationPercent ?? ''}
              onChange={setVitals('oxygenSaturationPercent')}
            />
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">{t('clinical.encounter.diagnosesHeading')}</div>
          {!disabled ? (
            <Button type="button" variant="outline" size="sm" onClick={addDiagnosis}>
              <Plus size={14} /> {t('clinical.encounter.addDiagnosis')}
            </Button>
          ) : null}
        </div>
        {(value.diagnoses || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('clinical.encounter.noDiagnoses')}</p>
        ) : (
          <div className="space-y-2">
            {value.diagnoses.map((diagnosis, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={diagnosis._id || index} className="flex flex-wrap items-start gap-2 rounded-lg border border-border p-3">
                <input
                  disabled={disabled}
                  placeholder={t('clinical.encounter.diagnosisDescriptionPlaceholder')}
                  className={`${inputClass} flex-1 min-w-[180px]`}
                  value={diagnosis.description}
                  onChange={(e) => updateDiagnosis(index, 'description', e.target.value)}
                />
                <input
                  disabled={disabled}
                  placeholder={t('clinical.encounter.diagnosisCodePlaceholder')}
                  className={`${inputClass} w-32`}
                  value={diagnosis.code}
                  onChange={(e) => updateDiagnosis(index, 'code', e.target.value)}
                />
                <select
                  disabled={disabled}
                  className={`${inputClass} w-36`}
                  value={diagnosis.type}
                  onChange={(e) => updateDiagnosis(index, 'type', e.target.value)}
                >
                  <option value="PRIMARY">{t('clinical.encounter.diagnosisTypePrimary')}</option>
                  <option value="SECONDARY">{t('clinical.encounter.diagnosisTypeSecondary')}</option>
                </select>
                {!disabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('clinical.encounter.removeDiagnosis')}
                    onClick={() => removeDiagnosis(index)}
                  >
                    <Trash2 size={16} />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          {t('clinical.encounter.clinicalFindings')}
          <textarea
            rows={2}
            disabled={disabled}
            className={textareaClass}
            value={value.clinicalFindings}
            onChange={(e) => set('clinicalFindings')(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          {t('clinical.encounter.assessment')}
          <textarea
            rows={2}
            disabled={disabled}
            className={textareaClass}
            value={value.assessment}
            onChange={(e) => set('assessment')(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          {t('clinical.encounter.treatmentPlan')}
          <textarea
            rows={2}
            disabled={disabled}
            className={textareaClass}
            value={value.treatmentPlan}
            onChange={(e) => set('treatmentPlan')(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          {t('clinical.encounter.instructions')}
          <textarea
            rows={2}
            disabled={disabled}
            className={textareaClass}
            value={value.instructions}
            onChange={(e) => set('instructions')(e.target.value)}
          />
        </label>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">{t('clinical.encounter.followUpHeading')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <label className="text-xs font-medium space-y-1 flex flex-col justify-end">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={disabled}
                checked={Boolean(value.followUp?.required)}
                onChange={(e) => setFollowUp('required')(e.target.checked)}
              />
              {t('clinical.encounter.followUpRequired')}
            </span>
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.followUpDate')}
            <input
              type="date"
              disabled={disabled || !value.followUp?.required}
              className={inputClass}
              value={value.followUp?.date ? String(value.followUp.date).slice(0, 10) : ''}
              onChange={(e) => setFollowUp('date')(e.target.value || null)}
            />
          </label>
          <label className={labelClass}>
            {t('clinical.encounter.followUpNotes')}
            <input
              disabled={disabled}
              className={inputClass}
              value={value.followUp?.notes || ''}
              onChange={(e) => setFollowUp('notes')(e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
