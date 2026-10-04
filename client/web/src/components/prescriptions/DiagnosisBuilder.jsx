import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.jsx';

const COMMON_DIAGNOSES = [
  'CKD STAGE V-D',
  'DM (Diabetes Mellitus)',
  'HTN (Hypertension)',
  'ADPKD (Autosomal Dominant Polycystic Kidney Disease)',
  'Hypothyroidism',
  'Nephrotic Syndrome',
  'Acute Kidney Injury (AKI)',
  'Glomerulonephritis',
  'Urinary Tract Infection (UTI)',
  'Renal Stone / Nephrolithiasis',
  'Ischemic Heart Disease (IHD)',
  'Dyslipidemia',
];

const generateId = () => `diag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function DiagnosisBuilder({ diagnoses = [], onChange, disabled = false }) {
  const { t } = useTranslation();
  const [customText, setCustomText] = useState('');

  const addDiagnosis = (name) => {
    if (!name || !name.trim()) return;
    const item = {
      id: generateId(),
      name: name.trim(),
      code: '',
      type: 'PRIMARY',
      displayOrder: diagnoses.length + 1,
    };
    onChange([...diagnoses, item]);
    setCustomText('');
  };

  const updateDiagnosis = (index, patch) => {
    const next = diagnoses.map((d, i) => (i === index ? { ...d, ...patch } : d));
    onChange(next);
  };

  const removeDiagnosis = (index) => {
    const next = diagnoses.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveDiagnosis = (from, to) => {
    if (to < 0 || to >= diagnoses.length) return;
    const next = [...diagnoses];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-1.5">
        <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
          <Stethoscope size={15} className="text-primary" />
          <span>{t('clinical.prescription.diagnoses', 'Diagnosis')}</span>
          <span className="text-[10px] text-muted-foreground">({diagnoses.length})</span>
        </div>
      </div>

      {/* Preset Quick Chips */}
      {!disabled && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            {t('clinical.prescription.frequentDiagnoses', 'Quick Select Common Diagnoses:')}
          </span>
          <div className="flex flex-wrap gap-1">
            {COMMON_DIAGNOSES.map((diag) => {
              const alreadyAdded = diagnoses.some((d) => d.name?.toLowerCase() === diag.toLowerCase());
              return (
                <button
                  key={diag}
                  type="button"
                  disabled={alreadyAdded}
                  className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors ${
                    alreadyAdded
                      ? 'bg-muted text-muted-foreground/50 border-border cursor-not-allowed'
                      : 'bg-card hover:bg-accent hover:border-primary text-foreground border-border'
                  }`}
                  onClick={() => addDiagnosis(diag)}
                >
                  + {diag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Diagnosis Input Bar */}
      {!disabled && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('clinical.prescription.customDiagnosisPlaceholder', 'Type diagnosis and press Enter or Add...')}
            className="w-full h-8 px-3 rounded-lg border border-border bg-background text-xs"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDiagnosis(customText);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => addDiagnosis(customText)}
            disabled={!customText.trim()}
          >
            <Plus size={13} /> {t('common.add', 'Add')}
          </Button>
        </div>
      )}

      {/* Active Diagnoses List */}
      <div className="space-y-1.5">
        {diagnoses.map((diag, index) => (
          <div
            key={diag.id || diag._id || `diag_${index}`}
            className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-card shadow-xs text-xs"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-bold text-muted-foreground text-[10px]">{index + 1}.</span>
              <input
                type="text"
                disabled={disabled}
                className="w-full bg-transparent border-0 font-medium text-foreground text-xs p-0 focus:ring-0"
                value={diag.name}
                onChange={(e) => updateDiagnosis(index, { name: e.target.value })}
              />
            </div>

            {!disabled && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  disabled={index === 0}
                  onClick={() => moveDiagnosis(index, index - 1)}
                >
                  <ArrowUp size={11} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  disabled={index === diagnoses.length - 1}
                  onClick={() => moveDiagnosis(index, index + 1)}
                >
                  <ArrowDown size={11} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeDiagnosis(index)}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
