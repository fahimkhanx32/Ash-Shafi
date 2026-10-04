import { jest } from '@jest/globals';

const m = {
  getPrescriptionById: jest.fn(), updatePrescription: jest.fn(),
  applyDiscount: jest.fn(), findInvoiceOrThrow: jest.fn(), getInvoiceById: jest.fn(),
  addInvoiceItem: jest.fn(), removeInvoiceItem: jest.fn(), cancelInvoice: jest.fn(), getFeeById: jest.fn(),
  refundPayment: jest.fn(), getPaymentById: jest.fn(),
  updateRequisition: jest.fn(), getRequisitionById: jest.fn(), audit: jest.fn(),
};
jest.unstable_mockModule('../../medicines/services/medicine.service.js', () => ({ getMedicineById: jest.fn(), autocompleteMedicines: jest.fn() }));
jest.unstable_mockModule('../../prescriptions/services/prescription.service.js', () => ({
  getPrescriptionById: m.getPrescriptionById, updatePrescription: m.updatePrescription,
  createPrescription: jest.fn(), finalizePrescription: jest.fn(), cancelPrescription: jest.fn(),
}));
jest.unstable_mockModule('../../billing/services/fee.service.js', () => ({ listFees: jest.fn(), getFeeById: m.getFeeById }));
jest.unstable_mockModule('../../billing/services/invoice.service.js', () => ({
  createInvoice: jest.fn(), getInvoiceById: m.getInvoiceById, findInvoiceOrThrow: m.findInvoiceOrThrow,
  computeTotals: () => ({ grandTotal: 0 }), listInvoices: jest.fn(), applyDiscount: m.applyDiscount,
  addInvoiceItem: m.addInvoiceItem, removeInvoiceItem: m.removeInvoiceItem, cancelInvoice: m.cancelInvoice,
}));
jest.unstable_mockModule('../../payments/services/payment.service.js', () => ({
  recordManualPayment: jest.fn(), refundPayment: m.refundPayment, getPaymentById: m.getPaymentById,
}));
jest.unstable_mockModule('../../investigations/services/lab-requisition.service.js', () => ({
  createRequisition: jest.fn(), updateRequisition: m.updateRequisition, issueRequisition: jest.fn(),
  cancelRequisition: jest.fn(), getRequisitionById: m.getRequisitionById,
}));
jest.unstable_mockModule('../../../audit/audit.service.js', () => ({ recordAuditEvent: m.audit }));

const { executeVoiceTool } = await import('../services/voice-tool-executor.service.js');
const { _resetIdempotencyStoreForTests } = await import('../services/voice-idempotency.js');

const RX = '507f1f77bcf86cd799439011';
const PT = '507f1f77bcf86cd799439022';
const ITEM = '507f1f77bcf86cd799439012';
const PAY = '507f1f77bcf86cd799439015';
const INV = '507f1f77bcf86cd799439014';
const REQ = '507f1f77bcf86cd799439016';
const doctor = { _id: 'd1', role: 'DOCTOR' };
const billing = { _id: 'r1', role: 'RECEPTIONIST' }; // holds billing:write (see billing-tools.test.js)
const patient = { _id: 'p1', role: 'PATIENT' };

const rx = (over = {}) => ({
  _id: RX, status: 'DRAFT', patientProfile: PT, patientSnapshot: { name: 'Rahim Ahmed' },
  items: [], investigations: [{ _id: ITEM, testName: 'CBC' }], ...over,
});

beforeEach(() => { jest.clearAllMocks(); _resetIdempotencyStoreForTests(); });

describe('remove_investigation_from_prescription', () => {
  test('removes exactly the requested investigation', async () => {
    m.getPrescriptionById.mockResolvedValue(rx());
    m.updatePrescription.mockResolvedValue(rx({ investigations: [] }));
    const r = await executeVoiceTool({ toolName: 'remove_investigation_from_prescription', args: { prescriptionId: RX, investigationId: ITEM }, actor: doctor });
    expect(r.success).toBe(true);
    expect(m.updatePrescription.mock.calls[0][1]).toEqual({ investigations: [] });
  });
  test('unknown test id -> failure, no write', async () => {
    m.getPrescriptionById.mockResolvedValue(rx());
    const r = await executeVoiceTool({ toolName: 'remove_investigation_from_prescription', args: { prescriptionId: RX, investigationId: '507f1f77bcf86cd799439099' }, actor: doctor });
    expect(r.success).toBe(false);
    expect(m.updatePrescription).not.toHaveBeenCalled();
  });
  test('patient guard applies: another patient\'s prescription is refused before any write', async () => {
    m.getPrescriptionById.mockResolvedValue(rx());
    const r = await executeVoiceTool({ toolName: 'remove_investigation_from_prescription', args: { prescriptionId: RX, investigationId: ITEM, patientProfileId: '507f1f77bcf86cd799439033' }, actor: doctor });
    expect(r.success).toBe(false);
    expect(m.updatePrescription).not.toHaveBeenCalled();
  });
});

describe('refund_payment / apply_invoice_discount (HIGH)', () => {
  test('refund without confirmation previews the real amounts and refunds nothing', async () => {
    m.getPaymentById.mockResolvedValue({ amount: 800, paymentReference: 'PAY-1' });
    const r = await executeVoiceTool({ toolName: 'refund_payment', args: { paymentId: PAY, amount: 300, reason: 'duplicate charge' }, actor: billing });
    expect(r.requiresConfirmation).toBe(true);
    expect(r.message).toMatch(/300/);
    expect(m.refundPayment).not.toHaveBeenCalled();
  });
  test('roles without billing:write are refused even with confirmed:true', async () => {
    for (const actor of [doctor, patient]) {
      const r = await executeVoiceTool({ toolName: 'refund_payment', args: { paymentId: PAY, amount: 300, reason: 'x y z', confirmed: true }, actor });
      expect(r.success).toBe(false);
    }
    expect(m.refundPayment).not.toHaveBeenCalled();
  });
  test('confirmed refund runs once; an identical retry is suppressed by the cp13 idempotency layer', async () => {
    m.refundPayment.mockResolvedValue({ amount: 300, refundReference: 'RFND-1' });
    const args = { paymentId: PAY, amount: 300, reason: 'duplicate charge', confirmed: true };
    const a = await executeVoiceTool({ toolName: 'refund_payment', args, actor: billing });
    const b = await executeVoiceTool({ toolName: 'refund_payment', args, actor: billing });
    expect(a.success).toBe(true);
    expect(b.duplicate).toBe(true);
    expect(m.refundPayment).toHaveBeenCalledTimes(1);
  });
  test('refund needs a reason', async () => {
    const r = await executeVoiceTool({ toolName: 'refund_payment', args: { paymentId: PAY, amount: 300, confirmed: true }, actor: billing });
    expect(r.success).toBe(false);
    expect(m.refundPayment).not.toHaveBeenCalled();
  });
  test('discount previews the current total first, applies only when confirmed', async () => {
    m.findInvoiceOrThrow.mockResolvedValue({ invoiceNumber: 'INV-1', grandTotal: 800, items: { id: () => ({ description: 'CBC' }) } });
    const unconfirmed = await executeVoiceTool({ toolName: 'apply_invoice_discount', args: { invoiceId: INV, itemId: ITEM, discountAmount: 100 }, actor: billing });
    expect(unconfirmed.requiresConfirmation).toBe(true);
    expect(m.applyDiscount).not.toHaveBeenCalled();
    m.applyDiscount.mockResolvedValue({ _id: INV, invoiceNumber: 'INV-1', grandTotal: 700, amountPaid: 0, balanceDue: 700 });
    const done = await executeVoiceTool({ toolName: 'apply_invoice_discount', args: { invoiceId: INV, itemId: ITEM, discountAmount: 100, confirmed: true }, actor: billing });
    expect(done.success).toBe(true);
    expect(m.applyDiscount).toHaveBeenCalledWith(INV, { itemId: ITEM, discountAmount: 100 }, billing);
  });
});

describe('update_lab_requisition', () => {
  test('a call that changes nothing is rejected', async () => {
    const r = await executeVoiceTool({ toolName: 'update_lab_requisition', args: { requisitionId: REQ }, actor: doctor });
    expect(r.success).toBe(false);
    expect(m.updateRequisition).not.toHaveBeenCalled();
  });
  test('an unknown catalog code is refused before the service is called', async () => {
    const r = await executeVoiceTool({ toolName: 'update_lab_requisition', args: { requisitionId: REQ, testCodes: ['NOT_A_REAL_CODE'] }, actor: doctor });
    expect(r.success).toBe(false);
    expect(m.updateRequisition).not.toHaveBeenCalled();
  });
});

describe('audit labels are specific', () => {
  test.each([
    ['search_patient', 'AI_SEARCH_PATIENT'],
    ['remove_medicine_from_prescription', 'AI_REMOVE_MEDICINE'],
    ['add_advice', 'AI_ADD_ADVICE'],
    ['generate_prescription_pdf', 'AI_GENERATE_PRESCRIPTION_PDF'],
    ['refund_payment', 'AI_REFUND_PAYMENT'],
  ])('%s -> %s', async (tool, action) => {
    const { VOICE_TOOL_REGISTRY } = await import('../tools/tool-registry.js');
    expect(VOICE_TOOL_REGISTRY[tool].audit.action).toBe(action);
  });
});

describe('invoice / payment / lab-requisition belongs-to-patient guards (checkpoint 16)', () => {
  const invoice = (patientProfile) => ({ _id: INV, invoiceNumber: 'INV-1', patientProfile, grandTotal: 800, amountPaid: 0, balanceDue: 800 });
  const payment = (patientProfile) => ({ _id: PAY, patientProfile, amount: 800, paymentReference: 'PAY-1' });
  const requisition = (patientProfile) => ({ _id: REQ, requisitionReference: 'REQ-1', status: 'DRAFT', patientProfile, tests: [], totalCostBDT: 300 });
  const OTHER = '507f1f77bcf86cd799439099';

  test('mismatched invoice is refused before any write (record_payment)', async () => {
    m.getInvoiceById.mockResolvedValue(invoice(OTHER));
    const r = await executeVoiceTool({
      toolName: 'record_payment', args: { invoiceId: INV, patientProfileId: PT, amount: 500, method: 'CASH' }, actor: billing,
    });
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/different patient/);
  });

  test('mismatched invoice is refused for apply_invoice_discount even when confirmed', async () => {
    m.getInvoiceById.mockResolvedValue(invoice(OTHER));
    const r = await executeVoiceTool({
      toolName: 'apply_invoice_discount', args: { invoiceId: INV, patientProfileId: PT, itemId: ITEM, discountAmount: 100, confirmed: true }, actor: billing,
    });
    expect(r.success).toBe(false);
    expect(m.applyDiscount).not.toHaveBeenCalled();
  });

  test('matching invoice context proceeds', async () => {
    m.getInvoiceById.mockResolvedValue(invoice(PT));
    m.findInvoiceOrThrow.mockResolvedValue({ invoiceNumber: 'INV-1', grandTotal: 800, items: { id: () => ({ description: 'CBC' }) } });
    m.applyDiscount.mockResolvedValue(invoice(PT));
    const r = await executeVoiceTool({
      toolName: 'apply_invoice_discount', args: { invoiceId: INV, patientProfileId: PT, itemId: ITEM, discountAmount: 100, confirmed: true }, actor: billing,
    });
    expect(r.success).toBe(true);
  });

  test('mismatched payment is refused before any refund (even confirmed)', async () => {
    m.getPaymentById.mockResolvedValue(payment(OTHER));
    const r = await executeVoiceTool({
      toolName: 'refund_payment', args: { paymentId: PAY, patientProfileId: PT, amount: 300, reason: 'duplicate charge', confirmed: true }, actor: billing,
    });
    expect(r.success).toBe(false);
    expect(m.refundPayment).not.toHaveBeenCalled();
  });

  test('omitted patientProfileId on refund = no extra check (matches prescription-guard behaviour)', async () => {
    m.getPaymentById.mockResolvedValue(payment(OTHER));
    const r = await executeVoiceTool({
      toolName: 'refund_payment', args: { paymentId: PAY, amount: 300, reason: 'duplicate charge' }, actor: billing,
    });
    expect(r.requiresConfirmation).toBe(true); // preview only reached because the guard was skipped, not because it matched
  });

  test('mismatched lab requisition is refused before update/issue/cancel', async () => {
    m.getRequisitionById.mockResolvedValue(requisition(OTHER));
    const r = await executeVoiceTool({
      toolName: 'update_lab_requisition', args: { requisitionId: REQ, patientProfileId: PT, priority: 'URGENT' }, actor: doctor,
    });
    expect(r.success).toBe(false);
    expect(m.updateRequisition).not.toHaveBeenCalled();
  });

  test('matching lab requisition context proceeds', async () => {
    m.getRequisitionById.mockResolvedValue(requisition(PT));
    m.updateRequisition.mockResolvedValue(requisition(PT));
    const r = await executeVoiceTool({
      toolName: 'update_lab_requisition', args: { requisitionId: REQ, patientProfileId: PT, priority: 'URGENT' }, actor: doctor,
    });
    expect(r.success).toBe(true);
  });

  test('populated patientProfile object (not a bare id) is still compared by _id', async () => {
    m.getRequisitionById.mockResolvedValue(requisition({ _id: PT }));
    m.updateRequisition.mockResolvedValue(requisition(PT));
    const r = await executeVoiceTool({
      toolName: 'update_lab_requisition', args: { requisitionId: REQ, patientProfileId: PT, priority: 'URGENT' }, actor: doctor,
    });
    expect(r.success).toBe(true);
  });
});

describe('add_invoice_item / remove_invoice_item / cancel_invoice (checkpoint 18)', () => {
  const FEE = '507f1f77bcf86cd799439077';
  const invoice = (over = {}) => ({
    _id: INV, invoiceNumber: 'INV-1', patientProfile: PT, status: 'ISSUED',
    grandTotal: 800, amountPaid: 0, balanceDue: 800,
    items: { id: (id) => (String(id) === ITEM ? { _id: ITEM, description: 'Consultation' } : null), length: 2 },
    ...over,
  });
  const fee = { _id: FEE, name: 'CBC', serviceType: 'INVESTIGATION', amount: 300, currency: 'BDT', isActive: true };

  beforeEach(() => { m.getFeeById.mockResolvedValue(fee); });

  test('add_invoice_item previews the real catalog price before writing anything', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    const r = await executeVoiceTool({
      toolName: 'add_invoice_item', args: { invoiceId: INV, feeId: FEE, quantity: 1 }, actor: billing,
    });
    expect(r.requiresConfirmation).toBe(true);
    expect(r.message).toMatch(/CBC/);
    expect(r.message).toMatch(/300/);
    expect(m.addInvoiceItem).not.toHaveBeenCalled();
  });

  test('add_invoice_item never lets the agent set its own price — only feeId is accepted, the amount always comes from the fee', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    m.addInvoiceItem.mockResolvedValue(invoice({ grandTotal: 1100, balanceDue: 1100 }));
    const r = await executeVoiceTool({
      toolName: 'add_invoice_item', args: { invoiceId: INV, feeId: FEE, quantity: 1, confirmed: true }, actor: billing,
    });
    expect(r.success).toBe(true);
    const [, line] = m.addInvoiceItem.mock.calls[0];
    expect(line).toMatchObject({ description: 'CBC', unitPrice: 300 });
    expect(line.unitPrice).not.toBe(undefined); // came from the fee, never from `args`
  });

  test('add_invoice_item is refused once the invoice has payments (edit-window rule lives in the service, not duplicated here)', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    m.addInvoiceItem.mockRejectedValue(Object.assign(new Error('Cannot add a line to an invoice that already has payments recorded.'), { statusCode: 409 }));
    const r = await executeVoiceTool({
      toolName: 'add_invoice_item', args: { invoiceId: INV, feeId: FEE, quantity: 1, confirmed: true }, actor: billing,
    });
    expect(r.success).toBe(false);
  });

  test('a role without billing:write or invoices:write cannot add an invoice item, even confirmed (a PATIENT never holds either)', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    const r = await executeVoiceTool({
      toolName: 'add_invoice_item', args: { invoiceId: INV, feeId: FEE, quantity: 1, confirmed: true }, actor: patient,
    });
    expect(r.success).toBe(false);
    expect(m.addInvoiceItem).not.toHaveBeenCalled();
  });

  test('a DOCTOR does hold invoices:write, so add_invoice_item is not refused on permission grounds for them', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    m.addInvoiceItem.mockResolvedValue(invoice({ grandTotal: 1100, balanceDue: 1100 }));
    const r = await executeVoiceTool({
      toolName: 'add_invoice_item', args: { invoiceId: INV, feeId: FEE, quantity: 1, confirmed: true }, actor: doctor,
    });
    expect(r.success).toBe(true);
  });

  test('remove_invoice_item previews the real line description first', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    const r = await executeVoiceTool({
      toolName: 'remove_invoice_item', args: { invoiceId: INV, itemId: ITEM }, actor: billing,
    });
    expect(r.requiresConfirmation).toBe(true);
    expect(r.message).toMatch(/Consultation/);
    expect(m.removeInvoiceItem).not.toHaveBeenCalled();
  });

  test('remove_invoice_item, unconfirmed, refuses in the preview when it would leave the invoice with zero lines', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice({ items: { id: () => ({ _id: ITEM, description: 'Only item' }), length: 1 } }));
    const r = await executeVoiceTool({
      toolName: 'remove_invoice_item', args: { invoiceId: INV, itemId: ITEM }, actor: billing,
    });
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/at least one item/);
    expect(m.removeInvoiceItem).not.toHaveBeenCalled();
  });

  test('remove_invoice_item, already confirmed, still fails cleanly if the service itself refuses (the real last-item rule lives once, in the service — not duplicated in the tool)', async () => {
    m.removeInvoiceItem.mockRejectedValue(
      Object.assign(new Error('An invoice must have at least one item — cancel the invoice instead of removing its only line.'), { statusCode: 409 }),
    );
    const r = await executeVoiceTool({
      toolName: 'remove_invoice_item', args: { invoiceId: INV, itemId: ITEM, confirmed: true }, actor: billing,
    });
    expect(r.success).toBe(false);
    expect(m.removeInvoiceItem).toHaveBeenCalledTimes(1);
  });

  test('remove_invoice_item removes exactly the confirmed line', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    m.removeInvoiceItem.mockResolvedValue(invoice({ grandTotal: 500, balanceDue: 500 }));
    const r = await executeVoiceTool({
      toolName: 'remove_invoice_item', args: { invoiceId: INV, itemId: ITEM, confirmed: true }, actor: billing,
    });
    expect(r.success).toBe(true);
    expect(m.removeInvoiceItem).toHaveBeenCalledWith(INV, { itemId: ITEM }, billing);
  });

  test('cancel_invoice previews the real total, cancels once confirmed, and a repeated confirmed call is not re-run (idempotent)', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    const preview = await executeVoiceTool({
      toolName: 'cancel_invoice', args: { invoiceId: INV, reason: 'entered for wrong patient' }, actor: billing,
    });
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.message).toMatch(/800/);
    expect(m.cancelInvoice).not.toHaveBeenCalled();

    m.cancelInvoice.mockResolvedValue(invoice({ status: 'CANCELLED' }));
    const args = { invoiceId: INV, reason: 'entered for wrong patient', confirmed: true };
    const first = await executeVoiceTool({ toolName: 'cancel_invoice', args, actor: billing });
    const second = await executeVoiceTool({ toolName: 'cancel_invoice', args, actor: billing });
    expect(first.success).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(m.cancelInvoice).toHaveBeenCalledTimes(1);
  });

  test('cancel_invoice requires a reason', async () => {
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    const r = await executeVoiceTool({ toolName: 'cancel_invoice', args: { invoiceId: INV, confirmed: true }, actor: billing });
    expect(r.success).toBe(false);
    expect(m.cancelInvoice).not.toHaveBeenCalled();
  });

  test('the invoice-patient guard covers all three new tools: a mismatched patientProfileId is refused before any write', async () => {
    const OTHER = '507f1f77bcf86cd799439099';
    m.getInvoiceById.mockResolvedValue({ patientProfile: OTHER });
    m.findInvoiceOrThrow.mockResolvedValue(invoice());
    for (const call of [
      { toolName: 'add_invoice_item', args: { invoiceId: INV, patientProfileId: PT, feeId: FEE, quantity: 1, confirmed: true } },
      { toolName: 'remove_invoice_item', args: { invoiceId: INV, patientProfileId: PT, itemId: ITEM, confirmed: true } },
      { toolName: 'cancel_invoice', args: { invoiceId: INV, patientProfileId: PT, reason: 'test', confirmed: true } },
    ]) {
      const r = await executeVoiceTool({ ...call, actor: billing });
      expect(r.success).toBe(false);
    }
    expect(m.addInvoiceItem).not.toHaveBeenCalled();
    expect(m.removeInvoiceItem).not.toHaveBeenCalled();
    expect(m.cancelInvoice).not.toHaveBeenCalled();
  });
});
