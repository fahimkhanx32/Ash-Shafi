import { useTranslation } from 'react-i18next';

import { ANALYTICS_GRANULARITIES, ANALYTICS_RANGE_PRESETS } from '../../constants/analytics.js';

// FET-17 — mirrors `AnalyticsPage.jsx`'s `DOMAIN_LABEL_KEY` pattern:
// `GRANULARITY_LABELS`/preset `label` strings from `constants/analytics.js`
// are no longer read directly here — resolved through `analytics.granularity.*`
// / `analytics.presets.*` instead so this filter bar renders in the
// active language.
const GRANULARITY_LABEL_KEY = { day: 'analytics.granularity.day', week: 'analytics.granularity.week', month: 'analytics.granularity.month' };
const PRESET_LABEL_KEY = { 7: 'analytics.presets.last7', 30: 'analytics.presets.last30', 90: 'analytics.presets.last90', 366: 'analytics.presets.thisYear' };

/**
 * FET-21 — "Filters" / "Date ranges" (master prompt's Analytics
 * checklist). Purely a controlled input group; `AnalyticsPage.jsx`
 * owns `from`/`to`/`granularity`/`doctorId` state and re-fetches on
 * change. Dates are plain `YYYY-MM-DD` strings throughout, matching
 * `analyticsQuerySchema`'s `Joi.string().isoDate()` — never a `Date`
 * object serialized differently than the backend expects.
 */
export function AnalyticsFilterBar({
  from,
  to,
  granularity,
  onChange,
  doctors, // null when this domain isn't doctor-scoped, or the caller's role is DOCTOR (self-scoped server-side)
  doctorId,
}) {
  const { t } = useTranslation();
  const applyPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 mb-5 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap gap-1.5">
        {ANALYTICS_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset.days)}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
          >
            {t(PRESET_LABEL_KEY[preset.days] || preset.label)}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t('analytics.filters.from')}
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => onChange({ from: e.target.value })}
            className="mt-1 block h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          {t('analytics.filters.to')}
          <input
            type="date"
            value={to}
            min={from}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onChange({ to: e.target.value })}
            className="mt-1 block h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
          />
        </label>
      </div>

      <label className="text-xs font-medium text-muted-foreground">
        {t('analytics.filters.granularity')}
        <select
          value={granularity}
          onChange={(e) => onChange({ granularity: e.target.value })}
          className="mt-1 block h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
        >
          {ANALYTICS_GRANULARITIES.map((g) => (
            <option key={g} value={g}>
              {t(GRANULARITY_LABEL_KEY[g])}
            </option>
          ))}
        </select>
      </label>

      {doctors ? (
        <label className="text-xs font-medium text-muted-foreground">
          {t('analytics.filters.doctor')}
          <select
            value={doctorId || ''}
            onChange={(e) => onChange({ doctorId: e.target.value || undefined })}
            className="mt-1 block h-9 rounded-lg border border-border bg-background px-2.5 text-sm min-w-[10rem]"
          >
            <option value="">{t('analytics.filters.allDoctors')}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.user?.id}>
                {t('analytics.filters.doctorOption', { name: d.user?.name })}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
