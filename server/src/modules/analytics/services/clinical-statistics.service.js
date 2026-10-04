import { Encounter, ENCOUNTER_STATUSES } from '../../encounters/models/encounter.model.js';
import { Prescription, PRESCRIPTION_STATUSES } from '../../prescriptions/models/prescription.model.js';
import {
  Investigation,
  INVESTIGATION_STATUSES,
  isSensitiveInvestigationCategory,
} from '../../investigations/models/investigation.model.js';
import { PregnancyRecord } from '../../obstetrics/models/pregnancy-record.model.js';
import { resolveDateRange, granularityToDateFormat } from '../utils/date-range.util.js';
import { suppressSmallBuckets } from '../utils/cohort.util.js';

/**
 * BET-20 checkpoint — "Clinical statistics where appropriate"
 * (master prompt §51: consultations, prescriptions, investigations,
 * pregnancy statistics).
 *
 * "Where appropriate" is enforced two ways, deliberately layered
 * rather than relying on either alone:
 *
 *   1. Route-level: only `ANALYTICS_CLINICAL_READ` holders
 *      (DIRECTOR/ADMIN/DOCTOR — see `security/permissions.js`) can
 *      reach this service at all.
 *   2. Here, at the aggregation level: every count this service
 *      returns is a `$group` total, never a per-patient record, and
 *      `suppressSmallBuckets` additionally nulls out any bucket
 *      (investigation category, pregnancy-complication type) whose
 *      count falls below `CLINICAL_ANALYTICS_MIN_COHORT_SIZE` — so
 *      even a caller who does hold the permission cannot narrow a
 *      date range or filter down to a single re-identifiable
 *      patient.
 *
 * Investigation categories flagged sensitive
 * (`isSensitiveInvestigationCategory` — reproductive/sexual-health/
 * pregnancy, reused from BET-07/BET-12's own classification) are
 * never broken out by their specific category here, even above the
 * cohort threshold — they are folded into a single
 * `SENSITIVE_CATEGORIES_AGGREGATED` bucket. A category-level count
 * of "42 STI_STD tests this quarter" is still more granular than
 * this project's sensitive-record handling elsewhere allows a
 * non-`SENSITIVE_RECORDS_READ` holder to see, and `ANALYTICS_CLINICAL_
 * READ` is deliberately not the same permission as
 * `SENSITIVE_RECORDS_READ`.
 */
export const getClinicalStatistics = async ({ from, to, granularity } = {}) => {
  const { start, end, granularity: resolvedGranularity } = resolveDateRange({
    from,
    to,
    granularity,
  });

  const [
    encounterStatusBreakdown,
    encounterSeries,
    prescriptionStatusBreakdown,
    investigationStatusBreakdown,
    investigationCategoryBreakdown,
    pregnancyStatusBreakdown,
  ] = await Promise.all([
    Encounter.aggregate([
      { $match: { encounterDate: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
    Encounter.aggregate([
      { $match: { encounterDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: granularityToDateFormat(resolvedGranularity),
              date: '$encounterDate',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, bucket: '$_id', count: 1 } },
    ]),
    Prescription.aggregate([
      { $match: { prescriptionDate: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
    Investigation.aggregate([
      { $match: { orderedDate: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
    Investigation.aggregate([
      { $match: { orderedDate: { $gte: start, $lte: end } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]),
    PregnancyRecord.aggregate([
      // Pregnancy records span months, so this is filtered by
      // whether the record was active/created in-range via `lmp`
      // (last menstrual period, the record's own clinical start
      // date) rather than a single point-in-time field.
      { $match: { lmp: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
  ]);

  const encounterCounts = Object.fromEntries(ENCOUNTER_STATUSES.map((s) => [s, 0]));
  encounterStatusBreakdown.forEach(({ status, count }) => {
    encounterCounts[status] = count;
  });

  const prescriptionCounts = Object.fromEntries(PRESCRIPTION_STATUSES.map((s) => [s, 0]));
  prescriptionStatusBreakdown.forEach(({ status, count }) => {
    prescriptionCounts[status] = count;
  });

  const investigationCounts = Object.fromEntries(INVESTIGATION_STATUSES.map((s) => [s, 0]));
  investigationStatusBreakdown.forEach(({ status, count }) => {
    investigationCounts[status] = count;
  });

  // Fold sensitive categories into one aggregated bucket rather than
  // exposing them individually (see docstring above).
  let sensitiveAggregatedCount = 0;
  const investigationCategoryCounts = {};
  investigationCategoryBreakdown.forEach(({ category, count }) => {
    if (isSensitiveInvestigationCategory(category)) {
      sensitiveAggregatedCount += count;
    } else {
      investigationCategoryCounts[category] = count;
    }
  });
  if (sensitiveAggregatedCount > 0) {
    investigationCategoryCounts.SENSITIVE_CATEGORIES_AGGREGATED = sensitiveAggregatedCount;
  }

  const pregnancyCounts = {};
  pregnancyStatusBreakdown.forEach(({ status, count }) => {
    pregnancyCounts[status] = count;
  });

  return {
    range: { from: start, to: end, granularity: resolvedGranularity },
    consultations: {
      byStatus: encounterCounts,
      total: encounterStatusBreakdown.reduce((sum, r) => sum + r.count, 0),
      series: encounterSeries,
    },
    prescriptions: {
      byStatus: prescriptionCounts,
      total: prescriptionStatusBreakdown.reduce((sum, r) => sum + r.count, 0),
    },
    investigations: {
      byStatus: investigationCounts,
      byCategory: suppressSmallBuckets(investigationCategoryCounts),
      total: investigationStatusBreakdown.reduce((sum, r) => sum + r.count, 0),
    },
    pregnancyStatistics: {
      byStatus: suppressSmallBuckets(pregnancyCounts),
      total: pregnancyStatusBreakdown.reduce((sum, r) => sum + r.count, 0),
    },
  };
};
