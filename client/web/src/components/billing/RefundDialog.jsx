import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import * as paymentsService from '../../services/paymentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatMoney, refundStatusLabel, refundStatusVariant } from '../../constants/billing.js';
import { formatDate } from '../../lib/dateFormat.js';

/**
 * FET-15 — staff-only (`BILLING_WRITE`) refund of a `SUCCEEDED`/
 * `PARTIALLY_REFUNDED` payment (`POST /payments/:id/refund`,
 * BET-15.2). Shows the payment's existing refund history
 * (`GET /payments/:id/refunds`) so staff can see what's already been
 * refunded before requesting more — the backend independently
 * enforces the real remaining-refundable ceiling
 * (`REFUND_EXCEEDS_BALANCE`-style rejection in `payment.service.js`),
 * this dialog just surfaces that history rather than re-deriving it.
 * A refund never resolves to `COMPLETED` here client-side — its
 * status is whatever the provider/manual-reconciliation flow last
 * wrote server-side, same "never fake success" rule `PayInvoiceDialog`
 * already follows.
 */
export default function RefundDialog({ open, onOpenChange, payment, onRefunded }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refunds, setRefunds] = useState([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);

  // `Payment` carries no `refundedAmount` field of its own — the
  // backend derives "remaining refundable" from a live aggregate over
  // `COMPLETED` `Refund` documents each time (`payment.service.js`'s
  // `refundPayment`). Mirrored here the same way rather than trusting
  // any client-cached total, so this dialog's ceiling never drifts
  // from what the server will actually enforce.
  const refundedSoFar = refunds
    .filter((r) => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const remaining = payment ? Number(payment.amount) - refundedSoFar : 0;

  const loadRefunds = async () => {
    if (!payment) return;
    setLoadingRefunds(true);
    try {
      const list = await paymentsService.listRefunds(payment.id);
      setRefunds(list);
      const soFar = list
        .filter((r) => r.status === 'COMPLETED')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const left = Number(payment.amount) - soFar;
      setAmount(left > 0 ? String(left) : '');
    } catch {
      setRefunds([]);
    } finally {
      setLoadingRefunds(false);
    }
  };

  useEffect(() => {
    if (open && payment) {
      setAmount('');
      setReason('');
      setError('');
      loadRefunds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment]);

  if (!payment) return null;

  const handleSubmit = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('billing.refund.invalidAmount'));
      return;
    }
    if (!reason.trim()) {
      setError(t('billing.refund.reasonRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // FET-15 Part 4 — "Refund status". The backend resolves each
      // refund synchronously in this request (manual methods go
      // straight to COMPLETED; gateway refunds return whatever the
      // provider itself reported, COMPLETED or PROCESSING — there is
      // no later webhook that advances a PROCESSING refund further in
      // this codebase, so there is nothing genuine to poll for here,
      // unlike a payment's PENDING → SUCCEEDED wait). The toast and
      // the refreshed history list below reflect that real resulting
      // status honestly rather than always saying "requested".
      const created = await paymentsService.refundPayment(payment.id, { amount: numericAmount, reason: reason.trim() });
      const resultKey =
        created?.status === 'COMPLETED'
          ? 'billing.refund.successCompleted'
          : created?.status === 'PROCESSING'
            ? 'billing.refund.successProcessing'
            : 'billing.refund.success';
      toast({ title: t(resultKey), variant: created?.status === 'FAILED' ? 'destructive' : 'success' });
      setAmount('');
      setReason('');
      await loadRefunds();
      onRefunded?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Undo2 size={16} /> {t('billing.refund.title')}
        </DialogTitle>
        <DialogDescription>
          {t('billing.refund.description', {
            reference: payment.paymentReference,
            amount: formatMoney(payment.amount, payment.currency),
          })}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {remaining <= 0 ? (
          <Alert variant="default">
            <AlertDescription>{t('billing.refund.fullyRefunded')}</AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t('billing.refund.remaining', { amount: formatMoney(remaining, payment.currency) })}
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="refund-amount">
                {t('billing.refund.amountLabel')}
              </label>
              <input
                id="refund-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="refund-reason">
                {t('billing.refund.reasonLabel')}
              </label>
              <textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">{t('billing.refund.history')}</p>
          {loadingRefunds ? (
            <Skeleton className="h-10 w-full" />
          ) : refunds.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('billing.refund.historyEmpty')}</p>
          ) : (
            <ul className="space-y-1.5">
              {refunds.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Badge variant={refundStatusVariant(r.status)}>{refundStatusLabel(r.status, t)}</Badge>
                    {formatMoney(r.amount, payment.currency)} · {formatDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          {t('common.close')}
        </Button>
        {remaining > 0 ? (
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('common.saving') : t('billing.refund.submit')}
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}
