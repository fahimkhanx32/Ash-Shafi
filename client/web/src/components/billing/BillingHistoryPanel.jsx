import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Wallet, Undo2, History } from 'lucide-react';

import {
  invoiceStatusLabel,
  invoiceStatusVariant,
  paymentStatusLabel,
  paymentStatusVariant,
  formatMoney,
} from '../../constants/billing.js';
import { formatDate } from '../../lib/dateFormat.js';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';

/**
 * FET-15 — "Billing history". Merges two already-paginated,
 * already-fetched sources (recent invoices + recent payments, each
 * fetched with the same bounded `limit` their own tabs already use —
 * this never issues its own unbounded fetch) into one chronological
 * feed, newest first. A genuine full audit trail for one invoice
 * already exists in `InvoiceDetailDialog`; this panel is the
 * "what's happened across my/this account recently" view the
 * checklist's "Billing history" item asks for, not a duplicate of
 * that per-invoice detail.
 *
 * `invoices`/`payments` are passed in already loaded by the caller
 * (`MyBillingView`/`PatientBillingTab`) — this component holds no
 * fetch logic of its own so it never diverges from what those tabs'
 * own state already reflects.
 */
export default function BillingHistoryPanel({ invoices, payments, state, errorMessage, onRetry }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const invoiceEvents = (invoices || []).map((invoice) => ({
      kind: 'invoice',
      id: `invoice-${invoice.id}`,
      date: invoice.issuedDate,
      invoice,
    }));
    const paymentEvents = (payments || []).map((payment) => ({
      kind: 'payment',
      id: `payment-${payment.id}`,
      date: payment.createdAt,
      payment,
    }));
    const merged = [...invoiceEvents, ...paymentEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    setEvents(merged);
  }, [invoices, payments]);

  if (state === 'loading') return <SkeletonList rows={5} />;
  if (state === 'error') return <ErrorState description={errorMessage} onRetry={onRetry} />;
  if (events.length === 0) {
    return <EmptyState icon={History} title={t('billing.history.emptyTitle')} description={t('billing.history.emptyDescription')} />;
  }

  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-one-ui">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/60 text-accent-foreground">
            {event.kind === 'invoice' ? <FileText size={15} /> : <Wallet size={15} />}
          </div>
          <div className="min-w-0 flex-1">
            {event.kind === 'invoice' ? (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {t('billing.history.invoiceIssued', { number: event.invoice.invoiceNumber })}
                  </p>
                  <Badge variant={invoiceStatusVariant(event.invoice.status)}>
                    {invoiceStatusLabel(event.invoice.status, t)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatMoney(event.invoice.grandTotal, event.invoice.currency)} · {formatDate(event.date)}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {(event.payment.status === 'REFUNDED' || event.payment.status === 'PARTIALLY_REFUNDED') && (
                      <Undo2 size={12} className="text-muted-foreground" />
                    )}
                    {t('billing.history.payment', { reference: event.payment.paymentReference })}
                  </p>
                  <Badge variant={paymentStatusVariant(event.payment.status)}>
                    {paymentStatusLabel(event.payment.status, t)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatMoney(event.payment.amount, event.payment.currency)} · {t(`billing.method.${event.payment.method}`)} · {formatDate(event.date)}
                </p>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
