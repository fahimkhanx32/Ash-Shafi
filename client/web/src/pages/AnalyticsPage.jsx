import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../providers/AuthProvider.jsx';
import * as analyticsService from '../services/analyticsService.js';
import * as staffService from '../services/staffService.js';
import { extractApiError } from '../services/apiClient.js';
import {
  ANALYTICS_DOMAINS,
  ANALYTICS_DOMAIN_META,
  ANALYTICS_DOMAIN_ORDER,
  ANALYTICS_DEFAULT_RANGE_DAYS,
} from '../constants/analytics.js';
import { ROLES, ADMIN_TIER_ROLES } from '../constants/roles.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import { ErrorState } from '../components/ui/empty-state.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { AnalyticsFilterBar } from '../components/analytics/AnalyticsFilterBar.jsx';
import {
  OperationalPanel,
  AppointmentsPanel,
  QueuePanel,
  BillingPanel,
  StaffPanel,
  ClinicalPanel,
} from '../components/analytics/DomainPanels.jsx';

const PANEL_BY_DOMAIN = {
  [ANALYTICS_DOMAINS.OPERATIONAL]: OperationalPanel,
  [ANALYTICS_DOMAINS.APPOINTMENTS]: AppointmentsPanel,
  [ANALYTICS_DOMAINS.QUEUE]: QueuePanel,
  [ANALYTICS_DOMAINS.BILLING]: BillingPanel,
  [ANALYTICS_DOMAINS.STAFF]: StaffPanel,
  [ANALYTICS_DOMAINS.CLINICAL]: ClinicalPanel,
};

// FET-17 — domain tab labels now resolve through `analytics.domains.*`
// instead of `ANALYTICS_DOMAIN_META`'s hardcoded English `label`
// field. Keyed the same way `ANALYTICS_DOMAIN_META` already is, so
// this is a lookup table next to it, not a replacement for the
// roles/order data that table still owns.
const DOMAIN_LABEL_KEY = {
  [ANALYTICS_DOMAINS.OPERATIONAL]: 'analytics.domains.operational',
  [ANALYTICS_DOMAINS.APPOINTMENTS]: 'analytics.domains.appointments',
  [ANALYTICS_DOMAINS.QUEUE]: 'analytics.domains.queue',
  [ANALYTICS_DOMAINS.BILLING]: 'analytics.domains.billing',
  [ANALYTICS_DOMAINS.STAFF]: 'analytics.domains.staff',
  [ANALYTICS_DOMAINS.CLINICAL]: 'analytics.domains.clinical',
};

// Domains whose service accepts `doctorId` scoping — mirrors the
// backend controller's own `DOCTOR_SCOPED_DOMAINS` set exactly.
const DOCTOR_SCOPED_DOMAINS = new Set([
  ANALYTICS_DOMAINS.OPERATIONAL,
  ANALYTICS_DOMAINS.APPOINTMENTS,
  ANALYTICS_DOMAINS.QUEUE,
]);

const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - ANALYTICS_DEFAULT_RANGE_DAYS);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
};

/**
 * FET-21 — "Analytics" (master prompt's Phase 8 checklist: dashboard
 * analytics, appointment/queue/patient/billing/staff/clinical
 * statistics, charts, filters, date ranges, role-based analytics).
 *
 * A single page with a domain tab strip, backed 1:1 by the real
 * `GET /analytics/:domain` endpoint (BET-20) — every number,
 * breakdown, and series point rendered comes from that response,
 * never computed or estimated client-side. "Role-based analytics"
 * is enforced both ways: the tab strip only shows domains this
 * user's role can actually reach (`ANALYTICS_DOMAIN_META`, mirroring
 * `ANALYTICS_DOMAIN_PERMISSION`), and the backend re-checks the same
 * permission regardless — this page's own gating is UX only.
 *
 * "Patient statistics" is deliberately not its own separate domain
 * tab — the backend has no such endpoint; patient-related counts are
 * covered by the Operational/Appointments domains (appointment
 * volume, queue throughput) and Clinical (consultations/prescriptions/
 * investigations/pregnancy). Inventing a `patients` domain the
 * backend doesn't have would be exactly the "fake functionality"
 * master prompt §79 rules out.
 */
export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const availableDomains = useMemo(
    () => ANALYTICS_DOMAIN_ORDER.filter((d) => ANALYTICS_DOMAIN_META[d].roles.includes(user?.role)),
    [user?.role],
  );

  const [activeDomain, setActiveDomain] = useState(availableDomains[0] || null);
  const [range, setRange] = useState(defaultRange);
  const [granularity, setGranularity] = useState('day');
  const [doctorId, setDoctorId] = useState(undefined);
  const [doctors, setDoctors] = useState(null);

  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  // Only admin-tier roles hold `DOCTORS_READ` (RECEPTIONIST, which
  // also reaches this page, does not) — fetch the doctor filter's
  // options only where that call would actually succeed.
  useEffect(() => {
    if (!ADMIN_TIER_ROLES.includes(user?.role)) return;
    staffService
      .listDoctors({ limit: 200 })
      .then((result) => setDoctors(result.items || []))
      .catch(() => setDoctors(null));
  }, [user?.role]);

  const load = useCallback(() => {
    if (!activeDomain) return;
    setState('loading');
    setErrorMessage('');
    analyticsService
      .getAnalytics(activeDomain, {
        from: range.from,
        to: range.to,
        granularity,
        doctorId: DOCTOR_SCOPED_DOMAINS.has(activeDomain) ? doctorId : undefined,
      })
      .then((result) => {
        setData(result);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  }, [activeDomain, range.from, range.to, granularity, doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!availableDomains.length) {
    return (
      <ErrorState
        title={t('analytics.noAccessTitle')}
        description={t('analytics.noAccessDescription')}
      />
    );
  }

  const Panel = activeDomain ? PANEL_BY_DOMAIN[activeDomain] : null;
  const showDoctorFilter =
    DOCTOR_SCOPED_DOMAINS.has(activeDomain) && user?.role !== ROLES.DOCTOR && doctors;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.analytics') }]}
        title={t('analytics.title')}
        description={t('analytics.description')}
      />

      <TabList
        tabs={availableDomains.map((d) => ({ value: d, label: t(DOMAIN_LABEL_KEY[d]) }))}
        value={activeDomain}
        onChange={setActiveDomain}
      />

      <AnalyticsFilterBar
        from={range.from}
        to={range.to}
        granularity={granularity}
        doctorId={doctorId}
        doctors={showDoctorFilter ? doctors : null}
        onChange={(patch) => {
          if ('from' in patch || 'to' in patch) setRange((prev) => ({ ...prev, ...patch }));
          if ('granularity' in patch) setGranularity(patch.granularity);
          if ('doctorId' in patch) setDoctorId(patch.doctorId);
        }}
      />

      <Card>
        <CardContent>
          {state === 'loading' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
              <Skeleton className="h-56 w-full" />
            </div>
          ) : state === 'error' ? (
            <ErrorState description={errorMessage} onRetry={load} />
          ) : Panel && data ? (
            <Panel data={data} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
