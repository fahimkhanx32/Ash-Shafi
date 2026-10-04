import { useState, useMemo } from 'react';
import { Search, Check, Plus, Trash2, Tag, CheckSquare, Square, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const COMMON_PRESETS = [
  {
    name: 'Routine Health Check',
    codes: ['CBC_ESR', 'URINE_RE_ME', 'GLUCOSE_F', 'CREATININE', 'ALT_SGPT', 'CHOLESTEROL'],
  },
  {
    name: 'Diabetic Profile',
    codes: ['GLUCOSE_F', 'GLUCOSE_2ABF', 'HBA1C', 'CREATININE', 'ACR', 'ELECTROLYTES'],
  },
  {
    name: 'Liver Function (LFT)',
    codes: ['BILIRUBIN', 'AST_SGOT', 'ALT_SGPT', 'ALP', 'TOTAL_PROT', 'ALBUMIN'],
  },
  {
    name: 'Renal Function (RFT)',
    codes: ['UREA_BUN', 'CREATININE', 'ELECTROLYTES', 'URIC_ACID', 'URINE_RE_ME'],
  },
  {
    name: 'Lipid Profile',
    codes: ['CHOLESTEROL', 'HDL', 'LDL', 'TRIGLYCERIDE'],
  },
  {
    name: 'Thyroid Profile',
    codes: ['T3', 'T4', 'FT3', 'FT4', 'TSH'],
  },
  {
    name: 'Fever / Infection Profile',
    codes: ['CBC_ESR', 'URINE_RE_ME', 'BLOOD_FILM', 'MP', 'WIDAL', 'DENGUE_NSI', 'CRP'],
  },
];

export default function TestSelector({
  catalog = [],
  groups = [],
  selectedTests = [],
  onChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('ALL');
  const [customTestName, setCustomTestName] = useState('');
  const [customTestCategory, setCustomTestCategory] = useState('OTHER');
  const [customTestCost, setCustomTestCost] = useState('');

  const selectedCodeMap = useMemo(() => {
    const map = new Map();
    selectedTests.forEach((t) => map.set(t.code, t));
    return map;
  }, [selectedTests]);

  const toggleTest = (test) => {
    if (disabled) return;
    if (selectedCodeMap.has(test.code)) {
      onChange(selectedTests.filter((t) => t.code !== test.code));
    } else {
      onChange([
        ...selectedTests,
        {
          code: test.code,
          name: test.name,
          category: test.category,
          costBDT: test.costBDT || 0,
          notes: '',
        },
      ]);
    }
  };

  const applyPreset = (preset) => {
    if (disabled) return;
    const toAdd = catalog.filter((c) => preset.codes.includes(c.code));
    const merged = [...selectedTests];
    toAdd.forEach((t) => {
      if (!merged.some((m) => m.code === t.code)) {
        merged.push({
          code: t.code,
          name: t.name,
          category: t.category,
          costBDT: t.costBDT || 0,
          notes: '',
        });
      }
    });
    onChange(merged);
  };

  const addCustomTest = () => {
    if (!customTestName.trim() || disabled) return;
    const code = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
    onChange([
      ...selectedTests,
      {
        code,
        name: customTestName.trim(),
        category: customTestCategory,
        costBDT: Number(customTestCost) || 0,
        notes: '',
        isCustom: true,
      },
    ]);
    setCustomTestName('');
    setCustomTestCost('');
  };

  const removeTest = (code) => {
    if (disabled) return;
    onChange(selectedTests.filter((t) => t.code !== code));
  };

  const updateTestNotes = (code, notes) => {
    if (disabled) return;
    onChange(
      selectedTests.map((t) => (t.code === code ? { ...t, notes } : t)),
    );
  };

  const filteredTests = useMemo(() => {
    let list = catalog;
    if (activeGroup !== 'ALL') {
      const g = groups.find((grp) => grp.label === activeGroup);
      if (g) {
        list = list.filter((t) => g.codes.includes(t.code));
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [catalog, groups, activeGroup, search]);

  const totalCost = useMemo(() => {
    return selectedTests.reduce((acc, t) => acc + (Number(t.costBDT) || 0), 0);
  }, [selectedTests]);

  return (
    <div className="space-y-4">
      {/* Quick Presets */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Sparkles size={13} className="text-amber-500" />
          <span>Quick Profiles / Presets:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={disabled}
              onClick={() => applyPreset(preset)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-primary/10 hover:border-primary text-foreground transition-colors"
            >
              + {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search test by name, code or category (e.g. CBC, Glucose, TSH, Urine)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Group Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveGroup('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeGroup === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            All Tests ({catalog.length})
          </button>
          {groups.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => setActiveGroup(g.label)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeGroup === g.label
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Test Catalog Checkbox Grid */}
      <div className="rounded-xl border border-border bg-card p-3 max-h-[360px] overflow-y-auto space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {filteredTests.map((test) => {
            const isSelected = selectedCodeMap.has(test.code);
            return (
              <div
                key={test.code}
                onClick={() => toggleTest(test)}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary-foreground dark:text-primary font-semibold shadow-xs'
                    : 'bg-background hover:bg-muted/50 border-border text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/40 bg-background'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className="truncate text-[11.5px]">{test.name}</span>
                </div>
                <span className="text-[10.5px] font-mono text-muted-foreground whitespace-nowrap bg-muted/60 px-1.5 py-0.5 rounded">
                  ৳{test.costBDT}
                </span>
              </div>
            );
          })}
        </div>

        {filteredTests.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No tests match your filter. You can add a custom test below.
          </div>
        )}
      </div>

      {/* Add Custom Test */}
      <div className="p-3 rounded-xl border border-dashed border-border bg-muted/20 space-y-2">
        <div className="text-xs font-semibold text-foreground flex items-center gap-1">
          <Plus size={13} />
          <span>Add Custom / Special Test (if not in catalog above)</span>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <input
            type="text"
            placeholder="Test name (e.g. 24h Urinary Free Cortisol)"
            value={customTestName}
            onChange={(e) => setCustomTestName(e.target.value)}
            disabled={disabled}
            className="flex-1 min-w-[180px] h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
          />
          <input
            type="number"
            placeholder="Cost (৳)"
            value={customTestCost}
            onChange={(e) => setCustomTestCost(e.target.value)}
            disabled={disabled}
            className="w-24 h-8 px-2.5 text-xs rounded-lg border border-border bg-background font-mono"
          />
          <button
            type="button"
            onClick={addCustomTest}
            disabled={!customTestName.trim() || disabled}
            className="h-8 px-3 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Add Test
          </button>
        </div>
      </div>

      {/* Selected Tests Basket Summary */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={15} className="text-primary" />
            <span className="text-xs font-bold text-foreground">
              Advised Tests ({selectedTests.length})
            </span>
          </div>
          <div className="text-xs font-bold font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Total Estimated Cost: ৳{totalCost.toLocaleString('en-BD')} BDT
          </div>
        </div>

        {selectedTests.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 italic text-center">
            No tests selected yet. Tick tests above or pick a quick profile preset.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {selectedTests.map((t, idx) => (
              <div
                key={t.code}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 text-xs border border-border/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground w-4 text-center">
                    {idx + 1}.
                  </span>
                  <span className="font-medium text-foreground truncate">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase bg-background px-1.5 py-0.5 rounded border border-border">
                    {t.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-semibold text-foreground">
                    ৳{t.costBDT}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeTest(t.code)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remove test"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
