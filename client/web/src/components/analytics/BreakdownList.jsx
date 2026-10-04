import { useTranslation } from 'react-i18next';

/**
 * FET-21 — normalizes the two breakdown shapes the analytics backend
 * actually returns (verified by reading every service file, not
 * assumed uniform):
 *   - appointment/queue/billing breakdowns: `[{ status, count }]`
 *     (or `visitType`/`consultationMode`/`serviceType` in place of
 *     `status`) — an array, from a `$group`+`$project` aggregation.
 *   - staff/clinical breakdowns: `{ key: count }` — a plain object,
 *     built with `Object.fromEntries`. Clinical's additionally may
 *     hold `null` for a suppressed (below-cohort-threshold) bucket
 *     (`cohort.util.js`'s `suppressSmallBuckets`) — rendered as
 *     "< 5" rather than a fabricated real number.
 */
export function toBreakdownPoints(breakdown, keyField) {
  if (!breakdown) return [];
  if (Array.isArray(breakdown)) {
    return breakdown.map((row) => ({
      label: row[keyField] ?? row.status ?? row.visitType ?? row.consultationMode ?? row.serviceType,
      value: typeof row.count === 'number' ? row.count : row.amount,
      suppressed: false,
    }));
  }
  return Object.entries(breakdown).map(([label, value]) => ({
    label,
    value: value ?? 0,
    suppressed: value === null,
  }));
}

/**
 * A simple label/count table — used where a bar chart would be
 * redundant or misleading (e.g. suppressed clinical buckets).
 *
 * FET-17 — `emptyLabel` now defaults to `null` rather than a
 * hardcoded English string: the component resolves its own
 * `analytics.emptyBreakdown` fallback via `t()` so every call site
 * (several across `DomainPanels.jsx`) renders in the active language
 * without each one needing to pass a translated string down.
 */
export function BreakdownList({ points = [], formatValue = (v) => v, emptyLabel = null }) {
  const { t } = useTranslation();
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? t('analytics.emptyBreakdown')}</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {points.map((p) => (
        <li key={p.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{p.label || t('analytics.unspecified')}</span>
          <span className="font-semibold tabular-nums">
            {p.suppressed ? (
              <span title={t('analytics.suppressedTooltip')}>&lt; 5</span>
            ) : (
              formatValue(p.value)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
