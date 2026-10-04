import { useTranslation } from 'react-i18next';
import { Activity, Clock } from 'lucide-react';
import { formatDate } from '../../lib/dateFormat.js';

/**
 * Top-level VitalsEditor component.
 * Structured fields for BP, Pulse, Weight, Temperature, SpO2 with individual timestamps.
 */
export default function VitalsEditor({ value = {}, onChange, disabled = false }) {
  const { t } = useTranslation();

  const updateVital = (field, key, val) => {
    const current = value[field] || {};
    onChange({
      ...value,
      [field]: {
        ...current,
        [key]: val,
        recordedAt: current.recordedAt || new Date(),
      },
    });
  };

  const updateTimestamp = (field) => {
    const current = value[field] || {};
    onChange({
      ...value,
      [field]: {
        ...current,
        recordedAt: new Date(),
      },
    });
  };

  const bp = value.bloodPressure || {};
  const pulse = value.pulse || {};
  const weight = value.weight || {};
  const height = value.height || {};
  const temp = value.temperature || {};
  const spo2 = value.spo2 || {};

  // Live-computed for display only — the authoritative BMI snapshot is
  // recalculated server-side (see prescription.model.js `computeBMI`)
  // whenever the prescription is saved, so this preview can never drift
  // from what actually gets persisted.
  const bmiValue = (() => {
    const w = Number(weight.value);
    const h = Number(height.value);
    if (!w || !h || w <= 0 || h <= 0) return null;
    const heightM = h / 100;
    return Math.round((w / (heightM * heightM)) * 10) / 10;
  })();
  const bmiCategory = (() => {
    if (bmiValue === null) return '';
    if (bmiValue < 18.5) return t('clinical.prescription.bmiUnderweight', 'Underweight');
    if (bmiValue < 25) return t('clinical.prescription.bmiNormal', 'Normal');
    if (bmiValue < 30) return t('clinical.prescription.bmiOverweight', 'Overweight');
    return t('clinical.prescription.bmiObese', 'Obese');
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-semibold text-xs text-foreground border-b border-border pb-1.5">
        <Activity size={15} className="text-rose-500" />
        <span>{t('clinical.prescription.onExaminationsVitals', 'On Examinations / Vitals')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {/* Blood Pressure */}
        <div className="rounded-xl border border-border p-3 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('clinical.encounter.bp', 'Blood Pressure (BP)')}
            </label>
            {!disabled && (bp.systolic || bp.diastolic) ? (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                onClick={() => updateTimestamp('bloodPressure')}
                title="Update timestamp to now"
              >
                <Clock size={10} /> {bp.recordedAt ? formatDate(bp.recordedAt) : 'Now'}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <input
              type="number"
              disabled={disabled}
              placeholder="Sys"
              title="Systolic (e.g. 120)"
              className="flex-1 min-w-[48px] h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold text-center focus:ring-1 focus:ring-primary"
              value={bp.systolic ?? ''}
              onChange={(e) => updateVital('bloodPressure', 'systolic', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-muted-foreground font-bold shrink-0">/</span>
            <input
              type="number"
              disabled={disabled}
              placeholder="Dia"
              title="Diastolic (e.g. 80)"
              className="flex-1 min-w-[48px] h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold text-center focus:ring-1 focus:ring-primary"
              value={bp.diastolic ?? ''}
              onChange={(e) => updateVital('bloodPressure', 'diastolic', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium shrink-0">mmHg</span>
          </div>
        </div>

        {/* Pulse */}
        <div className="rounded-xl border border-border p-3 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('clinical.encounter.pulse', 'Pulse Rate')}
            </label>
            {!disabled && pulse.value ? (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                onClick={() => updateTimestamp('pulse')}
                title="Update timestamp to now"
              >
                <Clock size={10} /> {pulse.recordedAt ? formatDate(pulse.recordedAt) : 'Now'}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              disabled={disabled}
              placeholder="e.g. 78"
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold"
              value={pulse.value ?? ''}
              onChange={(e) => updateVital('pulse', 'value', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium shrink-0">b/min</span>
          </div>
        </div>

        {/* Oxygen Saturation (SpO2) */}
        <div className="rounded-xl border border-border p-3 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <span>{t('clinical.encounter.spo2', 'Oxygen (SpO2)')}</span>
            </label>
            {!disabled && spo2.value ? (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                onClick={() => updateTimestamp('spo2')}
                title="Update timestamp to now"
              >
                <Clock size={10} /> {spo2.recordedAt ? formatDate(spo2.recordedAt) : 'Now'}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              max="100"
              disabled={disabled}
              placeholder="e.g. 98"
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold"
              value={spo2.value ?? ''}
              onChange={(e) => updateVital('spo2', 'value', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium shrink-0">%</span>
          </div>
        </div>

        {/* Temperature */}
        <div className="rounded-xl border border-border p-3 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('clinical.encounter.temp', 'Temperature')}
            </label>
            {!disabled && temp.value ? (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                onClick={() => updateTimestamp('temperature')}
                title="Update timestamp to now"
              >
                <Clock size={10} /> {temp.recordedAt ? formatDate(temp.recordedAt) : 'Now'}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.1"
              disabled={disabled}
              placeholder="e.g. 98.4"
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold"
              value={temp.value ?? ''}
              onChange={(e) => updateVital('temperature', 'value', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium shrink-0">°F</span>
          </div>
        </div>

        {/* Weight */}
        <div className="rounded-xl border border-border p-3 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('clinical.encounter.weight', 'Weight')}
            </label>
            {!disabled && weight.value ? (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                onClick={() => updateTimestamp('weight')}
                title="Update timestamp to now"
              >
                <Clock size={10} /> {weight.recordedAt ? formatDate(weight.recordedAt) : 'Now'}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.1"
              disabled={disabled}
              placeholder="e.g. 65"
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold"
              value={weight.value ?? ''}
              onChange={(e) => updateVital('weight', 'value', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium shrink-0">kg</span>
          </div>
        </div>

        {/* Height */}
        <div className="rounded-xl border border-border p-3 bg-card space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('clinical.encounter.height', 'Height')}
            </label>
            {!disabled && height.value ? (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                onClick={() => updateTimestamp('height')}
                title="Update timestamp to now"
              >
                <Clock size={10} /> {height.recordedAt ? formatDate(height.recordedAt) : 'Now'}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.1"
              disabled={disabled}
              placeholder="e.g. 165"
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold"
              value={height.value ?? ''}
              onChange={(e) => updateVital('height', 'value', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium shrink-0">cm</span>
          </div>
        </div>

        {/* BMI — derived, read-only preview (authoritative value is computed server-side on save) */}
        <div className="rounded-xl border border-border p-3 bg-card space-y-1.5 shadow-xs">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t('clinical.encounter.bmi', 'BMI')}
          </label>
          <div className="flex items-center gap-1.5">
            <div className="w-full h-8 px-2.5 rounded-lg border border-dashed border-border bg-muted/40 text-xs font-semibold flex items-center">
              {bmiValue !== null ? bmiValue.toFixed(1) : '—'}
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium shrink-0 min-w-[70px]">
              {bmiCategory || (t('clinical.prescription.bmiNeedsInputs', 'kg/m²'))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
