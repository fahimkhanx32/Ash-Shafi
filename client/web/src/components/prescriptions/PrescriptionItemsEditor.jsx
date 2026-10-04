import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as medicinesService from '../../services/medicinesService.js';
import { Button } from '../ui/button.jsx';
import {
  FREQUENCIES,
  DURATION_UNITS,
  frequencyLabel,
  durationUnitLabel,
  emptyPrescriptionItem,
} from '../../constants/prescriptions.js';

const inputClass =
  'w-full h-9 rounded-lg border border-border bg-background px-2.5 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

/**
 * FET-10 — "Medicine selection", "Dosage", "Frequency", "Duration",
 * "Instructions", "Prescription items". One row per
 * `prescriptionItemSchema` entry (server-validated 1..30 items). Each
 * row can be filled either by searching the `Medicine` catalog
 * (`GET /medicines?search=`, BET-11) — which snapshots
 * genericName/brandName/strength/dosageForm/route at prescribing time,
 * per that model's own docstring — or typed freehand, so prescribing
 * never blocks on a medicine that isn't in the catalog yet.
 * Controlled/`disabled`-aware, same convention
 * `EncounterClinicalFields.jsx` (FET-08) established for a shared,
 * reused-across-create/edit/revise form component.
 */
function MedicineSearchField({ onPick, disabled }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    setSearching(true);
    timeoutRef.current = setTimeout(() => {
      medicinesService
        .listMedicines({ search: query.trim(), isActive: true, limit: 8 })
        .then(({ items }) => setResults(items))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className={`${inputClass} pl-8`}
          placeholder={t('clinical.prescription.searchCatalogPlaceholder')}
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && query.trim().length >= 2 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-one-ui-lg divide-y divide-border">
          {searching ? <li className="px-3 py-2 text-xs text-muted-foreground">{t('clinical.prescription.searching')}</li> : null}
          {!searching && results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {t('clinical.prescription.noCatalogMatch')}
            </li>
          ) : null}
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(m);
                  setQuery('');
                  setResults([]);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{m.genericName}</span>
                {m.brandName ? <span className="text-muted-foreground"> · {m.brandName}</span> : null}
                {m.strength || m.unit ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · {[m.strength, m.unit].filter(Boolean).join(' ')}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function PrescriptionItemsEditor({ items, onChange, disabled = false }) {
  const { t } = useTranslation();
  const updateItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, emptyPrescriptionItem()]);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{t('clinical.prescription.itemNumber', { number: index + 1 })}</span>
            {!disabled ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive rounded-lg p-1"
                aria-label={t('clinical.prescription.removeItem', { number: index + 1 })}
                onClick={() => removeItem(index)}
              >
                <Trash2 size={15} />
              </button>
            ) : null}
          </div>

          {!disabled ? (
            <MedicineSearchField
              disabled={disabled}
              onPick={(medicine) =>
                updateItem(index, {
                  medicineRef: medicine.id,
                  genericName: medicine.genericName || '',
                  brandName: medicine.brandName || '',
                  strength: [medicine.strength, medicine.unit].filter(Boolean).join(' '),
                  dosageForm: medicine.dosageForm || '',
                  route: medicine.route || '',
                })
              }
            />
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="col-span-2">
              <label className={labelClass}>{t('clinical.prescription.genericName')}</label>
              <input
                className={inputClass}
                value={item.genericName}
                disabled={disabled}
                required
                onChange={(event) => updateItem(index, { genericName: event.target.value, medicineRef: null })}
              />
            </div>
            <div>
              <label className={labelClass}>{t('clinical.prescription.brandName')}</label>
              <input
                className={inputClass}
                value={item.brandName}
                disabled={disabled}
                onChange={(event) => updateItem(index, { brandName: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>{t('clinical.prescription.strength')}</label>
              <input
                className={inputClass}
                placeholder={t('clinical.prescription.strengthPlaceholder')}
                value={item.strength}
                disabled={disabled}
                onChange={(event) => updateItem(index, { strength: event.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>{t('clinical.prescription.frequency')}</label>
              <select
                className={inputClass}
                value={item.frequency}
                disabled={disabled}
                onChange={(event) => updateItem(index, { frequency: event.target.value })}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {frequencyLabel(f, t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('clinical.prescription.timing')}</label>
              <input
                className={inputClass}
                placeholder={t('clinical.prescription.timingPlaceholder')}
                value={item.timing}
                disabled={disabled}
                onChange={(event) => updateItem(index, { timing: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>{t('clinical.prescription.duration')}</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={item.durationValue}
                  disabled={disabled || item.durationUnit === 'ONGOING'}
                  onChange={(event) => updateItem(index, { durationValue: event.target.value })}
                />
                <select
                  className={inputClass}
                  value={item.durationUnit}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { durationUnit: event.target.value })}
                >
                  {DURATION_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {durationUnitLabel(u, t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('clinical.prescription.quantity')}</label>
              <input
                className={inputClass}
                placeholder={t('clinical.prescription.quantityPlaceholder')}
                value={item.quantity}
                disabled={disabled}
                onChange={(event) => updateItem(index, { quantity: event.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('clinical.encounter.instructions')}</label>
            <input
              className={inputClass}
              placeholder={t('clinical.prescription.instructionsPlaceholder')}
              value={item.instructions}
              disabled={disabled}
              onChange={(event) => updateItem(index, { instructions: event.target.value })}
            />
          </div>
        </div>
      ))}

      {!disabled ? (
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus size={14} /> {t('clinical.prescription.addMedicine')}
        </Button>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('clinical.prescription.addAtLeastOne')}</p>
      ) : null}
    </div>
  );
}
