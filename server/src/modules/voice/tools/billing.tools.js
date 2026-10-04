import { listFees, getFeeById } from '../../billing/services/fee.service.js';
import { createInvoice, getInvoiceById, findInvoiceOrThrow, computeTotals, listInvoices, applyDiscount, addInvoiceItem, removeInvoiceItem, cancelInvoice } from '../../billing/services/invoice.service.js';
import { recordManualPayment, refundPayment, getPaymentById } from '../../payments/services/payment.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';

const asPlain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {});

/**
 * Guard for invoice-scoped tools (checkpoint 16 — extends the same
 * ownership check `prescriptionPatientGuard` does for prescriptions,
 * master prompt §9/§28/§48): if the call names the patient currently
 * open in the browser, the invoice must actually belong to that
 * patient. Uses the real `getInvoiceById`, so its own access rules run
 * first; only compares ownership once that succeeds.
 */
export const invoicePatientGuard = async ({ invoiceId, patientProfileId }, actor) => {
  if (!patientProfileId || !invoiceId) return;
  const invoice = asPlain(await getInvoiceById(invoiceId, actor));
  const owner = String(invoice.patientProfile?._id ?? invoice.patientProfile ?? '');
  if (owner !== String(patientProfileId)) {
    throw new AppError(
      'That invoice belongs to a different patient than the one that is open, so I have not touched it.',
      409,
      { code: 'INVOICE_PATIENT_MISMATCH' },
    );
  }
};

/**
 * Guard for payment-scoped tools (`refund_payment`). Payments carry
 * their own `patientProfile` (set when the payment was recorded), so
 * this checks the payment directly rather than walking through its
 * invoice.
 */
export const paymentPatientGuard = async ({ paymentId, patientProfileId }, actor) => {
  if (!patientProfileId || !paymentId) return;
  const payment = asPlain(await getPaymentById(paymentId, actor));
  const owner = String(payment.patientProfile?._id ?? payment.patientProfile ?? '');
  if (owner !== String(patientProfileId)) {
    throw new AppError(
      'That payment belongs to a different patient than the one that is open, so I have not touched it.',
      409,
      { code: 'PAYMENT_PATIENT_MISMATCH' },
    );
  }
};

const money = (n, currency = 'BDT') => `${Number(n).toLocaleString('en-US')} ${currency === 'BDT' ? 'taka' : currency}`;

const summarizeInvoice = (inv) => ({
  invoiceId: String(inv._id),
  invoiceNumber: inv.invoiceNumber,
  status: inv.status,
  grandTotal: inv.grandTotal,
  amountPaid: inv.amountPaid,
  balanceDue: inv.balanceDue,
  currency: inv.currency || 'BDT',
});

/**
 * `search_fee` — master prompt §19. Same active catalog
 * `GET /billing/fees` serves to any authenticated user. Matches on the
 * fee name; the doctor's "consultation" / "CBC" resolves to a real
 * `feeId` here before any invoice is prepared.
 */
export const searchFeeTool = async ({ query, limit = 5 }) => {
  const term = query.toLowerCase();
  const fees = (await listFees()).filter((f) => f.name.toLowerCase().includes(term)).slice(0, limit);

  if (fees.length === 0) {
    return { success: true, action: 'search_fee', message: `I couldn't find a fee matching "${query}".`, results: [] };
  }
  return {
    success: true,
    action: 'search_fee',
    message:
      fees.length === 1 ? `Found ${fees[0].name}: ${money(fees[0].amount, fees[0].currency)}.` : `Found ${fees.length} fees — which one?`,
    requiresConfirmation: fees.length > 1,
    results: fees.map((f) => ({
      feeId: String(f._id),
      name: f.name,
      serviceType: f.serviceType,
      amount: f.amount,
      currency: f.currency,
    })),
  };
};

export const getInvoiceTool = async ({ invoiceId }, actor) => {
  const invoice = await getInvoiceById(invoiceId, actor);
  return {
    success: true,
    action: 'get_invoice',
    message: `Invoice ${invoice.invoiceNumber}: total ${money(invoice.grandTotal)}, balance due ${money(invoice.balanceDue)}.`,
    invoice: summarizeInvoice(invoice),
  };
};

/**
 * Resolves each requested fee to its catalog record. The price used is
 * ALWAYS `fee.amount` from the database — there is no price argument
 * for the agent to get wrong (master prompt §40: "never invent the
 * amount"). Inactive fees are refused, same as the catalog itself
 * hides them.
 */
const resolveInvoiceLines = async (items) => {
  const lines = [];
  for (const { feeId, quantity = 1 } of items) {
    const fee = await getFeeById(feeId);
    if (!fee.isActive) {
      throw new AppError(`"${fee.name}" is no longer an active fee.`, 409, { code: 'FEE_INACTIVE' });
    }
    lines.push({
      description: fee.name,
      serviceType: fee.serviceType,
      feeId: String(fee._id),
      unitPrice: fee.amount,
      quantity,
      discountAmount: 0,
      currency: fee.currency,
    });
  }
  return lines;
};

/** Read-only: what create_invoice WOULD do, with the real total (master prompt §20). */
export const previewCreateInvoice = async ({ items }) => {
  const lines = await resolveInvoiceLines(items);
  const { grandTotal } = computeTotals(lines);
  const summary = lines.map((l) => `${l.description} ×${l.quantity}`).join(', ');
  return {
    message: `I prepared an invoice for ${summary} totalling ${money(grandTotal, lines[0].currency)}. Shall I create it?`,
    preview: { lines: lines.map(({ description, unitPrice, quantity }) => ({ description, unitPrice, quantity })), grandTotal },
  };
};

export const createInvoiceTool = async ({ patientProfileId, items }, actor) => {
  const lines = await resolveInvoiceLines(items);
  const invoice = await createInvoice({ patientProfileId, items: lines }, actor);
  return {
    success: true,
    action: 'create_invoice',
    message: `The invoice has been created, total ${money(invoice.grandTotal)}.`,
    invoice: summarizeInvoice(invoice),
  };
};

/**
 * Read-only preview for `record_payment`: shows the invoice's real
 * balance so the doctor hears "500 of 800 taka outstanding" before
 * confirming, and rejects overpayment/cancelled invoices up front with
 * the same rules `recordManualPayment` itself enforces.
 */
export const previewRecordPayment = async ({ invoiceId, amount, method }) => {
  const invoice = await findInvoiceOrThrow(invoiceId);
  if (invoice.status === 'CANCELLED') {
    throw new AppError('That invoice is cancelled, so it cannot take a payment.', 409, { code: 'INVOICE_CANCELLED' });
  }
  if (amount > invoice.balanceDue) {
    throw new AppError(
      `That is more than the ${money(invoice.balanceDue)} still due on invoice ${invoice.invoiceNumber}.`,
      400,
      { code: 'AMOUNT_EXCEEDS_BALANCE' },
    );
  }
  return {
    message: `Record ${money(amount)} by ${method === 'CASH' ? 'cash' : 'bank transfer'} against invoice ${invoice.invoiceNumber}? ${money(invoice.balanceDue)} is currently due. Shall I go ahead?`,
    preview: { invoiceNumber: invoice.invoiceNumber, balanceDue: invoice.balanceDue, amount, method },
  };
};

export const recordPaymentTool = async ({ invoiceId, amount, method }, actor) => {
  const payment = await recordManualPayment(invoiceId, { amount, method }, actor);
  const invoice = await findInvoiceOrThrow(invoiceId);
  return {
    success: true,
    action: 'record_payment',
    message: `Payment of ${money(payment.amount)} recorded. ${money(invoice.balanceDue)} remains due.`,
    invoice: summarizeInvoice(invoice),
    paymentReference: payment.paymentReference,
  };
};

/**
 * `get_outstanding_balance` — one patient's unpaid total, summed from the
 * real invoices' own `balanceDue` (no arithmetic on prices here). Only
 * ISSUED and PARTIALLY_PAID invoices carry a balance. Bounded to 100 per
 * status; if a patient has more, the answer says "at least" rather than
 * implying a complete total. A DOCTOR sees only invoices they issued
 * (`listInvoices` enforces it), and the message says so.
 */
export const getOutstandingBalanceTool = async ({ patientProfileId }, actor) => {
  const LIMIT = 100;
  const [issued, partial] = await Promise.all(
    ['ISSUED', 'PARTIALLY_PAID'].map((status) => listInvoices({ patientProfileId, status, page: 1, limit: LIMIT }, actor)),
  );
  const invoices = [...issued.items, ...partial.items];
  const truncated = issued.total > LIMIT || partial.total > LIMIT;
  const total = Math.round(invoices.reduce((sum, i) => sum + Number(i.balanceDue || 0), 0) * 100) / 100;

  if (!invoices.length) {
    return { success: true, action: 'get_outstanding_balance', message: 'There is no outstanding balance on the invoices I can see for this patient.', outstanding: 0, invoices: [] };
  }
  return {
    success: true,
    action: 'get_outstanding_balance',
    message: `${truncated ? 'At least ' : ''}${money(total)} outstanding across ${invoices.length} invoice(s).`,
    outstanding: total,
    truncated,
    invoices: invoices.map(summarizeInvoice),
  };
};

/** Discount is set on one existing line of an invoice with no payments (the service enforces that rule). */
export const previewApplyInvoiceDiscount = async ({ invoiceId, itemId, discountAmount }) => {
  const invoice = await findInvoiceOrThrow(invoiceId);
  const item = invoice.items.id(itemId);
  if (!item) throw new AppError('That line is not on this invoice.', 404, { code: 'INVOICE_ITEM_NOT_FOUND' });
  return {
    message: `Set a discount of ${money(discountAmount)} on ${item.description} in invoice ${invoice.invoiceNumber}? The current total is ${money(invoice.grandTotal)}. Shall I go ahead?`,
    preview: { invoiceNumber: invoice.invoiceNumber, item: item.description, discountAmount, currentTotal: invoice.grandTotal },
  };
};

export const applyInvoiceDiscountTool = async ({ invoiceId, itemId, discountAmount }, actor) => {
  const invoice = await applyDiscount(invoiceId, { itemId, discountAmount }, actor);
  return {
    success: true,
    action: 'apply_invoice_discount',
    message: `The discount has been applied. The new total is ${money(invoice.grandTotal)}.`,
    invoice: summarizeInvoice(invoice),
  };
};

/**
 * `add_invoice_item` (checkpoint 18). Same pricing rule as
 * `create_invoice`: the doctor names a catalog fee, never a price —
 * `resolveInvoiceLines` (already used by `create_invoice`/its preview)
 * resolves it, so the amount always comes from the fee catalog.
 */
export const previewAddInvoiceItem = async ({ invoiceId, feeId, quantity }) => {
  const invoice = await findInvoiceOrThrow(invoiceId);
  const [line] = await resolveInvoiceLines([{ feeId, quantity }]);
  return {
    message: `Add ${line.description} ×${line.quantity} (${money(line.unitPrice, line.currency)} each) to invoice ${invoice.invoiceNumber}? Shall I go ahead?`,
    preview: { invoiceNumber: invoice.invoiceNumber, description: line.description, unitPrice: line.unitPrice, quantity: line.quantity },
  };
};

export const addInvoiceItemTool = async ({ invoiceId, feeId, quantity }, actor) => {
  const [line] = await resolveInvoiceLines([{ feeId, quantity }]);
  const invoice = await addInvoiceItem(invoiceId, line, actor);
  return {
    success: true,
    action: 'add_invoice_item',
    message: `${line.description} has been added. The new total is ${money(invoice.grandTotal)}.`,
    invoice: summarizeInvoice(invoice),
  };
};

/** `remove_invoice_item` — removes by the line's real item id, never by a guessed name. */
export const previewRemoveInvoiceItem = async ({ invoiceId, itemId }) => {
  const invoice = await findInvoiceOrThrow(invoiceId);
  const item = invoice.items.id(itemId);
  if (!item) throw new AppError('That line is not on this invoice.', 404, { code: 'INVOICE_ITEM_NOT_FOUND' });
  if (invoice.items.length === 1) {
    throw new AppError(
      'An invoice must have at least one item — cancel the invoice instead of removing its only line.',
      409,
      { code: 'INVOICE_LAST_ITEM' },
    );
  }
  return {
    message: `Remove ${item.description} from invoice ${invoice.invoiceNumber}? The current total is ${money(invoice.grandTotal)}. Shall I go ahead?`,
    preview: { invoiceNumber: invoice.invoiceNumber, item: item.description, currentTotal: invoice.grandTotal },
  };
};

export const removeInvoiceItemTool = async ({ invoiceId, itemId }, actor) => {
  const invoice = await removeInvoiceItem(invoiceId, { itemId }, actor);
  return {
    success: true,
    action: 'remove_invoice_item',
    message: `The line has been removed. The new total is ${money(invoice.grandTotal)}.`,
    invoice: summarizeInvoice(invoice),
  };
};

/** `cancel_invoice` — refused, by the underlying service, once any payment is recorded (use refund instead). */
export const previewCancelInvoice = async ({ invoiceId }) => {
  const invoice = await findInvoiceOrThrow(invoiceId);
  return {
    message: `Cancel invoice ${invoice.invoiceNumber} for ${money(invoice.grandTotal)}? Shall I go ahead?`,
    preview: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
  };
};

export const cancelInvoiceTool = async ({ invoiceId, reason }, actor) => {
  const invoice = await cancelInvoice(invoiceId, { reason }, actor);
  return {
    success: true,
    action: 'cancel_invoice',
    message: `Invoice ${invoice.invoiceNumber} has been cancelled.`,
    invoice: summarizeInvoice(invoice),
  };
};

export const previewRefundPayment = async ({ paymentId, amount }, actor) => {
  const payment = await getPaymentById(paymentId, actor);
  return {
    message: `Refund ${money(amount)} of the ${money(payment.amount)} payment ${payment.paymentReference}? Shall I go ahead?`,
    preview: { paymentReference: payment.paymentReference, paymentAmount: payment.amount, refundAmount: amount },
  };
};

export const refundPaymentTool = async ({ paymentId, amount, reason }, actor) => {
  const refund = await refundPayment(paymentId, { amount, reason }, actor);
  return {
    success: true,
    action: 'refund_payment',
    message: `A refund of ${money(refund.amount ?? amount)} has been recorded.`,
    refundReference: refund.refundReference,
  };
};
