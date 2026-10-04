import { AppError } from '../../../middlewares/error.middleware.js';
import {
  ANALYTICS_DEFAULT_RANGE_DAYS,
  ANALYTICS_GRANULARITIES,
  ANALYTICS_MAX_RANGE_DAYS,
} from '../constants/analytics.constants.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * BET-20 — shared `from`/`to`/`granularity` resolution for every
 * analytics service. Deliberately its own small utility rather than
 * duplicated per-service — every domain (appointments, queue,
 * billing, staff, clinical) filters and buckets on a date range the
 * same way, and this is the one place `ANALYTICS_MAX_RANGE_DAYS`
 * (cost control) is enforced, so a future domain can't accidentally
 * skip it by hand-rolling its own parsing.
 *
 * `from`/`to` are already validated as ISO date strings by
 * `validators/analytics.validation.js` before this runs — this
 * function's own errors are for range-logic problems (`to` before
 * `from`, range too wide) that shape validation can't catch on its
 * own.
 */
export const resolveDateRange = ({ from, to, granularity } = {}) => {
  const now = new Date();
  const end = to ? new Date(to) : now;
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - ANALYTICS_DEFAULT_RANGE_DAYS * DAY_MS);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('Invalid date range.', 400, { code: 'INVALID_DATE_RANGE' });
  }

  if (start > end) {
    throw new AppError('"from" must be before "to".', 400, {
      code: 'INVALID_DATE_RANGE',
    });
  }

  const rangeDays = (end.getTime() - start.getTime()) / DAY_MS;
  if (rangeDays > ANALYTICS_MAX_RANGE_DAYS) {
    throw new AppError(
      `Date range too wide — maximum is ${ANALYTICS_MAX_RANGE_DAYS} days.`,
      400,
      { code: 'DATE_RANGE_TOO_WIDE' },
    );
  }

  const resolvedGranularity = ANALYTICS_GRANULARITIES.includes(granularity)
    ? granularity
    : 'day';

  return { start, end, granularity: resolvedGranularity };
};

/**
 * Maps a granularity to the Mongo `$dateTrunc`/`$dateToString`
 * format used to bucket a time series in an aggregation pipeline.
 */
export const granularityToDateFormat = (granularity) => {
  switch (granularity) {
    case 'month':
      return '%Y-%m';
    case 'week':
      // ISO week — %G/%V pairs correctly across year boundaries,
      // unlike %Y/%V which mislabels the first/last week of a year.
      return '%G-W%V';
    case 'day':
    default:
      return '%Y-%m-%d';
  }
};
