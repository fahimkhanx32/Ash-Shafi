import { Invoice, INVOICE_STATUSES } from '../../billing/models/invoice.model.js';
import { resolveDateRange, granularityToDateFormat } from '../utils/date-range.util.js';

/**
 * BET-20 checkpoint — "Billing analytics" (master prompt §51 —
 * revenue, billing).
 *
 * Gated by `ANALYTICS_BILLING_READ` at the route/controller layer,
 * not `ANALYTICS_READ` — see `security/permissions.js`'s own
 * comment on that permission for why revenue reporting is kept
 * separate from operational analytics. No `doctorId`/ownership
 * scoping here: unlike appointment/queue throughput, billing
 * analytics is never exposed to a `DOCTOR`-role caller at all (no
 * role that lacks `ANALYTICS_BILLING_READ` can reach this service
 * through the route layer), so there is no "see only your own"
 * case to handle.
 *
 * `grandTotal` is used for revenue (the billed amount), while
 * `amountPaid`/`balanceDue` separately drive the collected-vs-
 * outstanding split — matching the fields `invoice.model.js`
 * documents as server-computed and authoritative.
 */
export const getBillingAnalytics = async ({ from, to, granularity } = {}) => {
  const { start, end, granularity: resolvedGranularity } = resolveDateRange({
    from,
    to,
    granularity,
  });

  const match = {
    issuedDate: { $gte: start, $lte: end },
  };

  const dateFormat = granularityToDateFormat(resolvedGranularity);

  const [statusBreakdown, serviceTypeBreakdown, series, totals] = await Promise.all([
    Invoice.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
      { $project: { _id: 0, status: '$_id', count: 1, amount: 1 } },
    ]),
    Invoice.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.serviceType',
          count: { $sum: 1 },
          amount: { $sum: '$items.lineTotal' },
        },
      },
      { $project: { _id: 0, serviceType: '$_id', count: 1, amount: 1 } },
    ]),
    Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$issuedDate' } },
          invoiceCount: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
          collected: { $sum: '$amountPaid' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, bucket: '$_id', invoiceCount: 1, revenue: 1, collected: 1 } },
    ]),
    Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
          collected: { $sum: '$amountPaid' },
          outstanding: { $sum: '$balanceDue' },
          discountTotal: { $sum: '$discountTotal' },
        },
      },
    ]),
  ]);

  const totalsDoc = totals[0] || {
    invoiceCount: 0,
    revenue: 0,
    collected: 0,
    outstanding: 0,
    discountTotal: 0,
  };
  const collectionRate = totalsDoc.revenue ? totalsDoc.collected / totalsDoc.revenue : 0;

  const statusCounts = Object.fromEntries(
    INVOICE_STATUSES.map((status) => [status, { count: 0, amount: 0 }]),
  );
  statusBreakdown.forEach(({ status, count, amount }) => {
    statusCounts[status] = { count, amount };
  });

  return {
    range: { from: start, to: end, granularity: resolvedGranularity },
    summary: {
      invoiceCount: totalsDoc.invoiceCount,
      revenue: totalsDoc.revenue,
      collected: totalsDoc.collected,
      outstanding: totalsDoc.outstanding,
      discountTotal: totalsDoc.discountTotal,
      collectionRate,
    },
    breakdown: {
      byStatus: statusCounts,
      byServiceType: Object.fromEntries(
        serviceTypeBreakdown.map((r) => [r.serviceType, { count: r.count, amount: r.amount }]),
      ),
    },
    series,
  };
};
