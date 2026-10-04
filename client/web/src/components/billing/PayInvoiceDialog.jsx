import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Smartphone, Landmark, Activity } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as paymentsService from '../../services/paymentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatMoney } from '../../constants/billing.js';
import PaymentStatusDialog from './PaymentStatusDialog.jsx';

const METHODS = [
  { value: 'CARD', icon: CreditCard },
  { value: 'MOBILE_FINANCIAL_SERVICE', icon: Smartphone },
  { value: 'ONLINE_GATEWAY', icon: Landmark },
];

/**
 * FET-12/FET-15 — patient-initiated online payment against their own
 * invoice's `balanceDue` (`POST /payments/initiate`, BET-15.2). Never
 * assumes success: the backend only ever creates a `PENDING` Payment
 * here and returns a `checkout` (redirectUrl/clientSecret) for the
 * patient to complete on the provider's own page — a webhook is what
 * actually advances `status` to SUCCEEDED/FAILED (master prompt §36,
 * "never fake a payment successful response"). If the gateway isn't
 * configured (true in this environment's `.env` today), the backend
 * returns a clear 503 `PAYMENT_PROVIDER_NOT_CONFIGURED` message,
 * which this dialog surfaces verbatim rather than inventing its own
 * more optimistic copy.
 *
 * FET-15 Part 3 — once a payment is genuinely initiated, this dialog
 * offers a direct hand-off into `PaymentStatusDialog`, which is the
 * one place that actually polls `GET /payments/:id` for the real
 * `PENDING → SUCCEEDED/FAILED` transition — this dialog itself never
 * polls or guesses.
 */
export default function PayInvoiceDialog({ open, onOpenChange, invoice, onInitiated }) {
  const { t } = useTranslation();
  const [method, setMethod] = useState('CARD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [initiatedPaymentId, setInitiatedPaymentId] = useState(null);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod('CARD');
      setError('');
      setInitiatedPaymentId(null);
    }
  }, [open]);

  if (!invoice) return null;

  const handlePay = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { payment, checkout } = await paymentsService.initiatePayment(invoice.id, method);
      setInitiatedPaymentId(payment?.id || null);
      if (checkout?.redirectUrl) {
        window.open(checkout.redirectUrl, '_blank', 'noopener,noreferrer');
      }
      onInitiated?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogCloseButton onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{t('billing.pay.title')}</DialogTitle>
          <DialogDescription>
            {t('billing.pay.description', {
              amount: formatMoney(invoice.balanceDue, invoice.currency),
              number: invoice.invoiceNumber,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {initiatedPaymentId ? (
            <Alert variant="success">
              <AlertDescription>{t('billing.pay.redirected')}</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors ${
                    method === value
                      ? 'border-primary bg-accent/50 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent/30'
                  }`}
                >
                  <Icon size={18} />
                  {t(`billing.method.${value}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          {!initiatedPaymentId ? (
            <Button type="button" onClick={handlePay} disabled={submitting}>
              {submitting ? t('billing.pay.processing') : t('billing.pay.submit')}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStatusOpen(true)}>
              <Activity size={14} /> {t('billing.status.track')}
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      <PaymentStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        paymentId={initiatedPaymentId}
        onChanged={onInitiated}
      />
    </>
  );
}
