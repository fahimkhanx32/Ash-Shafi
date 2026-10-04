import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Receipt, Wallet, DollarSign, Scale, History, Download, XCircle, Activity, Send, Check } from 'lucide-react';

import * as billingService from '../services/billingService.js';
import * as paymentsService from '../services/paymentsService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import { BILLING_STAFF_ROLES } from '../constants/roles.js';
import {
  INVOICE_STATUSES,
  invoiceStatusLabel,
  invoiceStatusVariant,
  paymentStatusLabel,
  paymentStatusVariant,
  serviceTypeLabel,
  chargeSuggestionStatusLabel,
  chargeSuggestionStatusVariant,
  formatMoney,
} from '../constants/billing.js';
import { formatDate } from '../lib/dateFormat.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { FilterBar } from '../components/ui/filter-bar.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { SkeletonList, TableSkeleton } from '../components/ui/skeleton.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.jsx';
import InvoiceDetailDialog from '../components/billing/InvoiceDetailDialog.jsx';
import FeeFormDialog from '../components/billing/FeeFormDialog.jsx';
import CreateInvoiceDialog from '../components/billing/CreateInvoiceDialog.jsx';
import OutstandingBalancesPanel from '../components/billing/OutstandingBalancesPanel.jsx';
import BillingHistoryPanel from '../components/billing/BillingHistoryPanel.jsx';
import PaymentsRosterPanel from '../components/billing/PaymentsRosterPanel.jsx';
import PaymentStatusDialog from '../components/billing/PaymentStatusDialog.jsx';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-12 (Patient Portal) — real self-service invoices/payments for
 * PATIENT, backed by `GET /billing/invoices/me` + `GET /payments/me`
 * (BET-15). `BILLING_STAFF_ROLES` reach the same route into the
 * invoice roster + fee catalog instead (`BILLING_ACCESS_ROLES` in
 * `constants/roles.js` — see that file's own comment for the exact
 * split). No client-computed totals anywhere: `grandTotal`/
 * `balanceDue`/`status` are always read straight from the server.
 */
export default function BillingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStaff = BILLING_STAFF_ROLES.includes(user?.role);

  return isStaff ? <StaffBillingView t={t} /> : <MyBillingView t={t} />;
}

function MyBillingView({ t }) {
  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [payments, setPayments] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [statusPaymentId, setStatusPaymentId] = useState(null);
  const { toast } = useToast();
  const confirm = useConfirm();

  // FET-15 — "Billing history" needs its own bounded snapshot of
  // recent invoices + payments independent of whichever tab/page the
  // Invoices/Payments tabs happen to be on — loaded once when the
  // History tab is first opened, same lazy-load shape `StaffBillingView`
  // already uses for its fee catalog.
  const [historyInvoices, setHistoryInvoices] = useState([]);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [historyState, setHistoryState] = useState('idle');
  const [historyError, setHistoryError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      if (tab === 'invoices') {
        const result = await billingService.getMyInvoices({ page, limit: 10 });
        setInvoices(result.items || []);
        setPagination(result.pagination || null);
      } else if (tab === 'payments') {
        const result = await paymentsService.getMyPayments({ page, limit: 10 });
        setPayments(result.items || []);
        setPagination(result.pagination || null);
      }
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [tab, page]);

  const loadHistory = useCallback(async () => {
    setHistoryState('loading');
    setHistoryError('');
    try {
      const [invoicesResult, paymentsResult] = await Promise.all([
        billingService.getMyInvoices({ page: 1, limit: 15 }),
        paymentsService.getMyPayments({ page: 1, limit: 15 }),
      ]);
      setHistoryInvoices(invoicesResult.items || []);
      setHistoryPayments(paymentsResult.items || []);
      setHistoryState('ready');
    } catch (error) {
      setHistoryError(extractApiError(error).message);
      setHistoryState('error');
    }
  }, []);

  useEffect(() => {
    if (tab === 'invoices' || tab === 'payments') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  useEffect(() => {
    if (tab === 'history' && historyState === 'idle') loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, historyState]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

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

  const handleCancelPayment = async (paymentId) => {
    const ok = await confirm({
      title: t('billing.payments.cancelPendingTitle'),
      description: t('billing.payments.cancelPendingDescription'),
      confirmLabel: t('billing.payments.cancelPendingConfirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await paymentsService.cancelPendingPayment(paymentId, {});
      toast({ title: t('billing.payments.cancelPendingSuccess'), variant: 'success' });
      load();
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.billing') }]}
        title={t('billing.myTitle')}
        description={t('billing.myDescription')}
      />

      <TabList
        tabs={[
          { value: 'invoices', label: t('billing.tabs.invoices'), icon: Receipt },
          { value: 'payments', label: t('billing.tabs.payments'), icon: Wallet },
          { value: 'balances', label: t('billing.tabs.balances'), icon: Scale },
          { value: 'history', label: t('billing.tabs.history'), icon: History },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'balances' ? (
        <OutstandingBalancesPanel
          fetchInvoices={({ status, page: p, limit }) => billingService.getMyInvoices({ page: p, limit }).then((r) => ({
            items: (r.items || []).filter((inv) => inv.status === status),
            pagination: r.pagination,
          }))}
          onSelectInvoice={setDetailId}
        />
      ) : tab === 'history' ? (
        <BillingHistoryPanel
          invoices={historyInvoices}
          payments={historyPayments}
          state={historyState}
          errorMessage={historyError}
          onRetry={loadHistory}
        />
      ) : state === 'loading' ? (
        tab === 'payments' ? (
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
                <TableSkeleton rows={5} columns={6} />
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <SkeletonList rows={5} />
        )
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState icon={Receipt} title={t('billing.empty.invoicesTitle')} description={t('billing.empty.invoicesDescription')} />
        ) : (
          <>
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
            <Pagination className="mt-4" page={pagination?.page || page} totalPages={pagination?.totalPages} onPageChange={setPage} />
          </>
        )
      ) : payments.length === 0 ? (
        <EmptyState icon={Wallet} title={t('billing.empty.paymentsTitle')} description={t('billing.empty.paymentsDescription')} />
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
                    <TableCell className="font-medium">{p.paymentReference}</TableCell>
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
                        {p.status === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => handleCancelPayment(p.id)}
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


      <InvoiceDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(v) => !v && setDetailId(null)}
        invoiceId={detailId}
        canPay
        canManage={false}
        onChanged={load}
      />
      <PaymentStatusDialog
        open={Boolean(statusPaymentId)}
        onOpenChange={(v) => !v && setStatusPaymentId(null)}
        paymentId={statusPaymentId}
        onChanged={load}
      />
    </div>
  );
}

function StaffBillingView({ t }) {
  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [fees, setFees] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showInactiveFees, setShowInactiveFees] = useState(false);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState(null);
  const [activeFees, setActiveFees] = useState([]);

  // FET-15 follow-up — "Suggested charges": a doctor's lightweight
  // `ChargeSuggestion` flag (BET-15.1+, `charge-suggestion.service.js`)
  // waiting for billing staff to turn into a real invoice or dismiss.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsState, setSuggestionsState] = useState('idle');
  const [suggestionsError, setSuggestionsError] = useState('');
  const [dismissingId, setDismissingId] = useState(null);

  // FET-15 — "Billing history" for staff: a bounded recent-activity
  // snapshot (most recent invoices + payments, clinic-wide), loaded
  // lazily the first time that tab is opened — same shape
  // `MyBillingView`'s history tab uses.
  const [historyInvoices, setHistoryInvoices] = useState([]);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [historyState, setHistoryState] = useState('idle');
  const [historyError, setHistoryError] = useState('');

  const loadHistory = useCallback(async () => {
    setHistoryState('loading');
    setHistoryError('');
    try {
      const [invoicesResult, paymentsResult] = await Promise.all([
        billingService.listInvoices({ page: 1, limit: 15 }),
        paymentsService.listPayments({ page: 1, limit: 15 }),
      ]);
      setHistoryInvoices(invoicesResult.items || []);
      setHistoryPayments(paymentsResult.items || []);
      setHistoryState('ready');
    } catch (error) {
      setHistoryError(extractApiError(error).message);
      setHistoryState('error');
    }
  }, []);

  useEffect(() => {
    if (tab === 'history' && historyState === 'idle') loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, historyState]);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsState('loading');
    setSuggestionsError('');
    try {
      const result = await billingService.listChargeSuggestions({ status: 'PENDING', limit: 50 });
      setSuggestions(result.items || []);
      setSuggestionsState('ready');
    } catch (error) {
      setSuggestionsError(extractApiError(error).message);
      setSuggestionsState('error');
    }
  }, []);

  useEffect(() => {
    if (tab === 'suggestions') loadSuggestions();
  }, [tab, loadSuggestions]);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      if (tab === 'invoices') {
        const result = await billingService.listInvoices({
          page,
          limit: 20,
          ...(status ? { status } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        });
        setInvoices(result.items || []);
        setPagination(result.pagination || null);
      } else if (tab === 'fees') {
        const result = await billingService.listFees({ includeInactive: showInactiveFees });
        setFees(result || []);
      }
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [tab, page, status, search, showInactiveFees]);

  // FET-15 — the fee catalog for `CreateInvoiceDialog`'s "pick from
  // catalog" convenience dropdown. Loaded once (active fees only,
  // same default `listFees()` already uses) independently of which
  // tab is active, so opening "New invoice" from the Invoices tab
  // never has to wait on the Fees tab having been visited first.
  useEffect(() => {
    billingService
      .listFees({})
      .then(setActiveFees)
      .catch(() => setActiveFees([]));
  }, []);

  // Loaded once up-front (not just when the tab is opened) purely so
  // the "Suggested charges" tab's pending-count badge is accurate the
  // moment the page loads, same reasoning as `activeFees` above.
  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (tab === 'invoices' || tab === 'fees') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, status, search, showInactiveFees]);

  useEffect(() => {
    setPage(1);
  }, [tab, status, search]);

  const openCreateFee = () => {
    setEditingFee(null);
    setFeeFormOpen(true);
  };

  const openFee = (fee) => {
    setEditingFee(fee);
    setFeeFormOpen(true);
  };

  const openInvoiceFromSuggestion = (suggestion) => {
    const patient = suggestion.patientProfile || {};
    // `suggestion.fee`, if the doctor picked one, is already the
    // populated Fee sub-document (`name`/`amount`/`currency`) — no
    // need to cross-reference `activeFees`. It isn't run through
    // `billingService`'s `withId` (that only maps the top-level
    // document), so `_id` is used directly here.
    const fee = suggestion.fee;
    setInvoiceDraft({
      patientProfileId: patient.id || patient._id,
      patientLabel: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.patientId || '',
      chargeSuggestionId: suggestion.id,
      initialNotes: suggestion.note || '',
      initialItem: fee
        ? {
            feeId: fee._id ? String(fee._id) : '',
            description: fee.name,
            serviceType: suggestion.serviceType,
            unitPrice: String(fee.amount),
          }
        : { description: serviceTypeLabel(suggestion.serviceType, t), serviceType: suggestion.serviceType },
    });
    setCreateInvoiceOpen(true);
  };

  const handleDismissSuggestion = async (id) => {
    setDismissingId(id);
    try {
      await billingService.dismissChargeSuggestion(id, {});
      loadSuggestions();
    } catch (error) {
      setSuggestionsError(extractApiError(error).message);
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('nav.billing') }]}
        title={t('nav.billing')}
        description={t('billing.staffDescription')}
        actions={
          tab === 'fees' ? (
            <Button size="sm" onClick={openCreateFee}>
              <Plus size={15} /> {t('billing.fees.add')}
            </Button>
          ) : tab === 'invoices' ? (
            <Button data-voice-dialog="createInvoice" size="sm" onClick={() => { setInvoiceDraft(null); setCreateInvoiceOpen(true); }}>
              <Plus size={15} /> {t('billing.createInvoice.action')}
            </Button>
          ) : null
        }
      />

      <TabList
        tabs={[
          { value: 'invoices', label: t('billing.tabs.invoices'), icon: Receipt },
          {
            value: 'suggestions',
            label: t('billing.tabs.suggestions', 'Suggested charges'),
            icon: Send,
            badge: suggestions.length > 0 ? suggestions.length : undefined,
          },
          { value: 'payments', label: t('billing.tabs.payments'), icon: Wallet },
          { value: 'fees', label: t('billing.tabs.fees'), icon: DollarSign },
          { value: 'balances', label: t('billing.tabs.balances'), icon: Scale },
          { value: 'history', label: t('billing.tabs.history'), icon: History },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'invoices' ? (
        <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder={t('billing.searchPlaceholder')}>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('billing.filterStatus')}>
            <option value="">{t('billing.allStatuses')}</option>
            {INVOICE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {invoiceStatusLabel(value, t)}
              </option>
            ))}
          </select>
        </FilterBar>
      ) : tab === 'fees' ? (
        <div className="mb-4">
          <label className="flex items-center gap-1.5 h-10 px-1 text-sm text-muted-foreground w-fit">
            <input type="checkbox" checked={showInactiveFees} onChange={(e) => setShowInactiveFees(e.target.checked)} className="accent-primary" />
            {t('billing.fees.showInactive')}
          </label>
        </div>
      ) : null}

      {tab === 'suggestions' ? (
        suggestionsState === 'loading' ? (
          <SkeletonList rows={4} />
        ) : suggestionsState === 'error' ? (
          <ErrorState description={suggestionsError} onRetry={loadSuggestions} />
        ) : suggestions.length === 0 ? (
          <EmptyState
            icon={Send}
            title={t('billing.suggestions.emptyTitle', 'No pending suggestions')}
            description={t(
              'billing.suggestions.emptyDescription',
              'When a doctor flags a charge for a patient, it shows up here for you to invoice.',
            )}
          />
        ) : (
          <div className="grid gap-3">
            {suggestions.map((s) => {
              const patient = s.patientProfile || {};
              const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.patientId;
              return (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4 shadow-one-ui">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold">{patientName}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {serviceTypeLabel(s.serviceType, t)}
                        {s.fee ? ` — ${formatMoney(s.fee.amount, s.fee.currency)}` : ''}
                      </p>
                      {s.note ? <p className="text-sm mt-1">{s.note}</p> : null}
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('billing.suggestions.by', 'Suggested by')} {s.suggestedBy?.name} · {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleDismissSuggestion(s.id)} disabled={dismissingId === s.id}>
                        <XCircle size={14} /> {t('billing.suggestions.dismiss', 'Dismiss')}
                      </Button>
                      <Button size="sm" onClick={() => openInvoiceFromSuggestion(s)}>
                        <Check size={14} /> {t('billing.suggestions.createInvoice', 'Create invoice')}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'payments' ? (
        <PaymentsRosterPanel onOpenInvoice={(id) => id && setDetailId(id)} />
      ) : tab === 'balances' ? (
        <OutstandingBalancesPanel
          fetchInvoices={({ status: outstandingStatus, page: p, limit }) =>
            billingService.listInvoices({ status: outstandingStatus, page: p, limit })
          }
          onSelectInvoice={setDetailId}
        />
      ) : tab === 'history' ? (
        <BillingHistoryPanel
          invoices={historyInvoices}
          payments={historyPayments}
          state={historyState}
          errorMessage={historyError}
          onRetry={loadHistory}
        />
      ) : state === 'loading' ? (
        tab === 'invoices' ? (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.roster.number')}</TableHead>
                  <TableHead hideBelow="sm">{t('billing.roster.issued')}</TableHead>
                  <TableHead hideBelow="md">{t('billing.detail.grandTotal')}</TableHead>
                  <TableHead>{t('billing.detail.balanceDue')}</TableHead>
                  <TableHead>{t('billing.payments.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton rows={6} columns={5} />
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.fees.name')}</TableHead>
                  <TableHead hideBelow="sm">{t('billing.fees.serviceType')}</TableHead>
                  <TableHead>{t('billing.fees.amount')}</TableHead>
                  <TableHead>{t('billing.payments.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton rows={6} columns={4} />
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : tab === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState icon={Receipt} title={t('billing.empty.invoicesTitle')} description={t('billing.empty.rosterDescription')} />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('billing.roster.number')}</TableHead>
                    <TableHead hideBelow="sm">{t('billing.roster.issued')}</TableHead>
                    <TableHead hideBelow="md">{t('billing.detail.grandTotal')}</TableHead>
                    <TableHead>{t('billing.detail.balanceDue')}</TableHead>
                    <TableHead>{t('billing.payments.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="cursor-pointer" onClick={() => setDetailId(invoice.id)}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell hideBelow="sm">{formatDate(invoice.issuedDate)}</TableCell>
                      <TableCell hideBelow="md">{formatMoney(invoice.grandTotal, invoice.currency)}</TableCell>
                      <TableCell>{formatMoney(invoice.balanceDue, invoice.currency)}</TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusVariant(invoice.status)}>{invoiceStatusLabel(invoice.status, t)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Pagination className="mt-4" page={pagination?.page || page} totalPages={pagination?.totalPages} onPageChange={setPage} />
          </>
        )
      ) : fees.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title={t('billing.fees.emptyTitle')}
          description={t('billing.fees.emptyDescription')}
          action={
            <Button size="sm" onClick={openCreateFee}>
              <Plus size={15} /> {t('billing.fees.add')}
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('billing.fees.name')}</TableHead>
                <TableHead hideBelow="sm">{t('billing.fees.serviceType')}</TableHead>
                <TableHead>{t('billing.fees.amount')}</TableHead>
                <TableHead>{t('billing.payments.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((fee) => (
                <TableRow key={fee.id} className="cursor-pointer" onClick={() => openFee(fee)}>
                  <TableCell className="font-medium">{fee.name}</TableCell>
                  <TableCell hideBelow="sm">{serviceTypeLabel(fee.serviceType, t)}</TableCell>
                  <TableCell>{formatMoney(fee.amount, fee.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={fee.isActive ? 'success' : 'neutral'}>
                      {fee.isActive ? t('billing.fees.active') : t('billing.fees.inactive')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <InvoiceDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(v) => !v && setDetailId(null)}
        invoiceId={detailId}
        canPay={false}
        canManage
        onChanged={load}
      />
      <FeeFormDialog open={feeFormOpen} onOpenChange={setFeeFormOpen} fee={editingFee} onSaved={load} />
      <CreateInvoiceDialog
        open={createInvoiceOpen}
        onOpenChange={(next) => {
          setCreateInvoiceOpen(next);
          if (!next) setInvoiceDraft(null);
        }}
        patientProfileId={invoiceDraft?.patientProfileId || null}
        patientLabel={invoiceDraft?.patientLabel || ''}
        initialItem={invoiceDraft?.initialItem || null}
        initialNotes={invoiceDraft?.initialNotes || ''}
        chargeSuggestionId={invoiceDraft?.chargeSuggestionId || null}
        fees={activeFees}
        onCreated={() => {
          setInvoiceDraft(null);
          setTab('invoices');
          setPage(1);
          load();
          loadSuggestions();
        }}
      />
    </div>
  );
}
