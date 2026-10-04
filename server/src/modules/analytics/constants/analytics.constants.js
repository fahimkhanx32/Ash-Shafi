import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-20 — Secure Analytics.
 *
 * Every analytics domain this checkpoint covers, and which
 * permission gates it. Same two-layer shape `EXPORT_ENTITY_PERMISSION`
 * (BET-19, `modules/exports/constants/export.constants.js`) already
 * established: the route param picks a domain, the controller looks
 * up the required permission here rather than hard-coding a fixed
 * `authorize(...)` per route, since `/analytics/:domain` can't know
 * which permission applies until it sees the param.
 *
 * `operational` deliberately aggregates appointment + queue + staff
 * summaries into one lightweight "how is the clinic running today"
 * response (master prompt §51's "operational performance") rather
 * than being its own from-scratch pipeline — it reuses the same
 * three domain services under the hood (see
 * `services/operational-analytics.service.js`).
 */
export const ANALYTICS_DOMAINS = Object.freeze({
  OPERATIONAL: 'operational',
  APPOINTMENTS: 'appointments',
  QUEUE: 'queue',
  BILLING: 'billing',
  STAFF: 'staff',
  CLINICAL: 'clinical',
});

export const ANALYTICS_DOMAIN_PERMISSION = Object.freeze({
  [ANALYTICS_DOMAINS.OPERATIONAL]: PERMISSIONS.ANALYTICS_READ,
  [ANALYTICS_DOMAINS.APPOINTMENTS]: PERMISSIONS.ANALYTICS_READ,
  [ANALYTICS_DOMAINS.QUEUE]: PERMISSIONS.ANALYTICS_READ,
  [ANALYTICS_DOMAINS.STAFF]: PERMISSIONS.ANALYTICS_READ,
  [ANALYTICS_DOMAINS.BILLING]: PERMISSIONS.ANALYTICS_BILLING_READ,
  [ANALYTICS_DOMAINS.CLINICAL]: PERMISSIONS.ANALYTICS_CLINICAL_READ,
});

export const ANALYTICS_GRANULARITIES = Object.freeze(['day', 'week', 'month']);

/**
 * Master prompt §51 — "sensitive analytics must use permission
 * control" / "where possible, use aggregated/de-identified data".
 * Applied in `clinical-statistics.service.js`: any breakdown bucket
 * (e.g. a single day, a single diagnosis category) whose underlying
 * count falls below this threshold is suppressed rather than
 * returned, so a narrow date range or filter combination can never
 * be used to re-identify an individual patient from an "aggregate"
 * clinical count of 1.
 */
export const CLINICAL_ANALYTICS_MIN_COHORT_SIZE = 5;

/**
 * Caps how wide a single query's date range may be, so an
 * unbounded `from`/`to` can't force a full-collection aggregation
 * scan — same cost-control rationale BET-19's tabular export
 * validators already apply to bulk reads.
 */
export const ANALYTICS_MAX_RANGE_DAYS = 366;

/** Default lookback window when no `from`/`to` is supplied. */
export const ANALYTICS_DEFAULT_RANGE_DAYS = 30;
