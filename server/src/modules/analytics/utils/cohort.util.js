import { CLINICAL_ANALYTICS_MIN_COHORT_SIZE } from '../constants/analytics.constants.js';

/**
 * BET-20 — "Sensitive-data protection" for clinical statistics.
 * Master prompt §51: "Sensitive analytics must use permission
 * control" and "where possible, use aggregated/de-identified data
 * for statistics."
 *
 * Given a `{ key: count }` breakdown, replaces any bucket whose
 * count is below `CLINICAL_ANALYTICS_MIN_COHORT_SIZE` with `null`
 * rather than the real number (or omitting the key) — so a
 * DOCTOR/ADMIN/DIRECTOR viewing, say, a category breakdown for a
 * narrow date range can never read off "1 STI_STD investigation
 * this week" and infer which specific patient that was. The bucket
 * key itself is preserved either way (never dropped) so consumers
 * get a stable shape and can render "— (below reporting threshold)"
 * instead of a missing row.
 */
export const suppressSmallBuckets = (
  breakdown,
  minSize = CLINICAL_ANALYTICS_MIN_COHORT_SIZE,
) =>
  Object.fromEntries(
    Object.entries(breakdown).map(([key, count]) => [
      key,
      count > 0 && count < minSize ? null : count,
    ]),
  );
