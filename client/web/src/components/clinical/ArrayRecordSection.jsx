import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui/button.jsx';
import { extractApiError } from '../../services/apiClient.js';
import { Alert, AlertDescription } from '../ui/alert.jsx';

/**
 * FET-07 — one reusable add/list/remove UI, shared by every
 * gynecology and pregnancy sub-resource (conditions, contraception,
 * STI history, cervical screenings, breast records, procedures,
 * antenatal visits, fetal observations, complications) instead of
 * writing nine near-identical CRUD panels. `fields` describes the
 * add-form inputs; `renderItem` describes how a saved item is
 * displayed — the actual data shape stays owned by the caller.
 *
 * FET-17 — this component's own chrome ("Add", "Yes"/"No", "Saving…",
 * the default empty-state text, …) is now localized via
 * `clinical.arrayRecord.*`. `title`, `emptyLabel` (when the caller
 * passes one explicitly), and every `fields[].label`/`options` value
 * still come from the caller (`GynecologyPanel.jsx`/`PregnancyPanel.jsx`)
 * and are NOT translated by this pass — those panels are still plain
 * English pending their own dedicated i18n sweep.
 */
export default function ArrayRecordSection({
  title,
  icon: Icon,
  items = [],
  fields,
  onAdd,
  onRemove,
  canWrite,
  emptyLabel,
}) {
  const { t } = useTranslation();
  const resolvedEmptyLabel = emptyLabel ?? t('clinical.arrayRecord.emptyDefault');
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');

  const resetForm = () => {
    setFormValues({});
    setShowForm(false);
  };

  const handleFieldChange = (name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {};
      fields.forEach((field) => {
        const raw = formValues[field.name];
        if (field.type === 'checkbox') {
          payload[field.name] = Boolean(raw);
        } else if (raw !== undefined && raw !== '') {
          payload[field.name] = raw;
        }
      });
      await onAdd(payload);
      resetForm();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (itemId) => {
    setRemovingId(itemId);
    setError('');
    try {
      await onRemove(itemId);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {Icon ? <Icon size={16} aria-hidden="true" /> : null}
          {title}
        </div>
        {canWrite && !showForm ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> {t('clinical.arrayRecord.add')}
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{resolvedEmptyLabel}</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {items.map((item) => (
            <li
              key={item._id}
              className="flex items-start justify-between gap-3 rounded-lg bg-accent/50 p-3 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                {fields.map((field) => {
                  const value = item[field.name];
                  if (value === undefined || value === null || value === '') return null;
                  return (
                    <div key={field.name}>
                      <span className="text-muted-foreground">{field.label}: </span>
                      <span className="font-medium">
                        {field.type === 'checkbox'
                          ? value
                            ? t('clinical.arrayRecord.yes')
                            : t('clinical.arrayRecord.no')
                          : field.optionLabel && value
                            ? field.optionLabel(value)
                            : String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {canWrite ? (
                <button
                  type="button"
                  aria-label={t('clinical.arrayRecord.removeEntry', { title })}
                  disabled={removingId === item._id}
                  onClick={() => handleRemove(item._id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t('clinical.arrayRecord.newEntry')}</span>
            <button
              type="button"
              aria-label={t('common.cancel')}
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((field) => (
              <label key={field.name} className="text-xs font-medium space-y-1 block">
                {field.label}
                {field.type === 'select' ? (
                  <select
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    value={formValues[field.name] ?? ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  >
                    <option value="">—</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {field.optionLabel ? field.optionLabel(opt) : opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-border"
                    checked={Boolean(formValues[field.name])}
                    onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                  />
                ) : field.type === 'textarea' ? (
                  <textarea
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    rows={2}
                    value={formValues[field.name] ?? ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    value={formValues[field.name] ?? ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    required={field.required}
                  />
                )}
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? t('common.saving') : t('clinical.arrayRecord.saveEntry')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
