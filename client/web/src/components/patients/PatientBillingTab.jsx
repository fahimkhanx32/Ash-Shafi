import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Receipt, Send, X } from 'lucide-react';

import * as billingService from '../../services/billingService.js';
import { extractApiError } from '../../services/apiClient.js';
import {
  invoiceStatusLabel,
  invoiceStatusVariant,
  formatMoney,
  serviceTypeLabel,
  chargeSuggestionStatusLabel,
  chargeSuggestionStatusVariant,
} from '../../constants/billing.js';
import { formatDate } from '../../lib/dateFormat.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import InvoiceDetailDialog from '../billing/InvoiceDetailDialog.jsx';
import CreateInvoiceDialog from '../billing/CreateInvoiceDialog.jsx';
import SuggestChargeDialog from '../billing/SuggestChargeDialog.jsx';

/**
 * FET-15 — the patient workspace's Billing tab (`GET /billing/invoices`
 * filtered by `patientProfileId`, BET-15.1), replacing the
 * `ComingSoonTab` placeholder that had described the billing module
 * as not yet built (it was — `BET-15` shipped the backend, `FET-12`
 * shipped the standalone `BillingPage`; this tab was the one
 * genuinely missing piece — a per-patient view was never wired in).
 * `canWrite` gates the "New invoice" action and `InvoiceDetailDialog`'s
 * `canManage`, same `INVOICE_WRITE_ROLES` boundary `BillingPage.jsx`
 * already enforces — this tab holds no separate role logic of its own.
 *
 * `isDoctor` additionally surfaces "Suggest a charge" — a doctor can
 * either bill directly here (same as reception) or, when they'd
 * rather not deal with line items/pricing themselves, flag the charge
 * type for reception to finish (`ChargeSuggestion`,
 * `SuggestChargeDialog.jsx`). Their own pending suggestions for this
 * patient are listed below so they can see reception hasn't missed it.
 */
export default function PatientBillingTab({ patientProfileId, patientLabel, canWrite, isDoctor = false }) {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [fees, setFees] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await billingService.listInvoices({ patientProfileId, limit: 20 });
      setInvoices(result.items || []);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [patientProfileId]);

  const loadSuggestions = useCallback(async () => {
    if (!isDoctor) return;
    try {
      const result = await billingService.listChargeSuggestions({ patientProfileId, status: 'PENDING', limit: 10 });
      setSuggestions(result.items || []);
    } catch {
      setSuggestions([]);
    }
  }, [patientProfileId, isDoctor]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (canWrite) {
      billingService
        .listFees({})
        .then(setFees)
        .catch(() => setFees([]));
    }
  }, [canWrite]);

  const handleWithdrawSuggestion = async (id) => {
    try {
      await billingService.dismissChargeSuggestion(id, { reason: 'Withdrawn by doctor' });
      loadSuggestions();
    } catch {
      // Non-critical — the pending-suggestions list will just show it
      // again on the next load if this failed.
    }
  };

  return (
    <div>
      {canWrite ? (
        <div className="mb-4 flex justify-end gap-2">
          {isDoctor ? (
            <Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
              <Send size={15} /> {t('billing.patientTab.suggestCharge', 'Suggest a charge')}
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> {t('billing.patientTab.newInvoice')}
          </Button>
        </div>
      ) : null}

      {isDoctor && suggestions.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
            {t('billing.patientTab.pendingSuggestions', 'Awaiting reception')}
          </p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium">{serviceTypeLabel(s.serviceType, t)}</span>
                  {s.note ? <span className="text-muted-foreground"> — {s.note}</span> : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={chargeSuggestionStatusVariant(s.status)}>
                    {chargeSuggestionStatusLabel(s.status, t)}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleWithdrawSuggestion(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title={t('common.cancel', 'Cancel')}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {state === 'loading' ? (
        <SkeletonList rows={4} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('billing.patientTab.emptyTitle')}
          description={t('billing.patientTab.emptyDescription')}
          action={
            canWrite ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={15} /> {t('billing.patientTab.newInvoice')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {invoices.map((invoice) => (
            <button
              key={invoice.id}
              type="button"
              onClick={() => setDetailId(invoice.id)}
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
                {invoice.balanceDue > 0 ? (
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {formatMoney(invoice.balanceDue, invoice.currency)} {t('billing.due')}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <InvoiceDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(v) => !v && setDetailId(null)}
        invoiceId={detailId}
        canPay={false}
        canManage={canWrite}
        onChanged={load}
      />
      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        patientProfileId={patientProfileId}
        patientLabel={patientLabel}
        fees={fees}
        onCreated={() => {
          setCreateOpen(false);
          load();
          loadSuggestions();
        }}
      />
      {isDoctor ? (
        <SuggestChargeDialog
          open={suggestOpen}
          onOpenChange={setSuggestOpen}
          patientProfileId={patientProfileId}
          fees={fees}
          onCreated={() => {
            setSuggestOpen(false);
            loadSuggestions();
          }}
        />
      ) : null}
    </div>
  );
}
