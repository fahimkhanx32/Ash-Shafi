import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet } from 'lucide-react';

import { extractApiError } from '../../services/apiClient.js';
import { invoiceStatusLabel, invoiceStatusVariant, formatMoney } from '../../constants/billing.js';
import { formatDate } from '../../lib/dateFormat.js';
import { Badge } from '../ui/badge.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';

const OUTSTANDING_STATUSES = ['ISSUED', 'PARTIALLY_PAID'];

/**
 * FET-15 — "Balances". An invoice's `balanceDue` is only ever
 * server-computed; this panel deliberately does NOT fetch every
 * invoice into the browser to sum a grand total (master prompt §64,
 * "large datasets must paginate server-side, never load everything
 * into the browser" — the same rule `Pagination`'s own comment
 * documents). Instead it's a real, server-paginated list of invoices
 * that still carry an outstanding balance (`ISSUED`/`PARTIALLY_PAID`
 * — the only two statuses `balanceDue` can be positive for), one
 * status at a time via a toggle, with the true sum of only the
 * *currently shown page* labelled honestly as such rather than
 * implied to be a system-wide total.
 *
 * `fetchInvoices(params)` is caller-supplied (`billingService.listInvoices`
 * for staff, a `getMyInvoices`-shaped wrapper for the self-service
 * view) so this one panel works for both `StaffBillingView` and
 * `MyBillingView`/`PatientBillingTab` without duplicating the fetch
 * logic three times.
 */
export default function OutstandingBalancesPanel({ fetchInvoices, onSelectInvoice }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState('ISSUED');
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await fetchInvoices({ status, page, limit: 10 });
      setInvoices(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [fetchInvoices, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const pageTotal = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0);
  const currency = invoices[0]?.currency || 'BDT';

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {OUTSTANDING_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`h-9 rounded-full border px-3.5 text-xs font-medium transition-colors ${
              status === value
                ? 'border-primary bg-accent/50 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent/30'
            }`}
          >
            {invoiceStatusLabel(value, t)}
          </button>
        ))}
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={4} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : invoices.length === 0 ? (
        <EmptyState icon={Wallet} title={t('billing.balances.emptyTitle')} description={t('billing.balances.emptyDescription')} />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {t('billing.balances.pageTotal', { amount: formatMoney(pageTotal, currency) })}
          </p>
          <div className="grid gap-3">
            {invoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                onClick={() => onSelectInvoice?.(invoice.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(invoice.issuedDate)}</p>
                  </div>
                  <Badge variant={invoiceStatusVariant(invoice.status)}>{invoiceStatusLabel(invoice.status, t)}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t('billing.detail.grandTotal')}: <span className="font-medium text-foreground">{formatMoney(invoice.grandTotal, invoice.currency)}</span>
                  </p>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {formatMoney(invoice.balanceDue, invoice.currency)} {t('billing.due')}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <Pagination className="mt-4" page={pagination?.page || page} totalPages={pagination?.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
