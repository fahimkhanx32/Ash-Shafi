import { useTranslation } from 'react-i18next';

import { formatMoney } from '../../constants/billing.js';
import { formatNumber, formatPercent } from '../../lib/numberFormat.js';
import { StatCard, SimpleBarChart, SimpleLineChart } from './charts.jsx';
import { toBreakdownPoints, BreakdownList } from './BreakdownList.jsx';

// FET-17 — "Localized numbers": both helpers go through
// `lib/numberFormat.js` (locale-aware grouping/decimals for en/bn)
// instead of a bare `.toLocaleString()`/`.toFixed()`, which always
// used the browser's default locale rather than the app's selected
// language.
const pct = (v) => (typeof v === 'number' ? formatPercent(v) : '—');
const num = (v) => (typeof v === 'number' ? formatNumber(v) : '—');
// `minutes()` now needs `t` for the "{{count}} min" unit string, so
// every panel below passes its own `t` through rather than this
// staying a plain module-level function with no i18n access.
const minutes = (v, t) => (typeof v === 'number' ? t('analytics.minutes', { count: Math.round(v) }) : '—');

/**
 * FET-21 — one renderer per `ANALYTICS_DOMAINS` entry. Each function
 * receives exactly the `data` object `GET /analytics/:domain`
 * returns (see each backend service's own JSDoc `@returns`, quoted
 * in this file's own comments) — no reshaping beyond picking fields
 * for display, no client-side computation of any rate/total the
 * server already computed.
 */

export function OperationalPanel({ data }) {
  const { t } = useTranslation();
  // { appointments: {...summary}, queue: {...summary}, staff: {...summary} }
  const a = data.appointments || {};
  const q = data.queue || {};
  const s = data.staff || {};
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.domains.appointments')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('analytics.stat.total')} value={num(a.total)} />
          <StatCard label={t('analytics.stat.completed')} value={num(a.completed)} hint={pct(a.completionRate)} />
          <StatCard label={t('analytics.stat.cancelled')} value={num(a.cancelled)} hint={pct(a.cancellationRate)} />
          <StatCard label={t('analytics.stat.noShow')} value={num(a.noShow)} hint={pct(a.noShowRate)} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.domains.queue')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('analytics.stat.total')} value={num(q.total)} />
          <StatCard label={t('analytics.stat.completed')} value={num(q.completed)} />
          <StatCard label={t('analytics.stat.noShow')} value={num(q.noShow)} hint={pct(q.noShowRate)} />
          <StatCard label={t('analytics.stat.avgWait')} value={minutes(q.avgWaitMinutes, t)} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.domains.staff')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('analytics.stat.activeStaff')} value={num(s.activeStaffTotal)} />
        </div>
      </div>
    </div>
  );
}

export function AppointmentsPanel({ data }) {
  const { t } = useTranslation();
  const { summary = {}, breakdown = {}, series = [] } = data;
  const lineSeries = [
    { name: t('analytics.series.total'), data: series.map((p) => ({ bucket: p.bucket, value: p.total })) },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('analytics.stat.total')} value={num(summary.total)} />
        <StatCard label={t('analytics.stat.completed')} value={num(summary.completed)} hint={pct(summary.completionRate)} />
        <StatCard label={t('analytics.stat.cancelled')} value={num(summary.cancelled)} hint={pct(summary.cancellationRate)} />
        <StatCard label={t('analytics.stat.noShow')} value={num(summary.noShow)} hint={pct(summary.noShowRate)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.section.volumeOverTime')}</h3>
        <SimpleLineChart series={lineSeries} />
      </div>
      <div className="grid sm:grid-cols-3 gap-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byStatus')}</h3>
          <BreakdownList points={toBreakdownPoints(breakdown.byStatus)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byVisitType')}</h3>
          <BreakdownList points={toBreakdownPoints(breakdown.byVisitType)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byConsultationMode')}</h3>
          <BreakdownList points={toBreakdownPoints(breakdown.byConsultationMode)} />
        </div>
      </div>
    </div>
  );
}

export function QueuePanel({ data }) {
  const { t } = useTranslation();
  const { summary = {}, breakdown = {}, series = [] } = data;
  const lineSeries = [
    { name: t('analytics.series.total'), data: series.map((p) => ({ bucket: p.bucket, value: p.total })) },
    { name: t('analytics.series.completed'), data: series.map((p) => ({ bucket: p.bucket, value: p.completed })) },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('analytics.stat.total')} value={num(summary.total)} />
        <StatCard label={t('analytics.stat.completed')} value={num(summary.completed)} />
        <StatCard label={t('analytics.stat.noShow')} value={num(summary.noShow)} hint={pct(summary.noShowRate)} />
        <StatCard label={t('analytics.stat.avgWait')} value={minutes(summary.avgWaitMinutes, t)} />
        <StatCard label={t('analytics.stat.avgConsultation')} value={minutes(summary.avgConsultationMinutes, t)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.section.volumeOverTime')}</h3>
        <SimpleLineChart series={lineSeries} />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byStatus')}</h3>
        <BreakdownList points={toBreakdownPoints(breakdown.byStatus)} />
      </div>
    </div>
  );
}

export function BillingPanel({ data }) {
  const { t } = useTranslation();
  const { summary = {}, breakdown = {}, series = [] } = data;
  const lineSeries = [
    { name: t('analytics.series.revenue'), data: series.map((p) => ({ bucket: p.bucket, value: p.revenue })) },
    { name: t('analytics.series.collected'), data: series.map((p) => ({ bucket: p.bucket, value: p.collected })) },
  ];
  const serviceTypePoints = Object.entries(breakdown.byServiceType || {}).map(([label, v]) => ({
    label,
    value: v.count,
    amount: v.amount,
  }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label={t('analytics.stat.invoices')} value={num(summary.invoiceCount)} />
        <StatCard label={t('analytics.stat.revenue')} value={formatMoney(summary.revenue)} />
        <StatCard label={t('analytics.stat.collected')} value={formatMoney(summary.collected)} hint={pct(summary.collectionRate)} />
        <StatCard label={t('analytics.stat.outstanding')} value={formatMoney(summary.outstanding)} />
        <StatCard label={t('analytics.stat.discountsGiven')} value={formatMoney(summary.discountTotal)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.section.revenueOverTime')}</h3>
        <SimpleLineChart series={lineSeries} formatValue={(v) => formatMoney(v)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byInvoiceStatus')}</h3>
          <BreakdownList points={toBreakdownPoints(breakdown.byStatus)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byServiceType')}</h3>
          <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {serviceTypePoints.length === 0 ? (
              <li className="px-4 py-2.5 text-sm text-muted-foreground">{t('analytics.emptyBreakdown')}</li>
            ) : (
              serviceTypePoints.map((p) => (
                <li key={p.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{p.label || t('analytics.unspecified')}</span>
                  <span className="font-semibold tabular-nums">
                    {p.value} · {formatMoney(p.amount)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function StaffPanel({ data }) {
  const { t } = useTranslation();
  const { summary = {}, breakdown = {}, doctorCaseload = [] } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('analytics.stat.activeStaff')} value={num(summary.activeStaffTotal)} />
      </div>
      <div className="grid sm:grid-cols-3 gap-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byDesignation')}</h3>
          <BreakdownList points={toBreakdownPoints(breakdown.byDesignation)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byEmploymentType')}</h3>
          <BreakdownList points={toBreakdownPoints(breakdown.byEmploymentType)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.byEmploymentStatus')}</h3>
          <BreakdownList points={toBreakdownPoints(breakdown.byEmploymentStatus)} />
        </div>
      </div>
      {doctorCaseload.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.doctorCaseload')}</h3>
          <SimpleBarChart
            points={doctorCaseload.map((d) => ({ label: d.doctorName || d.name || t('analytics.filters.doctor'), value: d.appointmentCount ?? d.count ?? 0 }))}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ClinicalPanel({ data }) {
  const { t } = useTranslation();
  const { consultations = {}, prescriptions = {}, investigations = {}, pregnancyStatistics = {} } = data;
  const consultSeries = [
    { name: t('analytics.series.consultations'), data: (consultations.series || []).map((p) => ({ bucket: p.bucket, value: p.count })) },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('analytics.stat.consultations')} value={num(consultations.total)} />
        <StatCard label={t('analytics.stat.prescriptions')} value={num(prescriptions.total)} />
        <StatCard label={t('analytics.stat.investigations')} value={num(investigations.total)} />
        <StatCard label={t('analytics.stat.pregnancyRecords')} value={num(pregnancyStatistics.total)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.section.consultationsOverTime')}</h3>
        <SimpleLineChart series={consultSeries} />
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.consultationsByStatus')}</h3>
          <BreakdownList points={toBreakdownPoints(consultations.byStatus)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.prescriptionsByStatus')}</h3>
          <BreakdownList points={toBreakdownPoints(prescriptions.byStatus)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.investigationsByStatus')}</h3>
          <BreakdownList points={toBreakdownPoints(investigations.byStatus)} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">{t('analytics.section.investigationsByCategory')}</h3>
          <BreakdownList
            points={toBreakdownPoints(investigations.byCategory)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t('analytics.categoryPrivacyNote')}
          </p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">{t('analytics.section.pregnancyByStatus')}</h3>
        <BreakdownList points={toBreakdownPoints(pregnancyStatistics.byStatus)} />
      </div>
    </div>
  );
}
