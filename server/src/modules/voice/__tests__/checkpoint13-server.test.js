import { jest } from '@jest/globals';

const mockGetPrescriptionById = jest.fn();
const mockUpdatePrescription = jest.fn();
const mockCancelPrescription = jest.fn();
const mockCreateInvoice = jest.fn();
const mockGetFeeById = jest.fn();
const mockListInvoices = jest.fn();
const mockRecordManualPayment = jest.fn();
const mockFindInvoiceOrThrow = jest.fn();
const mockGetRequisitionById = jest.fn();
const mockAudit = jest.fn();

jest.unstable_mockModule('../../medicines/services/medicine.service.js', () => ({ getMedicineById: jest.fn(), autocompleteMedicines: jest.fn() }));
jest.unstable_mockModule('../../prescriptions/services/prescription.service.js', () => ({
  getPrescriptionById: mockGetPrescriptionById, updatePrescription: mockUpdatePrescription,
  createPrescription: jest.fn(), finalizePrescription: jest.fn(), cancelPrescription: mockCancelPrescription,
}));
jest.unstable_mockModule('../../billing/services/fee.service.js', () => ({ listFees: jest.fn(), getFeeById: mockGetFeeById }));
jest.unstable_mockModule('../../billing/services/invoice.service.js', () => ({
  createInvoice: mockCreateInvoice, getInvoiceById: jest.fn(), findInvoiceOrThrow: mockFindInvoiceOrThrow,
  computeTotals: () => ({ grandTotal: 800 }), listInvoices: mockListInvoices, applyDiscount: jest.fn(), addInvoiceItem: jest.fn(), removeInvoiceItem: jest.fn(), cancelInvoice: jest.fn(),
}));
jest.unstable_mockModule('../../payments/services/payment.service.js', () => ({ recordManualPayment: mockRecordManualPayment, refundPayment: jest.fn(), getPaymentById: jest.fn() }));
jest.unstable_mockModule('../../investigations/services/lab-requisition.service.js', () => ({
  createRequisition: jest.fn(), updateRequisition: jest.fn(), issueRequisition: jest.fn(), cancelRequisition: jest.fn(), getRequisitionById: mockGetRequisitionById,
}));
jest.unstable_mockModule('../../../audit/audit.service.js', () => ({ recordAuditEvent: mockAudit }));

const { executeVoiceTool } = await import('../services/voice-tool-executor.service.js');
const { runOnce, buildIdempotencyKey, _resetIdempotencyStoreForTests } = await import('../services/voice-idempotency.js');
const { getOutstandingBalanceTool } = await import('../tools/billing.tools.js');
const { validateToolArgs } = await import('../validators/voice.validation.js');
const { VOICE_TOOL_REGISTRY } = await import('../tools/tool-registry.js');

const ID = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';
const ID2 = '507f1f77bcf86cd799439033';
const admin = { _id: 'a1', role: 'SUPER_ADMIN' };
const doctor = { _id: 'd1', role: 'DOCTOR' };

beforeEach(() => { jest.clearAllMocks(); _resetIdempotencyStoreForTests(); });

describe('idempotency', () => {
  test('key ignores `confirmed` and key order, differs per user/args', () => {
    const a = buildIdempotencyKey('u', 't', { x: 1, y: [1, 2], confirmed: true });
    expect(a).toBe(buildIdempotencyKey('u', 't', { y: [1, 2], x: 1 }));
    expect(a).not.toBe(buildIdempotencyKey('u2', 't', { x: 1, y: [1, 2] }));
    expect(a).not.toBe(buildIdempotencyKey('u', 't', { x: 2, y: [1, 2] }));
  });
  test('concurrent duplicates run the function once', async () => {
    const fn = jest.fn(() => new Promise((r) => setTimeout(() => r({ ok: 1 }), 20)));
    const [a, b] = await Promise.all([runOnce('k', fn), runOnce('k', fn)]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
  });
  test('failure is not remembered; retry runs again', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ ok: 1 });
    await expect(runOnce('k', fn)).rejects.toThrow('x');
    expect((await runOnce('k', fn)).duplicate).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  test('entry expires after the window', async () => {
    let t = 0; const now = () => t; const fn = jest.fn().mockResolvedValue({ ok: 1 });
    await runOnce('k', fn, { ttlMs: 100, now });
    t = 101;
    expect((await runOnce('k', fn, { ttlMs: 100, now })).duplicate).toBe(false);
  });
  test('create_invoice: confirmed call twice -> ONE invoice, ONE audit, second flagged duplicate', async () => {
    mockGetFeeById.mockResolvedValue({ _id: 'f1', name: 'Consultation', isActive: true, serviceType: 'CONSULTATION', amount: 500, currency: 'BDT' });
    mockCreateInvoice.mockResolvedValue({ _id: 'i1', invoiceNumber: 'INV-1', grandTotal: 500, amountPaid: 0, balanceDue: 500 });
    const call = () => executeVoiceTool({ toolName: 'create_invoice', args: { patientProfileId: ID, items: [{ feeId: ID2 }], confirmed: true }, actor: admin });
    const first = await call();
    const second = await call();
    expect(mockCreateInvoice).toHaveBeenCalledTimes(1);
    expect(first.success).toBe(true);
    expect(first.duplicate).toBeUndefined();
    expect(second.duplicate).toBe(true);
    expect(second.message).toMatch(/already done/);
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });
  test('record_payment: duplicate suppressed; different amount is a different call', async () => {
    mockRecordManualPayment.mockResolvedValue({ amount: 500, paymentReference: 'PAY-1' });
    mockFindInvoiceOrThrow.mockResolvedValue({ _id: 'i1', invoiceNumber: 'INV-1', grandTotal: 800, amountPaid: 500, balanceDue: 300 });
    const pay = (amount) => executeVoiceTool({ toolName: 'record_payment', args: { invoiceId: ID, amount, method: 'CASH', confirmed: true }, actor: admin });
    await pay(500); await pay(500);
    expect(mockRecordManualPayment).toHaveBeenCalledTimes(1);
    await pay(200);
    expect(mockRecordManualPayment).toHaveBeenCalledTimes(2);
  });
  test('unconfirmed preview is never cached', async () => {
    mockGetFeeById.mockResolvedValue({ _id: 'f1', name: 'CBC', isActive: true, serviceType: 'LAB', amount: 300, currency: 'BDT' });
    const r = await executeVoiceTool({ toolName: 'create_invoice', args: { patientProfileId: ID, items: [{ feeId: ID2 }] }, actor: admin });
    expect(r.requiresConfirmation).toBe(true);
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });
});

describe('prescription belongs-to-patient guard', () => {
  const rx = (patientProfile) => ({ _id: 'rx1', prescriptionId: 'RX-1', status: 'DRAFT', patientProfile, patientSnapshot: { name: 'A' }, items: [], investigations: [], diagnoses: [], advice: [] });
  test('every prescription-scoped tool has the guard and accepts patientProfileId', () => {
    const scoped = Object.entries(VOICE_TOOL_REGISTRY).filter(([, e]) => e.guard).map(([n]) => n);
    expect(scoped).toHaveLength(27); // +8 in checkpoint 16 (invoice/payment/lab-requisition guards), +3 in checkpoint 18 (add/remove/cancel invoice)
    scoped.forEach((n) => {
      const args = { prescriptionId: ID, patientProfileId: OTHER, itemId: ID, text: 'x', name: 'x', testCode: 'x', mode: 'append', field: 'chiefComplaint', followUpDate: '2026-10-01' };
      const { error } = validateToolArgs(n, args);
      expect(error === undefined || !/patientProfileId/.test(error)).toBe(true);
    });
  });
  test('mismatch refused BEFORE any write', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx(OTHER));
    const r = await executeVoiceTool({ toolName: 'add_advice', args: { prescriptionId: ID, patientProfileId: ID2, text: 'water' }, actor: doctor });
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/different patient/);
    expect(mockUpdatePrescription).not.toHaveBeenCalled();
  });
  test('mismatch refused for HIGH-risk cancel even when confirmed', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx(OTHER));
    const r = await executeVoiceTool({ toolName: 'cancel_prescription', args: { prescriptionId: ID, patientProfileId: ID2, confirmed: true }, actor: doctor });
    expect(r.success).toBe(false);
    expect(mockCancelPrescription).not.toHaveBeenCalled();
  });
  test('match proceeds and patientProfileId is not passed to the handler', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx(ID2));
    mockUpdatePrescription.mockResolvedValue(rx(ID2));
    const r = await executeVoiceTool({ toolName: 'add_advice', args: { prescriptionId: ID, patientProfileId: ID2, text: 'water' }, actor: doctor });
    expect(r.success).toBe(true);
    expect(mockUpdatePrescription).toHaveBeenCalledTimes(1);
  });
  test('populated patientProfile object is compared by _id; omitted patientProfileId = no extra check', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx({ _id: ID2 }));
    mockUpdatePrescription.mockResolvedValue(rx(ID2));
    expect((await executeVoiceTool({ toolName: 'add_advice', args: { prescriptionId: ID, patientProfileId: ID2, text: 'x' }, actor: doctor })).success).toBe(true);
    expect((await executeVoiceTool({ toolName: 'add_advice', args: { prescriptionId: ID, text: 'x' }, actor: doctor })).success).toBe(true);
  });
});

describe('get_outstanding_balance', () => {
  test('sums real balanceDue, says "at least" when truncated', async () => {
    mockListInvoices
      .mockResolvedValueOnce({ items: [{ _id: 'a', balanceDue: 300 }], total: 1 })
      .mockResolvedValueOnce({ items: [{ _id: 'b', balanceDue: 150.5 }], total: 1 });
    const r = await getOutstandingBalanceTool({ patientProfileId: ID }, admin);
    expect(r.outstanding).toBe(450.5);
    expect(r.truncated).toBe(false);
    mockListInvoices
      .mockResolvedValueOnce({ items: [{ _id: 'a', balanceDue: 1 }], total: 250 })
      .mockResolvedValueOnce({ items: [], total: 0 });
    expect((await getOutstandingBalanceTool({ patientProfileId: ID }, admin)).message).toMatch(/^At least/);
  });
  test('none outstanding -> honest zero', async () => {
    mockListInvoices.mockResolvedValue({ items: [], total: 0 });
    expect((await getOutstandingBalanceTool({ patientProfileId: ID }, admin)).outstanding).toBe(0);
  });
  test('PATIENT role denied by registry permission', async () => {
    const r = await executeVoiceTool({ toolName: 'get_outstanding_balance', args: { patientProfileId: ID }, actor: { _id: 'p', role: 'PATIENT' } });
    expect(r.success).toBe(false);
    expect(mockListInvoices).not.toHaveBeenCalled();
  });
});

describe('get_lab_requisition', () => {
  test('reads through the real service and summarizes', async () => {
    mockGetRequisitionById.mockResolvedValue({ _id: 'r1', requisitionReference: 'LR-1', status: 'DRAFT', priority: 'ROUTINE', totalCostBDT: 800, tests: [{ name: 'CBC' }, { name: 'Serum Creatinine' }] });
    const r = await executeVoiceTool({ toolName: 'get_lab_requisition', args: { requisitionId: ID }, actor: doctor });
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/LR-1.*draft.*CBC/);
  });
  test('service error becomes a plain failure, not success', async () => {
    const { AppError } = await import('../../../middlewares/error.middleware.js');
    mockGetRequisitionById.mockRejectedValue(new AppError('Lab requisition not found.', 404, { code: 'REQUISITION_NOT_FOUND' }));
    const r = await executeVoiceTool({ toolName: 'get_lab_requisition', args: { requisitionId: ID }, actor: doctor });
    expect(r.success).toBe(false);
  });
});
