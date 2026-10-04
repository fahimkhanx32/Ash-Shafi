import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Landmark } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import * as paymentsService from '../../services/paymentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatMoney, MANUAL_PAYMENT_METHODS } from '../../constants/billing.js';

const ICONS = { CASH: Banknote, BANK_TRANSFER: Landmark };

/**
 * FET-15 (Billing & Payments) — staff-only (`BILLING_WRITE`) manual
 * payment recording (`POST /payments/manual`, BET-15.2). This is the
 * one payment path with no online checkout/webhook attached — a
 * staff member physically reconciled cash or a bank transfer and is
 * now recording that reconciliation as the payment record itself
 * (matches `manual-payment.provider.js`'s own reasoning: the
 * authenticated, permission-checked, audited action *is* the
 * verification). Defaults `amount` to the invoice's current
 * `balanceDue` but lets staff record a partial amount — the backend
 * still rejects anything exceeding the real balance
 * (`AMOUNT_EXCEEDS_BALANCE`), so this never has to duplicate that
 * validation client-side beyond a basic positive-number check.
 */
export default function RecordManualPaymentDialog({ open, onOpenChange, invoice, onRecorded }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && invoice) {
      setMethod('CASH');
      setAmount(invoice.balanceDue != null ? String(invoice.balanceDue) : '');
      setReference('');
      setNotes('');
      setError('');
    }
  }, [open, invoice]);

  if (!invoice) return null;

  const handleSubmit = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('billing.manualPayment.invalidAmount'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await paymentsService.recordManualPayment({
        invoiceId: invoice.id,
        amount: numericAmount,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      toast({ title: t('billing.manualPayment.success'), variant: 'success' });
      onOpenChange(false);
      onRecorded?.();
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
        <DialogTitle>{t('billing.manualPayment.title')}</DialogTitle>
        <DialogDescription>
          {t('billing.manualPayment.description', {
            number: invoice.invoiceNumber,
            balance: formatMoney(invoice.balanceDue, invoice.currency),
          })}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {MANUAL_PAYMENT_METHODS.map((value) => {
            const Icon = ICONS[value];
            return (
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
            );
          })}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-payment-amount">
            {t('billing.manualPayment.amountLabel')}
          </label>
          <input
            id="manual-payment-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-payment-reference">
            {t('billing.manualPayment.referenceLabel')}
          </label>
          <input
            id="manual-payment-reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={submitting}
            placeholder={t('billing.manualPayment.referencePlaceholder')}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-payment-notes">
            {t('billing.manualPayment.notesLabel')}
          </label>
          <textarea
            id="manual-payment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            rows={2}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('common.saving') : t('billing.manualPayment.submit')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
