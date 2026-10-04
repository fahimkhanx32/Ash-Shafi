import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, Ban, Undo2, RefreshCw, Download } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import * as paymentsService from '../../services/paymentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatMoney, paymentStatusLabel, paymentStatusVariant } from '../../constants/billing.js';
import { formatDate } from '../../lib/dateFormat.js';

const POLL_INTERVAL_MS = 4000;
const MAX_AUTO_POLLS = 20; // ~80s of auto-polling before requiring a manual refresh

/**
 * FET-15 (Part 3/4) — "Payment status" + "Payment success/failure" +
 * "Provider-specific UI". A single, live, pollable view of one
 * `Payment`'s real server-side status (`GET /payments/:id`) — most
 * useful right after `PayInvoiceDialog` opens a gateway checkout tab,
 * where the patient has no other way to know whether the webhook has
 * landed yet without leaving to the Payments tab and refreshing by
 * hand.
 *
 * Never infers success from the redirect having happened — this
 * dialog shows exactly whatever `status` the server last wrote
 * (master prompt §36, same rule `PayInvoiceDialog`/`paymentsService.js`
 * already document) and polls a bounded number of times rather than
 * forever, since a webhook that never lands is itself useful
 * information (the payment stays `PENDING`, cancellable) rather than
 * something to paper over with an endless spinner.
 *
 * `provider`/`providerTransactionId` are shown whenever the backend
 * populated them (a configured, real gateway) — in this environment's
 * unconfigured default they stay unset, matching what
 * `gateway-payment.provider.js` itself documents about `.env`
 * `PAYMENT_*` being blank.
 */
export default function PaymentStatusDialog({ open, onOpenChange, paymentId, onChanged, onRequestRefund }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [payment, setPayment] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);

  const load = useCallback(
    async (silent = false) => {
      if (!paymentId) return;
      if (!silent) setState('loading');
      setErrorMessage('');
      try {
        const result = await paymentsService.getPayment(paymentId);
        setPayment(result);
        setState('ready');
        return result;
      } catch (error) {
        setErrorMessage(extractApiError(error).message);
        setState('error');
        return null;
      }
    },
    [paymentId],
  );

  useEffect(() => {
    if (open && paymentId) {
      pollCountRef.current = 0;
      load();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paymentId]);

  // Auto-poll only while genuinely PENDING and the dialog is open —
  // stops the moment the server reports a terminal status, and caps
  // out after MAX_AUTO_POLLS rather than polling forever.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!open || !payment || payment.status !== 'PENDING') return undefined;
    if (pollCountRef.current >= MAX_AUTO_POLLS) return undefined;

    timerRef.current = setTimeout(() => {
      pollCountRef.current += 1;
      load(true);
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, payment, load]);

  const handleCancel = async () => {
    const ok = await confirm({
      title: t('billing.payments.cancelPendingTitle'),
      description: t('billing.payments.cancelPendingDescription'),
      confirmLabel: t('billing.payments.cancelPendingConfirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await paymentsService.cancelPendingPayment(paymentId, {});
      toast({ title: t('billing.payments.cancelPendingSuccess'), variant: 'success' });
      await load();
      onChanged?.();
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const handleReceiptDownload = async () => {
    setDownloadingReceipt(true);
    try {
      const url = await paymentsService.getPaymentReceiptBlobUrl(paymentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setDownloadingReceipt(false);
    }
  };

  if (!paymentId) return null;

  const isPending = payment?.status === 'PENDING';
  const isSucceeded = payment?.status === 'SUCCEEDED' || payment?.status === 'PARTIALLY_REFUNDED';
  const isTerminalFailure = payment?.status === 'FAILED' || payment?.status === 'CANCELLED';
  const providerLabel = payment?.provider && payment.provider !== 'manual' ? payment.provider : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('billing.status.dialogTitle')}</DialogTitle>
        {payment ? (
          <DialogDescription>
            {t('billing.status.dialogDescription', { reference: payment.paymentReference })}
          </DialogDescription>
        ) : null}
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {state === 'loading' ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : state === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : payment ? (
          <>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-accent/20 py-6 text-center">
              {isPending ? (
                <Loader2 className="animate-spin text-amber-600 dark:text-amber-400" size={32} />
              ) : isSucceeded ? (
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={32} />
              ) : isTerminalFailure ? (
                <XCircle className="text-red-600 dark:text-red-400" size={32} />
              ) : (
                <Undo2 className="text-muted-foreground" size={32} />
              )}
              <Badge variant={paymentStatusVariant(payment.status)} className="text-sm">
                {paymentStatusLabel(payment.status, t)}
              </Badge>
              <p className="text-2xl font-semibold">{formatMoney(payment.amount, payment.currency)}</p>
              {isPending ? (
                <p className="text-xs text-muted-foreground max-w-xs px-4">{t('billing.status.pendingHint')}</p>
              ) : null}
            </div>

            {payment.status === 'FAILED' && payment.failureReason ? (
              <Alert variant="destructive">
                <AlertDescription>{payment.failureReason}</AlertDescription>
              </Alert>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('billing.payments.method')}</dt>
              <dd className="text-right">{t(`billing.method.${payment.method}`)}</dd>
              <dt className="text-muted-foreground">{t('billing.payments.date')}</dt>
              <dd className="text-right">{formatDate(payment.createdAt)}</dd>
              {providerLabel ? (
                <>
                  <dt className="text-muted-foreground">{t('billing.status.provider')}</dt>
                  <dd className="text-right">{providerLabel}</dd>
                </>
              ) : null}
              {payment.providerTransactionId ? (
                <>
                  <dt className="text-muted-foreground">{t('billing.status.providerReference')}</dt>
                  <dd className="text-right font-mono text-xs break-all">{payment.providerTransactionId}</dd>
                </>
              ) : null}
            </dl>
          </>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.close')}
        </Button>
        {isPending ? (
          <>
            <Button type="button" variant="outline" onClick={() => load()}>
              <RefreshCw size={14} /> {t('billing.status.checkAgain')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={cancelling}>
              <Ban size={14} /> {t('billing.payments.cancelPending')}
            </Button>
          </>
        ) : null}
        {isSucceeded ? (
          <Button type="button" onClick={handleReceiptDownload} disabled={downloadingReceipt}>
            <Download size={14} /> {t('billing.detail.receipt')}
          </Button>
        ) : null}
        {isSucceeded && onRequestRefund ? (
          <Button type="button" variant="outline" onClick={() => onRequestRefund(payment)}>
            <Undo2 size={14} /> {t('billing.refund.action')}
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}
