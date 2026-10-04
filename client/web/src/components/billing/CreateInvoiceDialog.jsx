import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as billingService from '../../services/billingService.js';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { FEE_SERVICE_TYPES, serviceTypeLabel, formatMoney } from '../../constants/billing.js';

const inputClass = 'w-full h-9 rounded-lg border border-border bg-background px-2.5 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyItem = () => ({
  key: Math.random().toString(36).slice(2),
  description: '',
  serviceType: 'NEW_CONSULTATION',
  feeId: '',
  unitPrice: '',
  quantity: '1',
  discountAmount: '0',
});

/**
 * FET-15 — staff-only invoice creation (`POST /billing/invoices`,
 * BET-15.1). Mirrors `BookAppointmentDialog.jsx`'s patient-search
 * pattern for the "no preset patient" case (opened from the general
 * Invoices tab), and skips the picker entirely when a caller already
 * knows the patient (opened from `PatientBillingTab` inside a
 * specific patient's workspace) — same optional-`patientProfileId`
 * convention `BookAppointmentDialog` itself established.
 *
 * Picking a fee from the catalog only *pre-fills* description/
 * unitPrice/serviceType client-side for convenience — the actual
 * `unitPrice`/`quantity`/`discountAmount` sent are always re-validated
 * and the real `lineTotal`/`subtotal`/`grandTotal` are always
 * server-computed by `invoice.service.js`, never trusted from this
 * form (master prompt §80). The "Estimated total" shown here is
 * explicitly labelled as an estimate, not the invoice's real total.
 */
export default function CreateInvoiceDialog({
  open,
  onOpenChange,
  patientProfileId = null,
  patientLabel = '',
  fees = [],
  initialItem = null,
  initialNotes = '',
  chargeSuggestionId = null,
  onCreated,
}) {
  const { t } = useTranslation();
  const needsPatientPicker = !patientProfileId;

  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [items, setItems] = useState([emptyItem()]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      // `initialItem`/`initialNotes` — set when this dialog is opened
      // from a doctor's ChargeSuggestion (`BillingPage.jsx`'s
      // "Suggested charges" tab) to prefill what the doctor already
      // flagged. Reception still reviews/edits every field before
      // submitting — nothing here is trusted as-is (master prompt §80).
      setItems([initialItem ? { ...emptyItem(), ...initialItem } : emptyItem()]);
      setDueDate('');
      setNotes(initialNotes || '');
      setError('');
      setSelectedPatient(null);
      setPatientQuery('');
      setPatientResults([]);
    }
  }, [open, initialItem, initialNotes]);

  const searchPatients = async (query) => {
    setPatientQuery(query);
    if (query.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    setPatientSearching(true);
    try {
      const { items: found } = await patientsService.listPatients({ search: query.trim(), limit: 10 });
      setPatientResults(found);
    } catch {
      setPatientResults([]);
    } finally {
      setPatientSearching(false);
    }
  };

  const updateItem = (key, field) => (e) => {
    const { value } = e.target;
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        if (field === 'feeId') {
          const fee = fees.find((f) => f.id === value);
          return fee
            ? { ...item, feeId: value, description: fee.name, serviceType: fee.serviceType, unitPrice: String(fee.amount) }
            : { ...item, feeId: value };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (key) => setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev));

  const estimatedTotal = items.reduce((sum, item) => {
    const unit = Number(item.unitPrice) || 0;
    const qty = Number(item.quantity) || 0;
    const discount = Number(item.discountAmount) || 0;
    return sum + Math.max(unit * qty - discount, 0);
  }, 0);

  const handleSubmit = async () => {
    setError('');
    const effectivePatientProfileId = patientProfileId || selectedPatient?.id || selectedPatient?._id;
    if (!effectivePatientProfileId) {
      setError(t('billing.createInvoice.selectPatientError'));
      return;
    }
    const cleanedItems = items.filter((item) => item.description.trim() && item.unitPrice !== '');
    if (cleanedItems.length === 0) {
      setError(t('billing.createInvoice.itemsRequiredError'));
      return;
    }

    setSaving(true);
    try {
      const invoice = await billingService.createInvoice({
        patientProfileId: effectivePatientProfileId,
        items: cleanedItems.map((item) => ({
          description: item.description.trim(),
          serviceType: item.serviceType,
          feeId: item.feeId || undefined,
          unitPrice: Number(item.unitPrice),
          quantity: Number(item.quantity) || 1,
          discountAmount: Number(item.discountAmount) || 0,
        })),
        dueDate: dueDate || null,
        notes: notes.trim(),
        chargeSuggestionId: chargeSuggestionId || undefined,
      });
      onCreated?.(invoice);
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)} className="max-w-xl">
      <DialogCloseButton onClose={() => !saving && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('billing.createInvoice.title')}</DialogTitle>
        <DialogDescription>{t('billing.createInvoice.description')}</DialogDescription>
      </DialogHeader>

      <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {needsPatientPicker ? (
          <div>
            <label className={labelClass}>{t('billing.createInvoice.patientLabel')}</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>
                  {selectedPatient.firstName} {selectedPatient.lastName} · {selectedPatient.patientId}
                </span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelectedPatient(null)}
                  disabled={saving}
                >
                  {t('billing.createInvoice.changePatient')}
                </button>
              </div>
            ) : (
              <>
                <input
                  className={inputClass}
                  placeholder={t('billing.createInvoice.searchPatientPlaceholder')}
                  value={patientQuery}
                  onChange={(e) => searchPatients(e.target.value)}
                  disabled={saving}
                />
                {patientSearching ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t('billing.createInvoice.searching')}</p>
                ) : null}
                {patientResults.length > 0 ? (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {patientResults.map((p) => (
                      <li key={p.id || p._id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientResults([]);
                            setPatientQuery('');
                          }}
                        >
                          {p.firstName} {p.lastName} · {p.patientId}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div>
            <label className={labelClass}>{t('billing.createInvoice.patientLabel')}</label>
            <div className="rounded-lg border border-border px-3 py-2 text-sm">{patientLabel}</div>
          </div>
        )}

        <div className="space-y-3">
          <label className={labelClass}>{t('billing.createInvoice.itemsLabel')}</label>
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-border p-3 space-y-2">
              {fees.length > 0 ? (
                <select
                  className={inputClass}
                  value={item.feeId}
                  onChange={updateItem(item.key, 'feeId')}
                  disabled={saving}
                >
                  <option value="">{t('billing.createInvoice.itemFeeNone')}</option>
                  {fees.map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {fee.name} — {formatMoney(fee.amount, fee.currency)}
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                className={inputClass}
                placeholder={t('billing.createInvoice.itemDescription')}
                value={item.description}
                onChange={updateItem(item.key, 'description')}
                disabled={saving}
              />

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select
                  className={inputClass}
                  value={item.serviceType}
                  onChange={updateItem(item.key, 'serviceType')}
                  disabled={saving}
                >
                  {FEE_SERVICE_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {serviceTypeLabel(value, t)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  placeholder={t('billing.createInvoice.itemUnitPrice')}
                  value={item.unitPrice}
                  onChange={updateItem(item.key, 'unitPrice')}
                  disabled={saving}
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                  placeholder={t('billing.createInvoice.itemQuantity')}
                  value={item.quantity}
                  onChange={updateItem(item.key, 'quantity')}
                  disabled={saving}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  placeholder={t('billing.createInvoice.itemDiscount')}
                  value={item.discountAmount}
                  onChange={updateItem(item.key, 'discountAmount')}
                  disabled={saving}
                />
              </div>

              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <Trash2 size={12} /> {t('billing.createInvoice.removeItem')}
                </button>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={saving}>
            <Plus size={14} /> {t('billing.createInvoice.addItem')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('billing.createInvoice.dueDate')}</label>
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex items-end justify-end text-sm">
            <p className="text-muted-foreground">
              {t('billing.createInvoice.estimatedTotal')}:{' '}
              <span className="font-semibold text-foreground">{formatMoney(estimatedTotal)}</span>
            </p>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('billing.createInvoice.notes')}</label>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? t('common.saving') : t('billing.createInvoice.submit')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
