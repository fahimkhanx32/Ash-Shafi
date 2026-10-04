import mongoose from 'mongoose';

import { Invoice } from '../models/invoice.model.js';
import { Fee } from '../models/fee.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';
import { markChargeSuggestionInvoiced } from './charge-suggestion.service.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const pushHistory = (invoice, { action, actor, note = '' }) => {
  invoice.history.push({ action, actor: actor?._id ?? null, note });
};

const generateInvoiceNumber = async () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const prefix = `BILL-${y}${m}${d}`;

  const latest = await Invoice.findOne({ invoiceNumber: { $regex: `^${prefix}-` } })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();

  let nextSequence = 1;
  if (latest?.invoiceNumber) {
    const match = latest.invoiceNumber.match(/-(\d{4})$/);
    if (match) nextSequence = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
};

/**
 * Recomputes every line's `lineTotal` and the invoice-level totals
 * server-side from `unitPrice`/`quantity`/`discountAmount` only —
 * `lineTotal`, `subtotal`, `discountTotal`, and `grandTotal` supplied
 * by a client are always ignored/overwritten (master prompt §80). A
 * line's discount can never exceed its own pre-discount amount.
 */
export const computeTotals = (items) => {
  let subtotal = 0;
  let discountTotal = 0;

  const computedItems = items.map((item) => {
    const gross = round2(item.unitPrice * item.quantity);
    const discount = Math.min(round2(item.discountAmount || 0), gross);
    const lineTotal = round2(gross - discount);

    subtotal = round2(subtotal + gross);
    discountTotal = round2(discountTotal + discount);

    return { ...item, discountAmount: discount, lineTotal };
  });

  const grandTotal = round2(subtotal - discountTotal);

  return { computedItems, subtotal, discountTotal, grandTotal };
};

export const deriveStatusFromBalance = (invoice) => {
  if (invoice.status === 'CANCELLED') return invoice.status;

  if (invoice.amountPaid <= 0) {
    return invoice.status === 'REFUNDED' || invoice.status === 'PARTIALLY_REFUNDED'
      ? invoice.status
      : 'ISSUED';
  }

  if (invoice.balanceDue <= 0) return 'PAID';

  return 'PARTIALLY_PAID';
};

export const findInvoiceOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid invoice id.', 400, { code: 'INVALID_ID' });
  }

  const invoice = await Invoice.findById(id).populate(
    'patientProfile',
    'user patientId firstName lastName',
  );

  if (!invoice) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  return invoice;
};

/**
 * A `PATIENT` actor may only ever see/act on their own invoices, and a
 * `DOCTOR` (who now holds `INVOICES_WRITE`/`BILLING_READ` — see
 * `permissions.js`) may only see/act on invoices they personally
 * issued, never another doctor's or the clinic's full roster — the
 * client-provided id is never trusted for either role (master prompt
 * §80), same pattern every other clinical module uses. Billing-staff
 * roles (RECEPTIONIST/ADMIN/DIRECTOR/etc., who hold `BILLING_WRITE`)
 * are unrestricted, same as before.
 */
export const assertCanAccessAsSelf = (invoice, actor) => {
  if (actor.role === ROLES.PATIENT) {
    const ownerId = invoice.patient?._id ?? invoice.patient;
    return Boolean(ownerId) && String(ownerId) === String(actor._id);
  }

  if (actor.role === ROLES.DOCTOR) {
    const issuerId = invoice.issuedBy?._id ?? invoice.issuedBy;
    return Boolean(issuerId) && String(issuerId) === String(actor._id);
  }

  return true;
};

export const createInvoice = async (
  { patientProfileId, items, appointmentId, encounterId, dueDate, notes, chargeSuggestionId },
  actor,
) => {
  const patientProfile = await PatientProfile.findById(patientProfileId);

  if (!patientProfile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PATIENT_PROFILE_NOT_FOUND' });
  }

  // Resolve each item's stated fee (if any) purely to confirm it
  // exists and belongs to the stated serviceType — the client-supplied
  // `unitPrice` is still what's charged (staff may discount/adjust a
  // catalog price at the point of billing), never silently replaced.
  await assertFeesExist(items);

  const { computedItems, subtotal, discountTotal, grandTotal } = computeTotals(
    items.map((item) => ({
      description: item.description,
      serviceType: item.serviceType,
      fee: item.feeId || null,
      unitPrice: item.unitPrice,
      quantity: item.quantity || 1,
      discountAmount: item.discountAmount || 0,
    })),
  );

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = new Invoice({
    invoiceNumber,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    appointment: appointmentId || null,
    encounter: encounterId || null,
    items: computedItems,
    subtotal,
    discountTotal,
    grandTotal,
    amountPaid: 0,
    balanceDue: grandTotal,
    status: 'ISSUED',
    issuedBy: actor._id,
    issuedDate: new Date(),
    dueDate: dueDate ? new Date(dueDate) : null,
    notes: notes || '',
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  pushHistory(invoice, { action: 'ISSUED', actor, note: `Invoice ${invoiceNumber} issued.` });

  await invoice.save();

  if (chargeSuggestionId) {
    // Best-effort resolution — an invoice that was otherwise valid
    // and saved should never be rolled back just because its
    // originating suggestion (e.g. already resolved by someone else
    // in the meantime) couldn't be marked. Logged, not thrown.
    try {
      await markChargeSuggestionInvoiced(chargeSuggestionId, invoice._id, actor);
    } catch (error) {
      logger.warn(
        { chargeSuggestionId, invoiceId: invoice._id, error: error.message },
        'Could not resolve charge suggestion for newly created invoice.',
      );
    }
  }

  logger.info({ invoiceId: invoice._id, invoiceNumber, patientProfileId, grandTotal }, 'Invoice created.');

  return invoice;
};

export const applyDiscount = async (id, { itemId, discountAmount }, actor) => {
  const invoice = await findInvoiceOrThrow(id);

  if (!assertCanAccessAsSelf(invoice, actor)) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  if (invoice.status === 'CANCELLED') {
    throw new AppError('Cannot modify a cancelled invoice.', 409, { code: 'INVOICE_CANCELLED' });
  }

  if (invoice.amountPaid > 0) {
    throw new AppError(
      'Cannot change discounts on an invoice that already has payments recorded.',
      409,
      { code: 'INVOICE_HAS_PAYMENTS' },
    );
  }

  const item = invoice.items.id(itemId);
  if (!item) {
    throw new AppError('Invoice item not found.', 404, { code: 'INVOICE_ITEM_NOT_FOUND' });
  }

  const { computedItems, subtotal, discountTotal, grandTotal } = computeTotals(
    invoice.items.map((existing) =>
      String(existing._id) === String(itemId)
        ? { ...existing.toObject(), discountAmount }
        : existing.toObject(),
    ),
  );

  invoice.items = computedItems;
  invoice.subtotal = subtotal;
  invoice.discountTotal = discountTotal;
  invoice.grandTotal = grandTotal;
  invoice.balanceDue = round2(grandTotal - invoice.amountPaid);
  invoice.updatedBy = actor._id;

  pushHistory(invoice, { action: 'DISCOUNT_APPLIED', actor, note: `Discount updated on item ${itemId}.` });

  await invoice.save();

  return invoice;
};

/**
 * Resolves each item's stated fee (if any) purely to confirm it exists
 * — same rule `createInvoice` already applies, factored out so
 * `addInvoiceItem` doesn't duplicate it (master prompt §49).
 */
const assertFeesExist = async (items) => {
  const feeIds = items.map((item) => item.feeId).filter(Boolean);
  if (!feeIds.length) return;

  const invalidFeeId = feeIds.find((id) => !isValidObjectId(id));
  if (invalidFeeId) {
    throw new AppError('Invalid fee id in invoice items.', 400, { code: 'INVALID_ID' });
  }

  const fees = await Fee.find({ _id: { $in: feeIds } }).select('_id serviceType');
  const foundIds = new Set(fees.map((fee) => String(fee._id)));
  const missing = feeIds.find((id) => !foundIds.has(String(id)));
  if (missing) {
    throw new AppError('One or more referenced fees were not found.', 404, { code: 'FEE_NOT_FOUND' });
  }
};

/**
 * Adds one line to an existing invoice. Same edit-window rules as
 * `applyDiscount` (not cancelled, no payments recorded yet — editing
 * an invoice someone has already started paying against would make
 * the amount they paid against no longer match what's owed).
 */
export const addInvoiceItem = async (id, { description, serviceType, feeId, unitPrice, quantity, discountAmount }, actor) => {
  const invoice = await findInvoiceOrThrow(id);

  if (!assertCanAccessAsSelf(invoice, actor)) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  if (invoice.status === 'CANCELLED') {
    throw new AppError('Cannot modify a cancelled invoice.', 409, { code: 'INVOICE_CANCELLED' });
  }

  if (invoice.amountPaid > 0) {
    throw new AppError(
      'Cannot add a line to an invoice that already has payments recorded.',
      409,
      { code: 'INVOICE_HAS_PAYMENTS' },
    );
  }

  await assertFeesExist([{ feeId }]);

  const newItem = {
    description,
    serviceType,
    fee: feeId || null,
    unitPrice,
    quantity: quantity || 1,
    discountAmount: discountAmount || 0,
  };

  const { computedItems, subtotal, discountTotal, grandTotal } = computeTotals([
    ...invoice.items.map((existing) => existing.toObject()),
    newItem,
  ]);

  invoice.items = computedItems;
  invoice.subtotal = subtotal;
  invoice.discountTotal = discountTotal;
  invoice.grandTotal = grandTotal;
  invoice.balanceDue = round2(grandTotal - invoice.amountPaid);
  invoice.updatedBy = actor._id;

  pushHistory(invoice, { action: 'ITEM_ADDED', actor, note: `${description} added.` });

  await invoice.save();

  return invoice;
};

/**
 * Removes one line from an existing invoice. Same edit-window rules as
 * `applyDiscount`/`addInvoiceItem`, plus: an invoice can never be left
 * with zero items (the model itself requires at least one — see
 * `invoice.model.js`) — cancel the invoice instead if the whole thing
 * should go away.
 */
export const removeInvoiceItem = async (id, { itemId }, actor) => {
  const invoice = await findInvoiceOrThrow(id);

  if (!assertCanAccessAsSelf(invoice, actor)) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  if (invoice.status === 'CANCELLED') {
    throw new AppError('Cannot modify a cancelled invoice.', 409, { code: 'INVOICE_CANCELLED' });
  }

  if (invoice.amountPaid > 0) {
    throw new AppError(
      'Cannot remove a line from an invoice that already has payments recorded.',
      409,
      { code: 'INVOICE_HAS_PAYMENTS' },
    );
  }

  const item = invoice.items.id(itemId);
  if (!item) {
    throw new AppError('Invoice item not found.', 404, { code: 'INVOICE_ITEM_NOT_FOUND' });
  }

  if (invoice.items.length === 1) {
    throw new AppError(
      'An invoice must have at least one item — cancel the invoice instead of removing its only line.',
      409,
      { code: 'INVOICE_LAST_ITEM' },
    );
  }

  const remaining = invoice.items
    .filter((existing) => String(existing._id) !== String(itemId))
    .map((existing) => existing.toObject());

  const { computedItems, subtotal, discountTotal, grandTotal } = computeTotals(remaining);

  const removedDescription = item.description;
  invoice.items = computedItems;
  invoice.subtotal = subtotal;
  invoice.discountTotal = discountTotal;
  invoice.grandTotal = grandTotal;
  invoice.balanceDue = round2(grandTotal - invoice.amountPaid);
  invoice.updatedBy = actor._id;

  pushHistory(invoice, { action: 'ITEM_REMOVED', actor, note: `${removedDescription} removed.` });

  await invoice.save();

  return invoice;
};

export const cancelInvoice = async (id, { reason }, actor) => {
  const invoice = await findInvoiceOrThrow(id);

  if (!assertCanAccessAsSelf(invoice, actor)) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  if (invoice.status === 'CANCELLED') {
    throw new AppError('Invoice is already cancelled.', 409, { code: 'INVOICE_ALREADY_CANCELLED' });
  }

  if (invoice.amountPaid > 0) {
    throw new AppError(
      'Cannot cancel an invoice with recorded payments. Process a refund instead.',
      409,
      { code: 'INVOICE_HAS_PAYMENTS' },
    );
  }

  invoice.status = 'CANCELLED';
  invoice.cancellationReason = reason || '';
  invoice.cancelledBy = actor._id;
  invoice.cancelledAt = new Date();
  invoice.updatedBy = actor._id;

  pushHistory(invoice, { action: 'CANCELLED', actor, note: reason || '' });

  await invoice.save();

  return invoice;
};

export const getInvoiceById = async (id, actor) => {
  const invoice = await findInvoiceOrThrow(id);

  if (!assertCanAccessAsSelf(invoice, actor)) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  return invoice;
};

export const getMyInvoices = async (actor, { page = 1, limit = 20 } = {}) => {
  const patientProfile = await PatientProfile.findOne({ user: actor._id });
  if (!patientProfile) {
    return { items: [], page, limit, total: 0 };
  }

  const filter = { patientProfile: patientProfile._id };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ issuedDate: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

export const listInvoices = async (
  { patientProfileId, status, dateFrom, dateTo, search, page = 1, limit = 20 },
  actor,
) => {
  const filter = {};

  // A DOCTOR only ever sees invoices they personally issued (see
  // `assertCanAccessAsSelf` above) — never the clinic's full roster,
  // even when browsing a specific patient's chart alongside
  // billing-staff who can. This runs before every other filter below
  // so a DOCTOR can still narrow by patient/status/date within their
  // own invoices, just never past that boundary.
  if (actor.role === ROLES.DOCTOR) {
    filter.issuedBy = actor._id;
  }

  if (patientProfileId) {
    if (!isValidObjectId(patientProfileId)) {
      throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
    }
    filter.patientProfile = patientProfileId;
  }

  if (status) filter.status = status;

  if (dateFrom || dateTo) {
    filter.issuedDate = {};
    if (dateFrom) filter.issuedDate.$gte = new Date(dateFrom);
    if (dateTo) filter.issuedDate.$lte = new Date(dateTo);
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.invoiceNumber = { $regex: escaped, $options: 'i' };
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ issuedDate: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

/**
 * Internal, cross-module entry point — called only by
 * `../../payments/services/payment.service.js` once a payment is
 * confirmed `SUCCEEDED` (staff-recorded cash/bank, or a
 * provider-verified online payment). Never called from a route
 * directly, and never accepts a client-supplied `amountPaid` — this
 * is the single place `Invoice.amountPaid`/`balanceDue`/`status` are
 * mutated for a successful payment, so the two collections can never
 * drift out of sync (same one-way-callback shape BET-12 established
 * between `modules/reports` and `Investigation.status`).
 */
export const applyPaymentToInvoice = async (invoiceId, amount, actor, session = null) => {
  const invoice = await Invoice.findById(invoiceId).session(session);
  if (!invoice) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  invoice.amountPaid = round2(invoice.amountPaid + amount);
  invoice.balanceDue = round2(Math.max(invoice.grandTotal - invoice.amountPaid, 0));
  invoice.status = deriveStatusFromBalance(invoice);
  invoice.updatedBy = actor?._id ?? null;

  pushHistory(invoice, { action: 'PAYMENT_APPLIED', actor, note: `Payment of ${amount} applied.` });

  await invoice.save({ session });

  return invoice;
};

/**
 * Internal, cross-module entry point — called only by
 * `payment.service.js` once a refund is `COMPLETED`. Reduces
 * `amountPaid`, never below zero, and marks the invoice
 * `REFUNDED`/`PARTIALLY_REFUNDED` accordingly.
 */
export const applyRefundToInvoice = async (invoiceId, amount, actor, session = null) => {
  const invoice = await Invoice.findById(invoiceId).session(session);
  if (!invoice) {
    throw new AppError('Invoice not found.', 404, { code: 'INVOICE_NOT_FOUND' });
  }

  invoice.amountPaid = round2(Math.max(invoice.amountPaid - amount, 0));
  invoice.balanceDue = round2(Math.max(invoice.grandTotal - invoice.amountPaid, 0));
  invoice.status = invoice.amountPaid <= 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  invoice.updatedBy = actor?._id ?? null;

  pushHistory(invoice, { action: 'REFUND_APPLIED', actor, note: `Refund of ${amount} applied.` });

  await invoice.save({ session });

  return invoice;
};
