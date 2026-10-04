import { useTranslation } from 'react-i18next';

import { EmptyState } from '../ui/empty-state.jsx';
import { BarChart3 } from 'lucide-react';

/**
 * FET-21 — dependency-free SVG chart primitives.
 *
 * `client/web/package.json` has never included a charting library
 * (confirmed before writing this — `recharts` etc. are not a
 * dependency), and this project has repeatedly favored a small
 * dependency-free implementation over adding one for a narrow need
 * (BET-18's `zip-writer.util.js`, BET-13's `useVoiceRecorder.js`).
 * Six analytics domains' bar/line needs are simple enough (a single
 * or small multi-series time bucket chart) that the same approach
 * applies here rather than introducing a new frontend dependency.
 *
 * Both charts are purely presentational: `points`/`series` are
 * plain arrays the caller derives from the real
 * `GET /analytics/:domain` response — no aggregation happens in
 * here, only layout math for the SVG itself.
 */

const CHART_HEIGHT = 220;
const CHART_PADDING = { top: 16, right: 16, bottom: 28, left: 40 };

const SERIES_COLORS = [
  'var(--chart-1, #6366f1)',
  'var(--chart-2, #10b981)',
  'var(--chart-3, #f59e0b)',
  'var(--chart-4, #ef4444)',
];

function ChartFrame({ isEmpty, children, width = 640 }) {
  const { t } = useTranslation();
  if (isEmpty) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('analytics.chart.noDataTitle')}
        description={t('analytics.chart.noDataDescription')}
      />
    );
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
      className="w-full h-auto"
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      {children}
    </svg>
  );
}

/**
 * `points`: [{ label: string, value: number }]. Single-series bar
 * chart — used for breakdown buckets (by status, by category, etc.).
 */
export function SimpleBarChart({ points = [], width = 640, formatValue = (v) => v }) {
  const isEmpty = points.length === 0 || points.every((p) => !p.value);
  const innerWidth = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const maxValue = Math.max(1, ...points.map((p) => p.value || 0));
  const barGap = 10;
  const barWidth = points.length ? Math.max(8, innerWidth / points.length - barGap) : 0;

  return (
    <ChartFrame isEmpty={isEmpty} width={width}>
      {/* Baseline */}
      <line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top + innerHeight}
        x2={width - CHART_PADDING.right}
        y2={CHART_PADDING.top + innerHeight}
        stroke="var(--border, #e2e8f0)"
        strokeWidth="1"
      />
      {points.map((p, i) => {
        const barHeight = maxValue ? (Math.max(0, p.value || 0) / maxValue) * innerHeight : 0;
        const x = CHART_PADDING.left + i * (barWidth + barGap);
        const y = CHART_PADDING.top + innerHeight - barHeight;
        return (
          <g key={p.label + i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={SERIES_COLORS[0]}
            >
              <title>{`${p.label}: ${formatValue(p.value || 0)}`}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={CHART_PADDING.top + innerHeight + 16}
              textAnchor="middle"
              fontSize="9"
              fill="var(--muted-foreground, #64748b)"
            >
              {p.label.length > 10 ? `${p.label.slice(0, 9)}…` : p.label}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

/**
 * `series`: [{ name: string, data: [{ bucket: string, value: number }] }].
 * Multi-line time series — used for every domain's `series` array
 * (bucketed by day/week/month per the requested `granularity`).
 * `data` across every entry in `series` is assumed to share the same
 * `bucket` ordering (true of every backend series — same `$sort`).
 */
export function SimpleLineChart({ series = [], width = 640, formatValue = (v) => v }) {
  const allValues = series.flatMap((s) => s.data.map((d) => d.value || 0));
  const buckets = series[0]?.data?.map((d) => d.bucket) || [];
  const isEmpty = buckets.length === 0 || allValues.every((v) => !v);
  const innerWidth = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const maxValue = Math.max(1, ...allValues);
  const stepX = buckets.length > 1 ? innerWidth / (buckets.length - 1) : 0;

  const pointsFor = (data) =>
    data
      .map((d, i) => {
        const x = CHART_PADDING.left + i * stepX;
        const y = CHART_PADDING.top + innerHeight - ((d.value || 0) / maxValue) * innerHeight;
        return `${x},${y}`;
      })
      .join(' ');

  // Show at most ~6 x-axis labels so buckets don't overlap on a wide range.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));

  return (
    <ChartFrame isEmpty={isEmpty} width={width}>
      <line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top + innerHeight}
        x2={width - CHART_PADDING.right}
        y2={CHART_PADDING.top + innerHeight}
        stroke="var(--border, #e2e8f0)"
        strokeWidth="1"
      />
      {series.map((s, si) => (
        <g key={s.name}>
          <polyline
            fill="none"
            stroke={SERIES_COLORS[si % SERIES_COLORS.length]}
            strokeWidth="2"
            points={pointsFor(s.data)}
          />
          {s.data.map((d, i) => {
            const x = CHART_PADDING.left + i * stepX;
            const y = CHART_PADDING.top + innerHeight - ((d.value || 0) / maxValue) * innerHeight;
            return (
              <circle key={d.bucket} cx={x} cy={y} r="2.5" fill={SERIES_COLORS[si % SERIES_COLORS.length]}>
                <title>{`${s.name} — ${d.bucket}: ${formatValue(d.value || 0)}`}</title>
              </circle>
            );
          })}
        </g>
      ))}
      {buckets.map((bucket, i) =>
        i % labelEvery === 0 ? (
          <text
            key={bucket}
            x={CHART_PADDING.left + i * stepX}
            y={CHART_PADDING.top + innerHeight + 16}
            textAnchor="middle"
            fontSize="9"
            fill="var(--muted-foreground, #64748b)"
          >
            {bucket.slice(5)}
          </text>
        ) : null,
      )}
      {series.length > 1 ? (
        <g>
          {series.map((s, si) => (
            <g key={s.name} transform={`translate(${CHART_PADDING.left + si * 100}, 8)`}>
              <rect width="8" height="8" rx="2" fill={SERIES_COLORS[si % SERIES_COLORS.length]} />
              <text x="12" y="8" fontSize="9" fill="var(--muted-foreground, #64748b)">
                {s.name}
              </text>
            </g>
          ))}
        </g>
      ) : null}
    </ChartFrame>
  );
}

/** Small labeled number tile — the "summary" row every domain has. */
export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}
