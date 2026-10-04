import { ANALYTICS_ACCESS_ROLES, ANALYTICS_BILLING_ROLES, ANALYTICS_CLINICAL_ROLES } from './roles.js';

/**
 * FET-21 — Analytics, Reporting & Import/Export.
 *
 * Mirrors `server/src/modules/analytics/constants/analytics.constants.js`'s
 * `ANALYTICS_DOMAINS` exactly. Each domain also carries the role list
 * that may view it (UX-only — `authorize()`-equivalent permission
 * check happens server-side in `analytics.controller.js` regardless
 * of what this drives) and a display label, so `AnalyticsPage.jsx`
 * can build its tab strip from one table instead of hand-listing
 * six near-identical cases.
 */
export const ANALYTICS_DOMAINS = Object.freeze({
  OPERATIONAL: 'operational',
  APPOINTMENTS: 'appointments',
  QUEUE: 'queue',
  BILLING: 'billing',
  STAFF: 'staff',
  CLINICAL: 'clinical',
});

export const ANALYTICS_DOMAIN_META = Object.freeze({
  [ANALYTICS_DOMAINS.OPERATIONAL]: { label: 'Overview', roles: ANALYTICS_ACCESS_ROLES },
  [ANALYTICS_DOMAINS.APPOINTMENTS]: { label: 'Appointments', roles: ANALYTICS_ACCESS_ROLES },
  [ANALYTICS_DOMAINS.QUEUE]: { label: 'Queue', roles: ANALYTICS_ACCESS_ROLES },
  [ANALYTICS_DOMAINS.STAFF]: { label: 'Staff', roles: ANALYTICS_ACCESS_ROLES },
  [ANALYTICS_DOMAINS.BILLING]: { label: 'Billing', roles: ANALYTICS_BILLING_ROLES },
  [ANALYTICS_DOMAINS.CLINICAL]: { label: 'Clinical', roles: ANALYTICS_CLINICAL_ROLES },
});

// Order the tab strip renders in.
export const ANALYTICS_DOMAIN_ORDER = [
  ANALYTICS_DOMAINS.OPERATIONAL,
  ANALYTICS_DOMAINS.APPOINTMENTS,
  ANALYTICS_DOMAINS.QUEUE,
  ANALYTICS_DOMAINS.BILLING,
  ANALYTICS_DOMAINS.STAFF,
  ANALYTICS_DOMAINS.CLINICAL,
];

export const ANALYTICS_GRANULARITIES = Object.freeze(['day', 'week', 'month']);

export const GRANULARITY_LABELS = Object.freeze({
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
});

// Same 30-day default the backend's `ANALYTICS_DEFAULT_RANGE_DAYS`
// falls back to when `from`/`to` are omitted — used here only to
// pre-fill the date-range inputs so the page never opens on an
// empty/uninformative-looking control.
export const ANALYTICS_DEFAULT_RANGE_DAYS = 30;

// Preset quick-filter ranges shown above the custom from/to inputs.
export const ANALYTICS_RANGE_PRESETS = Object.freeze([
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: 366 },
]);
