import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Download, Ban, Tag, Banknote, Undo2, XCircle, Activity } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import * as billingService from '../../services/billingService.js';
import * as paymentsService from '../../services/paymentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import {
  invoiceStatusLabel,
  invoiceStatusVariant,
  paymentStatusLabel,
  paymentStatusVariant,
  serviceTypeLabel,
  formatMoney,
} from '../../constants/billing.js';
import { formatDate } from '../../lib/dateFormat.js';
import PayInvoiceDialog from './PayInvoiceDialog.jsx';
import RecordManualPaymentDialog from './RecordManualPaymentDialog.jsx';
import RefundDialog from './RefundDialog.jsx';
import PaymentStatusDialog from './PaymentStatusDialog.jsx';

/**
 * FET-12 — shared invoice detail view. `canPay` (PATIENT, own
 * invoice) and `canManage` (BILLING_STAFF_ROLES) are mutually
 * exclusive booleans the caller passes in — this dialog itself holds
 * no role logic beyond "show the button I was told I could show",
 * same delegation `PatientWorkspacePage`'s tabs already use.
 */
export default function InvoiceDetailDialog({ open, onOpenChange, invoiceId, canPay, canManage, onChanged }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  // FET-15 — staff manual-payment recording + refund + cancel-pending
  // actions live directly on this dialog's payments list, next to
  // the receipt link already there, rather than as separate pages —
  // they all act on "this invoice's payments" as a unit.
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [refundingPayment, setRefundingPayment] = useState(null);
  const [cancellingPaymentId, setCancellingPaymentId] = useState(null);
  const [statusPaymentId, setStatusPaymentId] = useState(null);
  // FET-15 — per-item discount editor (`PATCH /invoices/:id/discount`,
  // BET-15.1). `discountingItemId` is the item currently being edited
  // (only one row open at a time); `discountAmount` is the raw text
  // input, validated/parsed only on submit — never trusted as a
  // number until then.
  const [discountingItemId, setDiscountingItemId] = useState(null);
  const [discountAmount, setDiscountAmount] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const load = async () => {
    if (!invoiceId) return;
    setState('loading');
    try {
      const fetchInvoice = canManage ? billingService.getInvoice : billingService.getMyInvoice;
      // FET-15 fix: `canManage` (staff) must list payments for *this*
      // invoice via `GET /payments?invoiceId=` (BILLING_READ) — the
      // self-service `GET /payments/me` used below only ever returns
      // the signed-in actor's own payments, which for a staff member
      // viewing a patient's invoice is never the right set (previously
      // always rendered empty/wrong for the staff view).
      const fetchPayments = canManage
        ? paymentsService.listPayments({ invoiceId, limit: 50 })
        : paymentsService.getMyPayments({ limit: 50 });
      const [invoiceResult, paymentsResult] = await Promise.all([
        fetchInvoice(invoiceId),
        fetchPayments.catch(() => ({ items: [] })),
      ]);
      setInvoice(invoiceResult);
      setPayments(
        canManage
          ? paymentsResult.items || []
          : (paymentsResult.items || []).filter((p) => (p.invoice?.id || p.invoice) === invoiceId),
      );
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  const handleCancel = async () => {
    const ok = await confirm({
      title: t('billing.cancel.title'),
      description: t('billing.cancel.description'),
      confirmLabel: t('billing.cancel.confirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await billingService.cancelInvoice(invoice.id, {});
      toast({ title: t('billing.cancel.success'), variant: 'success' });
      onChanged?.();
      await load();
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelPayment = async (paymentId) => {
    const ok = await confirm({
      title: t('billing.payments.cancelPendingTitle'),
      description: t('billing.payments.cancelPendingDescription'),
      confirmLabel: t('billing.payments.cancelPendingConfirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    setCancellingPaymentId(paymentId);
    try {
      await paymentsService.cancelPendingPayment(paymentId, {});
      toast({ title: t('billing.payments.cancelPendingSuccess'), variant: 'success' });
      onChanged?.();
      await load();
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setCancellingPaymentId(null);
    }
  };

  const startDiscount = (item) => {
    setDiscountingItemId(item._id || item.id);
    setDiscountAmount(item.discountAmount ? String(item.discountAmount) : '');
    setDiscountError('');
  };

  const cancelDiscount = () => {
    setDiscountingItemId(null);
    setDiscountAmount('');
    setDiscountError('');
  };

  const handleApplyDiscount = async () => {
    const amount = Number(discountAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setDiscountError(t('billing.discount.invalidAmount'));
      return;
    }
    setApplyingDiscount(true);
    setDiscountError('');
    try {
      await billingService.applyDiscount(invoice.id, { itemId: discountingItemId, discountAmount: amount });
      toast({ title: t('billing.discount.success'), variant: 'success' });
      cancelDiscount();
      onChanged?.();
      await load();
    } catch (error) {
      setDiscountError(extractApiError(error).message);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleReceiptDownload = async (paymentId) => {
    setDownloadingReceiptId(paymentId);
    try {
      const url = await paymentsService.getPaymentReceiptBlobUrl(paymentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
        <DialogCloseButton onClose={() => onOpenChange(false)} />
        {state === 'loading' ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : state === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : invoice ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {invoice.invoiceNumber}
                <Badge variant={invoiceStatusVariant(invoice.status)}>{invoiceStatusLabel(invoice.status, t)}</Badge>
              </DialogTitle>
              <DialogDescription>
                {t('billing.detail.issued', { date: formatDate(invoice.issuedDate) })}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {(invoice.items || []).map((item) => {
                  const itemId = item._id || item.id;
                  const canDiscountThisItem =
                    canManage && invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && invoice.status !== 'REFUNDED';
                  return (
                    <div key={itemId} className="px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {serviceTypeLabel(item.serviceType, t)} · x{item.quantity}
                            {item.discountAmount > 0 ? (
                              <span className="ml-1 text-emerald-700 dark:text-emerald-400">
                                · -{formatMoney(item.discountAmount, invoice.currency)} {t('billing.detail.discount')}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <p className="font-medium">{formatMoney(item.lineTotal, invoice.currency)}</p>
                          {canDiscountThisItem && discountingItemId !== itemId ? (
                            <button
                              type="button"
                              onClick={() => startDiscount(item)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Tag size={12} /> {t('billing.discount.action')}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {discountingItemId === itemId ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            autoFocus
                            className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
                            placeholder={t('billing.discount.amountLabel')}
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                            disabled={applyingDiscount}
                          />
                          <Button type="button" size="sm" onClick={handleApplyDiscount} disabled={applyingDiscount}>
                            {applyingDiscount ? t('common.saving') : t('billing.discount.submit')}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelDiscount} disabled={applyingDiscount}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      ) : null}
                      {discountingItemId === itemId && discountError ? (
                        <p className="mt-1 text-xs text-destructive">{discountError}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('billing.detail.subtotal')}</span>
                  <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.discountTotal > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('billing.detail.discount')}</span>
                    <span>-{formatMoney(invoice.discountTotal, invoice.currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-semibold">
                  <span>{t('billing.detail.grandTotal')}</span>
                  <span>{formatMoney(invoice.grandTotal, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('billing.detail.amountPaid')}</span>
                  <span>{formatMoney(invoice.amountPaid, invoice.currency)}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-700 dark:text-amber-300">
                  <span>{t('billing.detail.balanceDue')}</span>
                  <span>{formatMoney(invoice.balanceDue, invoice.currency)}</span>
                </div>
              </div>

              {payments.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{t('billing.detail.payments')}</p>
                  <ul className="space-y-1.5">
                    {payments.map((p) => {
                      const canCancelThis = p.status === 'PENDING' && (canManage || canPay);
                      const canRefundThis = canManage && (p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED');
                      return (
                        <li key={p.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="flex items-center gap-2">
                              <Badge variant={paymentStatusVariant(p.status)}>{paymentStatusLabel(p.status, t)}</Badge>
                              {formatMoney(p.amount, p.currency)} · {formatDate(p.createdAt)}
                            </span>
                            <span className="flex items-center gap-3 shrink-0">
                              <button
                                type="button"
                                onClick={() => setStatusPaymentId(p.id)}
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <Activity size={12} /> {t('billing.status.view')}
                              </button>
                              {p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED' ? (
                                <button
                                  type="button"
                                  onClick={() => handleReceiptDownload(p.id)}
                                  disabled={downloadingReceiptId === p.id}
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Download size={12} /> {t('billing.detail.receipt')}
                                </button>
                              ) : null}
                              {canRefundThis ? (
                                <button
                                  type="button"
                                  onClick={() => setRefundingPayment(p)}
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Undo2 size={12} /> {t('billing.refund.action')}
                                </button>
                              ) : null}
                              {canCancelThis ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancelPayment(p.id)}
                                  disabled={cancellingPaymentId === p.id}
                                  className="flex items-center gap-1 text-destructive hover:underline"
                                >
                                  <XCircle size={12} /> {t('billing.payments.cancelPending')}
                                </button>
                              ) : null}
                            </span>
                          </div>
                          {p.method ? (
                            <p className="mt-1 text-muted-foreground">
                              {t(`billing.method.${p.method}`)}
                              {p.provider && p.provider !== 'manual' ? ` · ${p.provider}` : ''}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              {canManage && invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' ? (
                <Button type="button" variant="destructive" onClick={handleCancel} disabled={cancelling}>
                  <Ban size={14} /> {t('billing.cancel.action')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
              {canManage && invoice.balanceDue > 0 && invoice.status !== 'CANCELLED' ? (
                <Button data-voice-dialog="recordPayment" type="button" variant="outline" onClick={() => setManualPaymentOpen(true)}>
                  <Banknote size={14} /> {t('billing.manualPayment.action')}
                </Button>
              ) : null}
              {canPay && invoice.balanceDue > 0 && invoice.status !== 'CANCELLED' ? (
                <Button type="button" onClick={() => setPayOpen(true)}>
                  <Wallet size={14} /> {t('billing.pay.action')}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </Dialog>

      <PayInvoiceDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoice={invoice}
        onInitiated={() => {
          onChanged?.();
        }}
      />
      <RecordManualPaymentDialog
        open={manualPaymentOpen}
        onOpenChange={setManualPaymentOpen}
        invoice={invoice}
        onRecorded={() => {
          onChanged?.();
          load();
        }}
      />
      <RefundDialog
        open={Boolean(refundingPayment)}
        onOpenChange={(v) => !v && setRefundingPayment(null)}
        payment={refundingPayment}
        onRefunded={() => {
          onChanged?.();
          load();
        }}
      />
      <PaymentStatusDialog
        open={Boolean(statusPaymentId)}
        onOpenChange={(v) => !v && setStatusPaymentId(null)}
        paymentId={statusPaymentId}
        onChanged={() => {
          onChanged?.();
          load();
        }}
        onRequestRefund={canManage ? (payment) => {
          setStatusPaymentId(null);
          setRefundingPayment(payment);
        } : null}
      />
    </>
  );
}
