import { useEffect, useRef, useState, useId } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Search,
  Star,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as medicinesService from '../../services/medicinesService.js';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';

const MEDICINE_TYPES = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Cream',
  'Ointment',
  'Drops',
  'Suppository',
  'Inhaler',
  'Powder',
  'Sachet',
  'Other',
];

const DOSAGE_PRESETS = [
  '1 + 0 + 0',
  '0 + 1 + 0',
  '0 + 0 + 1',
  '1 + 1 + 1',
  '1 + 0 + 1',
  '1 + 1 + 0',
  '0 + 1 + 1',
  '1 + 1 + 1 + 1',
  '0 + 0 + 0',
];

const FOOD_OPTIONS = [
  'খাবার পরে',
  'খাবার আগে',
  'খাবারের সাথে',
  'খালি পেটে',
  'যেকোনো সময়',
  'Before Meal',
  'After Meal',
  'With Food',
  'Empty Stomach',
  'Custom',
];

const DURATION_UNITS = [
  'Days',
  'Weeks',
  'Months',
  'Years',
  'Continuous',
  'Until Follow-up',
  'Until Symptoms Resolve',
  'PRN / As Needed',
  'Custom',
];

const CONTINUATIONS = [
  'চলবে',
  'Continue',
  'Stop',
  'Until Next Visit',
  'Custom',
];

const CONSUMPTION_TIMES = [
  'Morning',
  'Noon',
  'Afternoon',
  'Evening',
  'Night',
  'Bedtime',
  'Before Sleep',
  'As Needed',
];

const generateItemId = () => `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const createEmptyMedicineItem = (serialNumber = 1) => ({
  id: generateItemId(),
  serialNumber,
  medicineRef: null,
  medicineType: 'Tablet',
  brandName: '',
  medicineName: '',
  genericName: '',
  strength: '',
  strengthUnit: 'mg',
  dosage: '1 + 0 + 0',
  frequency: '1 + 0 + 0',
  consumptionTime: '',
  foodInstruction: 'খাবার পরে',
  durationValue: '14',
  durationUnit: 'Days',
  continuation: 'চলবে',
  specialInstruction: '',
  quantity: '',
  instructions: '',
  notes: '',
  displayOrder: serialNumber,
});

/**
 * Top-level Autocomplete Search field.
 */
function BrandAutocompleteField({ value, onSelect, disabled }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const handleSearch = (text) => {
    setQuery(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    timeoutRef.current = setTimeout(() => {
      medicinesService
        .autocompleteMedicines(text.trim(), 8)
        .then((items) => setResults(items || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          disabled={disabled}
          placeholder={t('clinical.prescription.searchBrandPlaceholder', 'Search brand name (e.g. Lino, Thyrox, Sergel)...')}
          className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-xl divide-y divide-border">
          {loading ? (
            <div className="p-2.5 text-xs text-muted-foreground text-center animate-pulse">
              {t('common.searching', 'Searching medicine database...')}
            </div>
          ) : results.length === 0 ? (
            <div className="p-2.5 text-xs text-muted-foreground text-center">
              {t('clinical.prescription.noMedicineMatch', 'No matching brand in database. You can type freely.')}
            </div>
          ) : (
            results.map((med) => (
              <button
                key={med.id || med._id}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent/60 transition-colors flex items-center justify-between"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(med);
                  setQuery(med.brandName || med.genericName);
                  setOpen(false);
                }}
              >
                <div>
                  <span className="font-semibold text-foreground">{med.brandName || med.genericName}</span>
                  {med.strength ? <span className="text-muted-foreground ml-1">({med.strength} {med.unit || ''})</span> : null}
                  <p className="text-[11px] text-muted-foreground">{med.genericName} • {med.dosageForm || 'Tablet'}</p>
                </div>
                {med.manufacturer ? (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {med.manufacturer.slice(0, 20)}
                  </Badge>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Top-level Single Medicine Row Item component with stable keys.
 */
export function MedicineRowItem({
  item,
  index,
  total,
  disabled,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onSaveFavorite,
  hideListActions = false,
}) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (patch) => {
    onChange({ ...item, ...patch });
  };

  const handleSelectCatalog = (med) => {
    update({
      medicineRef: med.id || med._id,
      brandName: med.brandName || med.genericName,
      genericName: med.genericName,
      strength: med.strength || '',
      strengthUnit: med.unit || 'mg',
      medicineType: med.dosageForm === 'CAPSULE' ? 'Capsule' : med.dosageForm === 'INJECTION' ? 'Injection' : med.dosageForm === 'SYRUP' ? 'Syrup' : 'Tablet',
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3.5 shadow-sm space-y-3 transition-all hover:border-primary/40">
      {/* Header with Serial, Title, Actions */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
            {index + 1}
          </span>
          <span className="text-xs font-semibold text-foreground">
            {item.brandName || item.medicineName || item.genericName ? (
              <>
                {item.medicineType ? `${item.medicineType.slice(0, 3)}. ` : ''}
                {item.brandName || item.medicineName || item.genericName}
                {item.strength ? ` ${item.strength} ${item.strengthUnit || ''}` : ''}
                {item.genericName && (item.brandName || item.medicineName) ? (
                  <span className="text-muted-foreground font-normal ml-1">({item.genericName})</span>
                ) : null}
              </>
            ) : (
              t('clinical.prescription.newMedicineItem', 'Medicine Item #{{number}}', { number: index + 1 })
            )}
          </span>
        </div>

        {!disabled && !hideListActions ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-amber-500"
              title={t('clinical.prescription.saveAsFavorite', 'Save to Favorites')}
              onClick={() => onSaveFavorite(item)}
            >
              <Star size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              disabled={index === 0}
              onClick={onMoveUp}
              title={t('common.moveUp', 'Move Up')}
            >
              <ArrowUp size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              disabled={index === total - 1}
              onClick={onMoveDown}
              title={t('common.moveDown', 'Move Down')}
            >
              <ArrowDown size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onDuplicate}
              title={t('common.duplicate', 'Duplicate')}
            >
              <Copy size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              title={t('common.remove', 'Remove')}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Row 1: Brand Search | Medicine Name Manual | Generic Name | Type */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        {/* Brand Name — autocomplete search against the medicine database */}
        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.brandName', 'Brand Name (Search)')}
          </label>
          <BrandAutocompleteField
            value={item.brandName}
            disabled={disabled}
            onSelect={handleSelectCatalog}
          />
        </div>

        {/* Medicine Name — free-text manual entry, no database required */}
        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.medicineName', 'Medicine Name (Manual Entry)')}
          </label>
          <input
            type="text"
            disabled={disabled}
            placeholder="Enter medicine name manually"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={item.medicineName || ''}
            onChange={(e) => update({ medicineName: e.target.value })}
          />
        </div>

        {/* Generic Name */}
        <div className="sm:col-span-4">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.genericName', 'Generic Name')}
          </label>
          <input
            type="text"
            disabled={disabled}
            placeholder="e.g. Linagliptin"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm"
            value={item.genericName}
            onChange={(e) => update({ genericName: e.target.value })}
          />
        </div>

        {/* Type */}
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.medicineType', 'Type')}
          </label>
          <select
            disabled={disabled}
            className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs"
            value={item.medicineType || 'Tablet'}
            onChange={(e) => update({ medicineType: e.target.value })}
          >
            {MEDICINE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Strength + Dosage Quick Chips + Food Instruction */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
        {/* Strength & Unit */}
        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.strength', 'Strength')}
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              disabled={disabled}
              placeholder="e.g. 5, 500"
              className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs"
              value={item.strength}
              onChange={(e) => update({ strength: e.target.value })}
            />
            <input
              type="text"
              disabled={disabled}
              placeholder="mg"
              className="w-16 h-9 px-2 rounded-lg border border-border bg-background text-xs font-medium text-center"
              value={item.strengthUnit || 'mg'}
              onChange={(e) => update({ strengthUnit: e.target.value })}
            />
          </div>
        </div>

        {/* Dosage / Frequency */}
        <div className="sm:col-span-5">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.dosageFrequency', 'Dosage Pattern (1+0+0)')}
          </label>
          <div className="space-y-1.5">
            <input
              type="text"
              disabled={disabled}
              placeholder="e.g. 1 + 0 + 1"
              className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold"
              value={item.dosage || item.frequency || ''}
              onChange={(e) => update({ dosage: e.target.value, frequency: e.target.value })}
            />
            {/* Quick Dosage Buttons */}
            <div className="flex flex-wrap gap-1">
              {DOSAGE_PRESETS.slice(0, 6).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                    (item.dosage || item.frequency) === preset
                      ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                  }`}
                  onClick={() => update({ dosage: preset, frequency: preset })}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Food Instruction */}
        <div className="sm:col-span-4">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.foodInstruction', 'Before / After Food')}
          </label>
          <select
            disabled={disabled}
            className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-medium"
            value={item.foodInstruction || 'খাবার পরে'}
            onChange={(e) => update({ foodInstruction: e.target.value })}
          >
            {FOOD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Duration, Continuation & Special Instruction */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
        {/* Duration */}
        <div className="sm:col-span-4">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.duration', 'Duration')}
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              disabled={disabled}
              placeholder="14"
              className="w-16 h-9 px-2 rounded-lg border border-border bg-background text-xs text-center"
              value={item.durationValue || ''}
              onChange={(e) => update({ durationValue: e.target.value })}
            />
            <select
              disabled={disabled}
              className="w-full h-9 px-2 rounded-lg border border-border bg-background text-xs"
              value={item.durationUnit || 'Days'}
              onChange={(e) => update({ durationUnit: e.target.value })}
            >
              {DURATION_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Continuation */}
        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.continuation', 'Continuation')}
          </label>
          <select
            disabled={disabled}
            className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-emerald-800 dark:text-emerald-400"
            value={item.continuation || 'চলবে'}
            onChange={(e) => update({ continuation: e.target.value })}
          >
            {CONTINUATIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Special Instruction */}
        <div className="sm:col-span-5">
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
            {t('clinical.prescription.specialInstruction', 'Special Instruction')}
          </label>
          <input
            type="text"
            disabled={disabled}
            placeholder="e.g. ব্যথা হলে খাবেন, ডায়াবেটিস এর ঔষধ"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs italic"
            value={item.specialInstruction || ''}
            onChange={(e) => update({ specialInstruction: e.target.value })}
          />
        </div>
      </div>

      {/* Live Inline Preview Box */}
      <div className="bg-muted/40 rounded-lg p-2 text-[11px] border border-border/50 text-slate-800 dark:text-slate-200">
        <span className="font-bold">{index + 1}. {item.medicineType ? `${item.medicineType.slice(0, 3)}. ` : ''}{item.brandName || item.medicineName || item.genericName || '—'}{item.strength ? ` ${item.strength} ${item.strengthUnit || ''}` : ''}</span>
        {item.genericName && (item.brandName || item.medicineName) ? <span className="text-muted-foreground italic ml-1">({item.genericName})</span> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-primary font-medium pl-3">
          <span>{item.dosage || item.frequency || '1 + 0 + 0'}</span>
          <span>{item.foodInstruction}</span>
          {item.specialInstruction ? <span className="italic text-amber-700 dark:text-amber-400">{item.specialInstruction}</span> : null}
          {item.durationValue ? <span>{item.durationValue} {item.durationUnit}</span> : null}
          {item.continuation ? <span className="text-emerald-700 dark:text-emerald-400">{item.continuation}</span> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Top-level MedicineRxBuilder component.
 */
export default function MedicineRxBuilder({ items = [], onChange, disabled = false }) {
  const { t } = useTranslation();
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    prescriptionsService
      .getFavoriteMedicines()
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  const handleAddItem = (presetData = null) => {
    const newItem = {
      ...createEmptyMedicineItem(items.length + 1),
      ...(presetData || {}),
    };
    onChange([...items, newItem]);
  };

  const handleUpdateItem = (index, updatedItem) => {
    const next = items.map((it, i) => (i === index ? updatedItem : it));
    onChange(next);
  };

  const handleRemoveItem = (index) => {
    const next = items.filter((_, i) => i !== index).map((it, i) => ({ ...it, serialNumber: i + 1, displayOrder: i + 1 }));
    onChange(next);
  };

  const handleDuplicate = (index) => {
    const source = items[index];
    const duplicated = {
      ...source,
      id: generateItemId(),
      serialNumber: items.length + 1,
      displayOrder: items.length + 1,
    };
    onChange([...items, duplicated]);
  };

  const handleMove = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const renumbered = next.map((it, idx) => ({ ...it, serialNumber: idx + 1, displayOrder: idx + 1 }));
    onChange(renumbered);
  };

  const handleSaveFavorite = async (item) => {
    if (!item.genericName && !item.medicineName && !item.brandName) return;
    try {
      await prescriptionsService.saveFavoriteMedicine({
        brandName: item.brandName,
        medicineName: item.medicineName,
        genericName: item.genericName,
        medicineType: item.medicineType,
        strength: item.strength,
        strengthUnit: item.strengthUnit,
        dosage: item.dosage,
        foodInstruction: item.foodInstruction,
        durationValue: item.durationValue,
        durationUnit: item.durationUnit,
        continuation: item.continuation,
        specialInstruction: item.specialInstruction,
      });
      const refreshed = await prescriptionsService.getFavoriteMedicines();
      setFavorites(refreshed);
      setSavedNotice(`Saved "${item.brandName || item.medicineName || item.genericName}" to favorites!`);
      setTimeout(() => setSavedNotice(''), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar for Rx builder */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span className="font-serif italic font-bold text-lg text-primary">Rx</span>
          <h3 className="text-sm font-bold text-foreground">
            {t('clinical.prescription.prescribedMedicines', 'Prescribed Medicines / Rx')}
          </h3>
          <Badge variant="neutral" className="text-xs font-mono">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>

        {!disabled ? (
          <div className="flex items-center gap-2">
            {favorites.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-300"
                onClick={() => setShowFavorites(!showFavorites)}
              >
                <Sparkles size={13} />
                {t('clinical.prescription.favoritesBtn', 'Favorites ({{count}})', { count: favorites.length })}
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => handleAddItem()}
            >
              <Plus size={14} /> {t('clinical.prescription.addMedicine', '+ Add Medicine')}
            </Button>
          </div>
        ) : null}
      </div>

      {savedNotice ? (
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
          <Check size={14} /> {savedNotice}
        </div>
      ) : null}

      {/* Frequently Used / Favorite Quick Pick Ribbon */}
      {showFavorites && favorites.length > 0 && !disabled ? (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Star size={13} className="fill-amber-500 text-amber-500" />
              {t('clinical.prescription.quickPickFavorites', 'Quick Pick Favorite Medicines')}
            </span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowFavorites(false)}
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((fav) => (
              <button
                key={fav._id || fav.id}
                type="button"
                className="px-2.5 py-1 rounded-lg bg-card border border-border text-xs text-left hover:border-primary hover:bg-accent/50 transition-colors shadow-xs"
                onClick={() => {
                  handleAddItem({
                    brandName: fav.brandName,
                    medicineName: fav.medicineName,
                    genericName: fav.genericName,
                    medicineType: fav.medicineType || 'Tablet',
                    strength: fav.strength,
                    strengthUnit: fav.strengthUnit || 'mg',
                    dosage: fav.dosage || '1 + 0 + 0',
                    foodInstruction: fav.foodInstruction || 'খাবার পরে',
                    durationValue: fav.durationValue || '14',
                    durationUnit: fav.durationUnit || 'Days',
                    continuation: fav.continuation || 'চলবে',
                    specialInstruction: fav.specialInstruction || '',
                  });
                }}
              >
                <span className="font-semibold">{fav.brandName || fav.medicineName || fav.genericName}</span>
                {fav.strength ? <span className="text-muted-foreground ml-1">({fav.strength} {fav.strengthUnit})</span> : null}
                <span className="text-[10px] text-primary ml-1.5">{fav.dosage}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* List of Medicine rows */}
      {items.length === 0 ? (
        <div className="text-center p-8 rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('clinical.prescription.noMedicinesYet', 'No medicines prescribed yet.')}
          </p>
          {!disabled ? (
            <Button type="button" size="sm" onClick={() => handleAddItem()}>
              <Plus size={14} /> {t('clinical.prescription.addMedicine', 'Add Medicine')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <MedicineRowItem
              key={item.id || item._id || `med_${index}`}
              item={item}
              index={index}
              total={items.length}
              disabled={disabled}
              onChange={(updated) => handleUpdateItem(index, updated)}
              onRemove={() => handleRemoveItem(index)}
              onDuplicate={() => handleDuplicate(index)}
              onMoveUp={() => handleMove(index, index - 1)}
              onMoveDown={() => handleMove(index, index + 1)}
              onSaveFavorite={handleSaveFavorite}
            />
          ))}

          {/* + Add more medicine — bottom of card list */}
          {!disabled ? (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => handleAddItem()}
              >
                <Plus size={13} />
                {t('clinical.prescription.addMoreMedicine', '+ Add more medicine')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
