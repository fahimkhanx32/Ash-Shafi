import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Undo2, XCircle, Wallet, Activity } from 'lucide-react';

import * as paymentsService from '../../services/paymentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import {
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  paymentStatusLabel,
  paymentStatusVariant,
  formatMoney,
} from '../../constants/billing.js';
import { formatDate } from '../../lib/dateFormat.js';
import { Badge } from '../ui/badge.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table.jsx';
import RefundDialog from './RefundDialog.jsx';
import PaymentStatusDialog from './PaymentStatusDialog.jsx';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-15 — the staff (`BILLING_READ`/`BILLING_WRITE`) payments
 * roster (`GET /payments`, BET-15.2) — every payment across every
 * patient, filterable by status/method, with the same refund/cancel/
 * receipt actions `InvoiceDetailDialog` already offers per-invoice,
 * now available without having to first locate the invoice. Real
 * server-side pagination throughout, same discipline as the invoices
 * roster.
 */
export default function PaymentsRosterPanel({ onOpenInvoice }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [refundingPayment, setRefundingPayment] = useState(null);
  const [statusPaymentId, setStatusPaymentId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await paymentsService.listPayments({
        page,
        limit: 20,
        ...(status ? { status } : {}),
        ...(method ? { method } : {}),
      });
      setPayments(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, status, method]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, method]);

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

  const handleCancel = async (paymentId) => {
    const ok = await confirm({
      title: t('billing.payments.cancelPendingTitle'),
      description: t('billing.payments.cancelPendingDescription'),
      confirmLabel: t('billing.payments.cancelPendingConfirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    setCancellingId(paymentId);
    try {
      await paymentsService.cancelPendingPayment(paymentId, {});
      toast({ title: t('billing.payments.cancelPendingSuccess'), variant: 'success' });
      load();
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('billing.payments.status')}>
          <option value="">{t('billing.allStatuses')}</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {paymentStatusLabel(value, t)}
            </option>
          ))}
        </select>
        <select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value)} aria-label={t('billing.payments.method')}>
          <option value="">{t('billing.payments.allMethods')}</option>
          {PAYMENT_METHODS.map((value) => (
            <option key={value} value={value}>
              {t(`billing.method.${value}`)}
            </option>
          ))}
        </select>
      </div>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('billing.payments.reference')}</TableHead>
                <TableHead hideBelow="sm">{t('billing.payments.method')}</TableHead>
                <TableHead>{t('billing.payments.amount')}</TableHead>
                <TableHead>{t('billing.payments.status')}</TableHead>
                <TableHead hideBelow="md">{t('billing.payments.date')}</TableHead>
                <TableHead>{t('billing.payments.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={6} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : payments.length === 0 ? (
        <EmptyState icon={Wallet} title={t('billing.empty.paymentsTitle')} description={t('billing.empty.rosterPaymentsDescription')} />
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.payments.reference')}</TableHead>
                  <TableHead hideBelow="sm">{t('billing.payments.method')}</TableHead>
                  <TableHead>{t('billing.payments.amount')}</TableHead>
                  <TableHead>{t('billing.payments.status')}</TableHead>
                  <TableHead hideBelow="md">{t('billing.payments.date')}</TableHead>
                  <TableHead>{t('billing.payments.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() => onOpenInvoice?.(p.invoice?.id || p.invoice)}
                    >
                      {p.paymentReference}
                    </TableCell>
                    <TableCell hideBelow="sm">{t(`billing.method.${p.method}`)}</TableCell>
                    <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={paymentStatusVariant(p.status)}>{paymentStatusLabel(p.status, t)}</Badge>
                    </TableCell>
                    <TableCell hideBelow="md">{formatDate(p.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setStatusPaymentId(p.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Activity size={12} /> {t('billing.status.view')}
                        </button>
                        {p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED' ? (
                          <button
                            type="button"
                            onClick={() => handleReceiptDownload(p.id)}
                            disabled={downloadingReceiptId === p.id}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download size={12} /> {t('billing.detail.receipt')}
                          </button>
                        ) : null}
                        {p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED' ? (
                          <button
                            type="button"
                            onClick={() => setRefundingPayment(p)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Undo2 size={12} /> {t('billing.refund.action')}
                          </button>
                        ) : null}
                        {p.status === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(p.id)}
                            disabled={cancellingId === p.id}
                            className="flex items-center gap-1 text-xs text-destructive hover:underline"
                          >
                            <XCircle size={12} /> {t('billing.payments.cancelPending')}
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination className="mt-4" page={pagination?.page || page} totalPages={pagination?.totalPages} onPageChange={setPage} />
        </>
      )}

      <RefundDialog
        open={Boolean(refundingPayment)}
        onOpenChange={(v) => !v && setRefundingPayment(null)}
        payment={refundingPayment}
        onRefunded={load}
      />
      <PaymentStatusDialog
        open={Boolean(statusPaymentId)}
        onOpenChange={(v) => !v && setStatusPaymentId(null)}
        paymentId={statusPaymentId}
        onChanged={load}
        onRequestRefund={(payment) => {
          setStatusPaymentId(null);
          setRefundingPayment(payment);
        }}
      />
    </div>
  );
}
