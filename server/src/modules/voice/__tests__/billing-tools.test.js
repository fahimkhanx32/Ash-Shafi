import { jest } from '@jest/globals';

const mockListFees = jest.fn();
const mockGetFeeById = jest.fn();
const mockCreateInvoice = jest.fn();
const mockGetInvoiceById = jest.fn();
const mockFindInvoiceOrThrow = jest.fn();
const mockRecordManualPayment = jest.fn();

jest.unstable_mockModule('../../billing/services/fee.service.js', () => ({
  listFees: mockListFees,
  getFeeById: mockGetFeeById,
}));
jest.unstable_mockModule('../../billing/services/invoice.service.js', () => ({
  createInvoice: mockCreateInvoice,
  getInvoiceById: mockGetInvoiceById,
  findInvoiceOrThrow: mockFindInvoiceOrThrow,
  listInvoices: jest.fn(),
  applyDiscount: jest.fn(),
  addInvoiceItem: jest.fn(),
  removeInvoiceItem: jest.fn(),
  cancelInvoice: jest.fn(),
  // Real arithmetic, not a stub: the preview's total must come from the same maths the invoice uses.
  computeTotals: (items) => {
    const grandTotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity - (i.discountAmount || 0), 0);
    return { computedItems: items, subtotal: grandTotal, discountTotal: 0, grandTotal };
  },
}));
jest.unstable_mockModule('../../payments/services/payment.service.js', () => ({
  recordManualPayment: mockRecordManualPayment,
  refundPayment: jest.fn(),
  getPaymentById: jest.fn(),
}));
jest.unstable_mockModule('../../../audit/audit.service.js', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const { executeVoiceTool } = await import('../services/voice-tool-executor.service.js');
const { VOICE_TOOL_REGISTRY } = await import('../tools/tool-registry.js');

const doctor = { _id: 'doc1', role: 'DOCTOR' };
const receptionist = { _id: 'rec1', role: 'RECEPTIONIST' };
const patient = { _id: 'pat1', role: 'PATIENT' };
const PID = '507f1f77bcf86cd799439011';
const FEE1 = '507f1f77bcf86cd799439012';
const FEE2 = '507f1f77bcf86cd799439013';
const INV = '507f1f77bcf86cd799439014';

const fee = (id, name, amount) => ({ _id: id, name, amount, currency: 'BDT', serviceType: 'CONSULTATION', isActive: true });

describe('billing voice tools (services mocked, no live DB)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('create_invoice without confirmed:true previews the REAL catalog total and creates nothing', async () => {
    mockGetFeeById.mockImplementation(async (id) => (id === FEE1 ? fee(FEE1, 'Consultation', 500) : fee(FEE2, 'CBC', 300)));

    const result = await executeVoiceTool({
      toolName: 'create_invoice',
      args: { patientProfileId: PID, items: [{ feeId: FEE1 }, { feeId: FEE2 }] },
      actor: doctor,
    });

    expect(result.requiresConfirmation).toBe(true);
    expect(result.message).toMatch(/800 taka/);
    expect(result.message).toMatch(/Shall I create it/);
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });

  test('the price is always read from the Fee record — a price smuggled in by the agent is stripped', async () => {
    mockGetFeeById.mockResolvedValue(fee(FEE1, 'Consultation', 500));
    mockCreateInvoice.mockResolvedValue({ _id: 'i1', invoiceNumber: 'INV-1', status: 'ISSUED', grandTotal: 500, amountPaid: 0, balanceDue: 500 });

    await executeVoiceTool({
      toolName: 'create_invoice',
      args: { patientProfileId: PID, items: [{ feeId: FEE1, quantity: 1, unitPrice: 1 }], confirmed: true },
      actor: doctor,
    });

    const [payload] = mockCreateInvoice.mock.calls[0];
    expect(payload.items[0].unitPrice).toBe(500);
    expect(payload.items[0].discountAmount).toBe(0);
  });

  test('an inactive fee is refused at preview time, before any confirmation is requested', async () => {
    mockGetFeeById.mockResolvedValue({ ...fee(FEE1, 'Old fee', 100), isActive: false });
    const result = await executeVoiceTool({
      toolName: 'create_invoice',
      args: { patientProfileId: PID, items: [{ feeId: FEE1 }] },
      actor: doctor,
    });
    expect(result.success).toBe(false);
    expect(result.requiresConfirmation).toBeUndefined();
    expect(result.message).toMatch(/no longer an active fee/i);
  });

  test('record_payment previews the balance, refuses overpayment, and needs confirmation', async () => {
    mockFindInvoiceOrThrow.mockResolvedValue({ invoiceNumber: 'INV-1', status: 'ISSUED', balanceDue: 800 });

    const ok = await executeVoiceTool({
      toolName: 'record_payment',
      args: { invoiceId: INV, amount: 500, method: 'CASH' },
      actor: receptionist,
    });
    expect(ok.requiresConfirmation).toBe(true);
    expect(ok.message).toMatch(/500 taka by cash/);
    expect(mockRecordManualPayment).not.toHaveBeenCalled();

    const over = await executeVoiceTool({
      toolName: 'record_payment',
      args: { invoiceId: INV, amount: 900, method: 'CASH' },
      actor: receptionist,
    });
    expect(over.success).toBe(false);
    expect(over.requiresConfirmation).toBeUndefined();
    expect(over.message).toMatch(/more than the 800 taka/);
  });

  test('record_payment executes only with confirmed:true', async () => {
    mockFindInvoiceOrThrow.mockResolvedValue({ invoiceNumber: 'INV-1', status: 'ISSUED', balanceDue: 300, grandTotal: 800, amountPaid: 500 });
    mockRecordManualPayment.mockResolvedValue({ amount: 500, paymentReference: 'PAY-1' });

    const result = await executeVoiceTool({
      toolName: 'record_payment',
      args: { invoiceId: INV, amount: 500, method: 'CASH', confirmed: true },
      actor: receptionist,
    });
    expect(result.success).toBe(true);
    expect(mockRecordManualPayment).toHaveBeenCalledWith(INV, { amount: 500, method: 'CASH' }, receptionist);
  });

  test('online methods cannot be recorded by voice (manual CASH / BANK_TRANSFER only)', async () => {
    const result = await executeVoiceTool({
      toolName: 'record_payment',
      args: { invoiceId: INV, amount: 10, method: 'CARD', confirmed: true },
      actor: receptionist,
    });
    expect(result.success).toBe(false);
    expect(mockRecordManualPayment).not.toHaveBeenCalled();
  });

  test('a role holding neither BILLING_WRITE nor INVOICES_WRITE is denied create_invoice', async () => {
    const result = await executeVoiceTool({
      toolName: 'create_invoice',
      args: { patientProfileId: PID, items: [{ feeId: FEE1 }], confirmed: true },
      actor: patient,
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/permission/i);
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });

  test('a DOCTOR can create invoices (INVOICES_WRITE) but cannot record payments (no BILLING_WRITE), exactly like the REST routes', async () => {
    const result = await executeVoiceTool({
      toolName: 'record_payment',
      args: { invoiceId: INV, amount: 10, method: 'CASH', confirmed: true },
      actor: doctor,
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/permission/i);
    expect(mockRecordManualPayment).not.toHaveBeenCalled();
  });

  test('a role with no billing permissions cannot record_payment', async () => {
    const result = await executeVoiceTool({
      toolName: 'record_payment',
      args: { invoiceId: INV, amount: 10, method: 'CASH', confirmed: true },
      actor: patient,
    });
    expect(result.success).toBe(false);
    expect(mockRecordManualPayment).not.toHaveBeenCalled();
  });

  test('search_fee returns catalog prices and asks which one when several match', async () => {
    mockListFees.mockResolvedValue([fee(FEE1, 'Consultation - New', 500), fee(FEE2, 'Consultation - Follow-up', 300)]);
    const result = await executeVoiceTool({ toolName: 'search_fee', args: { query: 'consultation' }, actor: doctor });
    expect(result.results).toHaveLength(2);
    expect(result.requiresConfirmation).toBe(true);
  });

  test('refund, discount, invoice-item add/remove and cancellation are all HIGH risk with a guard and no arbitrary-code/execute tool exists', () => {
    for (const tool of ['refund_payment', 'apply_invoice_discount', 'add_invoice_item', 'remove_invoice_item', 'cancel_invoice']) {
      expect(VOICE_TOOL_REGISTRY[tool].risk).toBe('HIGH');
      expect(VOICE_TOOL_REGISTRY[tool].guard).toBeDefined();
    }
    const names = Object.keys(VOICE_TOOL_REGISTRY);
    for (const forbidden of ['execute_javascript', 'execute_any_command', 'run_code']) {
      expect(names).not.toContain(forbidden);
    }
  });
});
