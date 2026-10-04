import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as billingService from '../../services/billingService.js';
import { Button } from '../ui/button.jsx';
import { emptyLabTestItem, labTestsTotalCost } from '../../constants/prescriptions.js';

const inputClass =
  'w-full h-9 rounded-lg border border-border bg-background px-2.5 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

/**
 * FET-10 follow-up (client-supplied "Laboratory Requisition Form" —
 * BMDC-hospital-style paper form converted to a reusable React
 * component) — "doctor can add test name in the prescriptions and
 * [patient] can see test name with test cost".
 *
 * Backed by the `Fee` price catalog (`billing.fee.model.js`,
 * `serviceType: 'INVESTIGATION'`) rather than the client-supplied
 * form's own hardcoded ~200-test list: the catalog is the clinic's
 * actual, admin-configurable price list (master prompt §35), and
 * every test a doctor adds here needs a real cost the patient will
 * see — a hardcoded name list with no prices attached wouldn't
 * satisfy that. `GET /billing/fees?serviceType=INVESTIGATION` is
 * open to any authenticated user (same route a patient already uses
 * to see prices before booking), so it's fetched once per mount and
 * filtered client-side — the catalog is a short, clinic-curated
 * price list, not a paginated search space like the `Medicine`
 * catalog `MedicineSearchField` searches server-side.
 *
 * A test not yet in the catalog can still be typed in free-hand
 * (`feeRef` stays `null`, `cost` typed manually) — same
 * "prescribing never blocks on the catalog" allowance
 * `PrescriptionItemsEditor.jsx` already gives medicines.
 */
function LabTestSearchField({ onPick, disabled }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [fees, setFees] = useState([]);
  const [loadState, setLoadState] = useState('idle'); // idle | loading | ready | error

  useEffect(() => {
    setLoadState('loading');
    billingService
      .listFees({ serviceType: 'INVESTIGATION' })
      .then((list) => {
        setFees(list);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return fees.filter((fee) => fee.name.toLowerCase().includes(q)).slice(0, 8);
  }, [fees, query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className={`${inputClass} pl-8`}
          placeholder={t('clinical.prescription.searchLabCatalogPlaceholder')}
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
      {open && query.trim().length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-one-ui-lg divide-y divide-border">
          {loadState === 'loading' ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">{t('clinical.prescription.searching')}</li>
          ) : null}
          {loadState === 'ready' && results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {t('clinical.prescription.noLabCatalogMatch')}
            </li>
          ) : null}
          {loadState === 'error' ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {t('clinical.prescription.labCatalogLoadError')}
            </li>
          ) : null}
          {results.map((fee) => (
            <li key={fee.id}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(fee);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span className="font-medium">{fee.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {fee.currency} {Number(fee.amount).toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function LabTestsEditor({ labTests, onChange, disabled = false }) {
  const { t } = useTranslation();

  const updateTest = (index, patch) => {
    onChange(labTests.map((test, i) => (i === index ? { ...test, ...patch } : test)));
  };

  const removeTest = (index) => {
    onChange(labTests.filter((_, i) => i !== index));
  };

  const addTest = () => {
    onChange([...labTests, emptyLabTestItem()]);
  };

  const total = labTestsTotalCost(labTests);

  return (
    <div className="space-y-3">
      {labTests.map((test, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('clinical.prescription.labTestNumber', { number: index + 1 })}
            </span>
            {!disabled ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive rounded-lg p-1"
                aria-label={t('clinical.prescription.removeLabTest', { number: index + 1 })}
                onClick={() => removeTest(index)}
              >
                <Trash2 size={15} />
              </button>
            ) : null}
          </div>

          {!disabled ? (
            <LabTestSearchField
              disabled={disabled}
              onPick={(fee) =>
                updateTest(index, {
                  feeRef: fee.id,
                  testName: fee.name,
                  cost: fee.amount,
                  currency: fee.currency || 'BDT',
                })
              }
            />
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="col-span-2 sm:col-span-2">
              <label className={labelClass}>{t('clinical.prescription.labTestName')}</label>
              <input
                className={inputClass}
                value={test.testName}
                disabled={disabled}
                required
                onChange={(event) => updateTest(index, { testName: event.target.value, feeRef: null })}
              />
            </div>
            <div>
              <label className={labelClass}>{t('clinical.prescription.labTestCategory')}</label>
              <input
                className={inputClass}
                placeholder={t('clinical.prescription.labTestCategoryPlaceholder')}
                value={test.category}
                disabled={disabled}
                onChange={(event) => updateTest(index, { category: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>{t('clinical.prescription.labTestCost')}</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={test.cost}
                  disabled={disabled}
                  required
                  onChange={(event) => updateTest(index, { cost: event.target.value })}
                />
                <select
                  className={`${inputClass} w-20 flex-shrink-0`}
                  value={test.currency}
                  disabled={disabled}
                  onChange={(event) => updateTest(index, { currency: event.target.value })}
                >
                  <option value="BDT">BDT</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('clinical.encounter.instructions')}</label>
            <input
              className={inputClass}
              placeholder={t('clinical.prescription.labTestNotesPlaceholder')}
              value={test.notes}
              disabled={disabled}
              onChange={(event) => updateTest(index, { notes: event.target.value })}
            />
          </div>
        </div>
      ))}

      {!disabled ? (
        <Button type="button" variant="outline" size="sm" onClick={addTest}>
          <Plus size={14} /> {t('clinical.prescription.addLabTest')}
        </Button>
      ) : null}

      {labTests.length > 0 ? (
        <p className="text-sm font-medium text-right">
          {t('clinical.prescription.labTestsTotal')}: {labTests[0]?.currency || 'BDT'} {total.toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}
