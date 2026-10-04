import { jest } from '@jest/globals';

const mockGetPrescriptionById = jest.fn();
const mockUpdatePrescription = jest.fn();
const mockCancelPrescription = jest.fn();

jest.unstable_mockModule('../../medicines/services/medicine.service.js', () => ({ getMedicineById: jest.fn(), autocompleteMedicines: jest.fn() }));
jest.unstable_mockModule('../../prescriptions/services/prescription.service.js', () => ({
  getPrescriptionById: mockGetPrescriptionById,
  updatePrescription: mockUpdatePrescription,
  createPrescription: jest.fn(),
  finalizePrescription: jest.fn(),
  cancelPrescription: mockCancelPrescription,
}));

const {
  updateMedicineOnPrescriptionTool,
  savePrescriptionTool,
  previewCancelPrescription,
  cancelPrescriptionTool,
} = await import('../tools/prescription.tools.js');
const { validateToolArgs } = await import('../validators/voice.validation.js');
const { VOICE_TOOL_REGISTRY, RISK_LEVELS } = await import('../tools/tool-registry.js');
const { executeVoiceTool } = await import('../services/voice-tool-executor.service.js');

const actor = { _id: 'doc1', role: 'DOCTOR' };
const rx = (over = {}) => ({
  _id: 'rx1', prescriptionId: 'RX-1', status: 'DRAFT', patientSnapshot: { name: 'Rahim Ahmed' },
  items: [{ _id: 'it1', brandName: 'Napa', genericName: 'Paracetamol', dosage: '1 + 0 + 0', frequency: '1 + 0 + 0' }],
  investigations: [], diagnoses: [], advice: [], ...over,
});
const ID = '507f1f77bcf86cd799439011';

beforeEach(() => jest.clearAllMocks());

describe('update_medicine_on_prescription', () => {
  test('changes only the supplied fields, keeps medicine identity', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx());
    mockUpdatePrescription.mockResolvedValue(rx());
    const r = await updateMedicineOnPrescriptionTool(
      { prescriptionId: 'rx1', itemId: 'it1', durationValue: '7', durationUnit: 'Days' }, actor);
    const sent = mockUpdatePrescription.mock.calls[0][1].items[0];
    expect(sent).toMatchObject({ brandName: 'Napa', genericName: 'Paracetamol', frequency: '1 + 0 + 0', durationValue: '7', durationUnit: 'Days' });
    expect(r.updatedFields).toEqual(['durationValue', 'durationUnit']);
  });
  test('unknown item -> ITEM_NOT_FOUND, no write', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx());
    await expect(updateMedicineOnPrescriptionTool({ prescriptionId: 'rx1', itemId: 'nope', dosage: '1' }, actor))
      .rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
    expect(mockUpdatePrescription).not.toHaveBeenCalled();
  });
  test('schema requires at least one dosage field', () => {
    expect(validateToolArgs('update_medicine_on_prescription', { prescriptionId: ID, itemId: ID }).error).toBeTruthy();
    expect(validateToolArgs('update_medicine_on_prescription', { prescriptionId: ID, itemId: ID, dosage: '1 tablet' }).error).toBeFalsy();
  });
});

describe('save_prescription (read-back, writes nothing)', () => {
  test('draft: reports stored counts, says not finalized, no write call', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx());
    const r = await savePrescriptionTool({ prescriptionId: 'rx1' }, actor);
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/draft/);
    expect(r.message).toMatch(/not finalized/);
    expect(r.emptySections).toEqual(['diagnosis', 'advice']);
    expect(mockUpdatePrescription).not.toHaveBeenCalled();
    expect(mockCancelPrescription).not.toHaveBeenCalled();
  });
  test('finalized: says already finalized', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx({ status: 'FINALIZED' }));
    expect((await savePrescriptionTool({ prescriptionId: 'rx1' }, actor)).message).toMatch(/already finalized/);
  });
  test('cancelled: success=false, never claims saved', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx({ status: 'CANCELLED' }));
    const r = await savePrescriptionTool({ prescriptionId: 'rx1' }, actor);
    expect(r.success).toBe(false);
  });
});

describe('cancel_prescription', () => {
  test('registered HIGH risk with preview + audit', () => {
    const e = VOICE_TOOL_REGISTRY.cancel_prescription;
    expect(e.risk).toBe(RISK_LEVELS.HIGH);
    expect(e.preview).toBeDefined();
    expect(e.audit.action).toBe('AI_CANCEL_PRESCRIPTION');
  });
  test('preview names patient, writes nothing; refuses already-cancelled', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx());
    const p = await previewCancelPrescription({ prescriptionId: 'rx1' }, actor);
    expect(p.message).toMatch(/Rahim Ahmed/);
    expect(mockCancelPrescription).not.toHaveBeenCalled();
    mockGetPrescriptionById.mockResolvedValue(rx({ status: 'CANCELLED' }));
    await expect(previewCancelPrescription({ prescriptionId: 'rx1' }, actor)).rejects.toMatchObject({ code: 'ALREADY_CANCELLED' });
  });
  test('executor: unconfirmed call cancels nothing; confirmed call does', async () => {
    mockGetPrescriptionById.mockResolvedValue(rx());
    const first = await executeVoiceTool({ toolName: 'cancel_prescription', args: { prescriptionId: ID }, actor });
    expect(first.requiresConfirmation).toBe(true);
    expect(mockCancelPrescription).not.toHaveBeenCalled();
    mockCancelPrescription.mockResolvedValue(rx({ status: 'CANCELLED' }));
    const second = await executeVoiceTool({ toolName: 'cancel_prescription', args: { prescriptionId: ID, reason: 'wrong patient', confirmed: true }, actor });
    expect(second.success).toBe(true);
    expect(mockCancelPrescription).toHaveBeenCalledWith(ID, 'wrong patient', actor);
  });
  test('PATIENT role is denied', async () => {
    const r = await executeVoiceTool({ toolName: 'cancel_prescription', args: { prescriptionId: ID, confirmed: true }, actor: { _id: 'p1', role: 'PATIENT' } });
    expect(r.success).toBe(false);
    expect(mockCancelPrescription).not.toHaveBeenCalled();
  });
  test('cancelPrescriptionTool passes reason through', async () => {
    mockCancelPrescription.mockResolvedValue(rx({ status: 'CANCELLED' }));
    await cancelPrescriptionTool({ prescriptionId: 'rx1', reason: 'x' }, actor);
    expect(mockCancelPrescription).toHaveBeenCalledWith('rx1', 'x', actor);
  });
});
