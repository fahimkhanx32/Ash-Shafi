import { useMemo, useState } from 'react';
import { History, Plus, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';

/**
 * The HTML5 drag payload's MIME type for a drug pulled from history —
 * exported so drop targets elsewhere (MedicineRxBuilder's item list,
 * the live Rx document) can recognize a drug-history drag without
 * guessing a shared string.
 */
export const DRUG_HISTORY_DRAG_TYPE = 'application/x-ashshafi-drug-history-item';

/**
 * Flattens every medicine item across a patient's past prescriptions
 * into a single "what have we given them before" list, deduplicated
 * by generic+brand+strength+form (keeping only the MOST RECENT
 * occurrence of each) and sorted most-recent-first — the same
 * combination a doctor would recognize as "the same drug", regardless
 * of which visit it was last adjusted on.
 */
const buildDrugHistory = (previousPrescriptions) => {
  const byKey = new Map();
  for (const rx of previousPrescriptions || []) {
    const date = rx.prescriptionDate;
    for (const item of rx.items || []) {
      const key = [
        (item.genericName || '').trim().toLowerCase(),
        (item.brandName || item.medicineName || '').trim().toLowerCase(),
        (item.strength || '').trim().toLowerCase(),
        (item.medicineType || '').trim().toLowerCase(),
      ].join('|');
      if (!key.trim().replace(/\|/g, '')) continue; // skip fully-blank rows
      const existing = byKey.get(key);
      if (!existing || new Date(date) > new Date(existing.lastPrescribedAt)) {
        byKey.set(key, { ...item, lastPrescribedAt: date });
      }
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.lastPrescribedAt) - new Date(a.lastPrescribedAt),
  );
};

const formatShortDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

/**
 * `onAddDrug(item)` is called with the raw historical item (still
 * carrying `lastPrescribedAt`, which the caller should strip along
 * with `_id`/`id` before merging into `form.items` — a copied drug is
 * a NEW line, not a reference back to the old prescription's
 * subdocument).
 */
export default function DrugHistoryPanel({ previousPrescriptions = [], onAddDrug, disabled = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const drugs = useMemo(() => buildDrugHistory(previousPrescriptions), [previousPrescriptions]);

  if (drugs.length === 0) return null;

  const handleDragStart = (e, drug) => {
    if (disabled) return;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRUG_HISTORY_DRAG_TYPE, JSON.stringify(drug));
    // Plain-text fallback so dropping onto the contentEditable Rx
    // document (which only reads text/plain) still inserts something
    // sensible instead of silently failing.
    e.dataTransfer.setData(
      'text/plain',
      `${drug.brandName || drug.medicineName} ${drug.strength || ''}`.trim(),
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History size={15} className="text-primary" />
          Drug History
          <span className="text-[11px] font-normal text-muted-foreground">
            ({drugs.length} previously prescribed)
          </span>
        </span>
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!collapsed && (
        <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 -mt-1">
          <p className="text-[11px] text-muted-foreground mb-2">
            Drag a drug onto the Rx list or document, or tap <Plus size={10} className="inline" /> to add it.
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {drugs.map((drug, idx) => {
              const name = drug.brandName || drug.medicineName || drug.genericName || 'Unnamed';
              const key = `${name}-${drug.strength}-${idx}`;
              return (
                <div
                  key={key}
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e, drug)}
                  className={`group flex items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 py-2 text-xs ${
                    disabled ? 'opacity-60' : 'cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-primary/5'
                  }`}
                  title={disabled ? undefined : 'Drag onto the Rx, or use the + button'}
                >
                  <GripVertical size={13} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {name}{drug.strength ? ` ${drug.strength}${drug.strengthUnit || ''}` : ''}
                      {drug.genericName && drug.genericName !== name ? (
                        <span className="font-normal text-muted-foreground italic"> ({drug.genericName})</span>
                      ) : null}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground truncate">
                      {drug.dosage || drug.frequency}{drug.durationValue ? ` · ${drug.durationValue} ${drug.durationUnit || ''}` : ''}
                      {' · last '}{formatShortDate(drug.lastPrescribedAt)}
                    </div>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onAddDrug?.(drug)}
                      className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-primary hover:bg-primary/10"
                      title="Add to this prescription"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
