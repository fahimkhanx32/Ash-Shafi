import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.jsx';

const COMMON_TESTS = [
  'CBC (Complete Blood Count)',
  'Serum Creatinine',
  'Serum Electrolytes (Na+, K+, Cl-, HCO3-)',
  'BUN (Blood Urea Nitrogen)',
  'Serum Calcium (Ca++)',
  'TSH (Thyroid Stimulating Hormone)',
  'USG of Whole Abdomen with PVR',
  'Urine R/M/E',
  'Urine C/S (Culture & Sensitivity)',
  'Echocardiogram',
  'HbA1c',
  'Lipid Profile',
  'Serum Uric Acid',
  'X-Ray Chest P/A View',
];

const generateId = () => `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function InvestigationBuilder({ investigations = [], onChange, disabled = false }) {
  const { t } = useTranslation();
  const [customTest, setCustomTest] = useState('');
  const [testNotes, setTestNotes] = useState('');

  const addTest = (name, notes = '') => {
    if (!name || !name.trim()) return;
    const item = {
      id: generateId(),
      testName: name.trim(),
      category: 'INVESTIGATION',
      cost: 0,
      currency: 'BDT',
      notes: notes.trim(),
      isCustom: true,
      displayOrder: investigations.length + 1,
    };
    onChange([...investigations, item]);
    setCustomTest('');
    setTestNotes('');
  };

  const updateTest = (index, patch) => {
    const next = investigations.map((inv, i) => (i === index ? { ...inv, ...patch } : inv));
    onChange(next);
  };

  const removeTest = (index) => {
    const next = investigations.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveTest = (from, to) => {
    if (to < 0 || to >= investigations.length) return;
    const next = [...investigations];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-1.5">
        <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
          <FlaskConical size={15} className="text-amber-500" />
          <span>{t('clinical.prescription.investigations', 'Investigations / Tests')}</span>
          <span className="text-[10px] text-muted-foreground">({investigations.length})</span>
        </div>
      </div>

      {/* Preset Quick Chips */}
      {!disabled && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            {t('clinical.prescription.frequentTests', 'Quick Select Common Investigations:')}
          </span>
          <div className="flex flex-wrap gap-1">
            {COMMON_TESTS.map((test) => {
              const alreadyAdded = investigations.some((inv) => (inv.testName || inv.name)?.toLowerCase() === test.toLowerCase());
              return (
                <button
                  key={test}
                  type="button"
                  disabled={alreadyAdded}
                  className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors ${
                    alreadyAdded
                      ? 'bg-muted text-muted-foreground/50 border-border cursor-not-allowed'
                      : 'bg-card hover:bg-accent hover:border-primary text-foreground border-border'
                  }`}
                  onClick={() => addTest(test)}
                >
                  + {test}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Test Input Bar */}
      {!disabled && (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-7">
            <input
              type="text"
              placeholder={t('clinical.prescription.customTestPlaceholder', 'Type investigation / test name...')}
              className="w-full h-8 px-3 rounded-lg border border-border bg-background text-xs"
              value={customTest}
              onChange={(e) => setCustomTest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTest(customTest, testNotes);
                }
              }}
            />
          </div>
          <div className="sm:col-span-3">
            <input
              type="text"
              placeholder={t('clinical.prescription.testNotesPlaceholder', 'Notes / instruction...')}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
              value={testNotes}
              onChange={(e) => setTestNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTest(customTest, testNotes);
                }
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              size="sm"
              className="w-full h-8 px-2 text-xs"
              onClick={() => addTest(customTest, testNotes)}
              disabled={!customTest.trim()}
            >
              <Plus size={13} /> {t('common.add', 'Add')}
            </Button>
          </div>
        </div>
      )}

      {/* Active Investigations List */}
      <div className="space-y-1.5">
        {investigations.map((inv, index) => (
          <div
            key={inv.id || inv._id || `inv_${index}`}
            className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-card shadow-xs text-xs"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-bold text-muted-foreground text-[10px]">{index + 1}.</span>
              <input
                type="text"
                disabled={disabled}
                className="w-full bg-transparent border-0 font-medium text-foreground text-xs p-0 focus:ring-0"
                value={inv.testName || inv.name || ''}
                onChange={(e) => updateTest(index, { testName: e.target.value, name: e.target.value })}
              />
              <input
                type="text"
                disabled={disabled}
                placeholder="Optional notes"
                className="w-48 bg-muted/30 rounded px-1.5 py-0.5 border border-border/50 text-[11px] text-muted-foreground"
                value={inv.notes || ''}
                onChange={(e) => updateTest(index, { notes: e.target.value })}
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
                  onClick={() => moveTest(index, index - 1)}
                >
                  <ArrowUp size={11} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  disabled={index === investigations.length - 1}
                  onClick={() => moveTest(index, index + 1)}
                >
                  <ArrowDown size={11} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTest(index)}
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
