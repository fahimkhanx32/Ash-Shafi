import { jest } from '@jest/globals';

const mockGetMedicineById = jest.fn();
const mockGetPrescriptionById = jest.fn();
const mockUpdatePrescription = jest.fn();
const mockCreatePrescription = jest.fn();
const mockFinalizePrescription = jest.fn();

jest.unstable_mockModule('../../medicines/services/medicine.service.js', () => ({
  getMedicineById: mockGetMedicineById,
}));

jest.unstable_mockModule('../../prescriptions/services/prescription.service.js', () => ({
  getPrescriptionById: mockGetPrescriptionById,
  updatePrescription: mockUpdatePrescription,
  createPrescription: mockCreatePrescription,
  finalizePrescription: mockFinalizePrescription,
  cancelPrescription: jest.fn(),
}));

const {
  addMedicineToPrescriptionTool,
  addInvestigationToPrescriptionTool,
  updateVitalsTool,
  addClinicalNoteTool,
  updateClinicalNoteTool,
  setFollowUpTool,
} = await import('../tools/prescription.tools.js');

const actor = { _id: 'doc1', role: 'DOCTOR' };

describe('prescription.tools.js — handler data-shaping logic (services mocked, no live DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addMedicineToPrescriptionTool', () => {
    test('builds a prescription item from the real Medicine fields, not invented ones', async () => {
      mockGetMedicineById.mockResolvedValue({
        _id: 'med1',
        brandName: 'Napa',
        genericName: 'Paracetamol',
        strength: '500',
        unit: 'mg',
        dosageForm: 'Tablet',
        route: 'Oral',
      });
      mockGetPrescriptionById.mockResolvedValue({ items: [], toObject: undefined });
      mockUpdatePrescription.mockResolvedValue({
        _id: 'rx1',
        prescriptionId: 'RX-1',
        status: 'DRAFT',
        patientSnapshot: { name: 'Rahim Ahmed' },
        items: [{ genericName: 'Paracetamol' }],
        investigations: [],
        diagnoses: [],
      });

      const result = await addMedicineToPrescriptionTool(
        {
          prescriptionId: 'rx1',
          medicineId: 'med1',
          dosage: '1 + 0 + 1',
          frequency: '1 + 0 + 1',
          foodInstruction: 'খাবার পরে',
          durationValue: '5',
          durationUnit: 'Days',
        },
        actor,
      );

      expect(mockUpdatePrescription).toHaveBeenCalledWith(
        'rx1',
        {
          items: [
            expect.objectContaining({
              medicineRef: 'med1',
              brandName: 'Napa',
              genericName: 'Paracetamol',
              strength: '500',
              strengthUnit: 'mg',
              dosageForm: 'Tablet',
              route: 'Oral',
              dosage: '1 + 0 + 1',
              frequency: '1 + 0 + 1',
              durationValue: '5',
              durationUnit: 'Days',
              displayOrder: 1,
            }),
          ],
        },
        actor,
      );
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/Napa/);
    });

    test('appends to existing items rather than replacing them', async () => {
      mockGetMedicineById.mockResolvedValue({ _id: 'med2', genericName: 'Metformin', strength: '500', unit: 'mg' });
      mockGetPrescriptionById.mockResolvedValue({
        items: [{ _id: 'item1', genericName: 'Paracetamol', displayOrder: 1 }],
      });
      mockUpdatePrescription.mockResolvedValue({ items: [], investigations: [], diagnoses: [] });

      await addMedicineToPrescriptionTool({ prescriptionId: 'rx1', medicineId: 'med2' }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      expect(updates.items).toHaveLength(2);
      expect(updates.items[0].genericName).toBe('Paracetamol'); // untouched
      expect(updates.items[1]).toMatchObject({ genericName: 'Metformin', displayOrder: 2 });
    });

    test('with no dosage given: adds the medicine with blank dosing fields and asks, never fabricates a dose (master prompt §15/§29)', async () => {
      mockGetMedicineById.mockResolvedValue({ _id: 'med1', brandName: 'Napa', genericName: 'Paracetamol', strength: '500', unit: 'mg' });
      mockGetPrescriptionById.mockResolvedValue({ items: [] });
      mockUpdatePrescription.mockResolvedValue({
        items: [{ _id: 'newitem1', genericName: 'Paracetamol' }],
        investigations: [],
        diagnoses: [],
      });

      const result = await addMedicineToPrescriptionTool({ prescriptionId: 'rx1', medicineId: 'med1' }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      // Never the old hardcoded defaults ("1 + 0 + 0", "খাবার পরে", "চলবে", "Days").
      expect(updates.items[0]).toMatchObject({
        dosage: '', frequency: '', foodInstruction: '', durationValue: '', durationUnit: '', continuation: '',
      });
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/Napa/);
      expect(result.message).toMatch(/What's/i);
      expect(result.missingDosageFields).toEqual(expect.arrayContaining(['dosage', 'frequency', 'durationValue', 'foodInstruction']));
    });

    test('with dosage and frequency given but no duration: only asks about what is still missing', async () => {
      mockGetMedicineById.mockResolvedValue({ _id: 'med1', brandName: 'Napa', genericName: 'Paracetamol', strength: '500', unit: 'mg' });
      mockGetPrescriptionById.mockResolvedValue({ items: [] });
      mockUpdatePrescription.mockResolvedValue({ items: [{ _id: 'i1' }], investigations: [], diagnoses: [] });

      const result = await addMedicineToPrescriptionTool(
        { prescriptionId: 'rx1', medicineId: 'med1', dosage: '1 tablet', frequency: 'BID', foodInstruction: 'After food' },
        actor,
      );

      expect(result.missingDosageFields).toEqual(['durationValue']);
      expect(result.message).toMatch(/how long/i);
      expect(result.message).not.toMatch(/dose|often|food/i);
    });

    test('with every dosing field given: adds cleanly with no question', async () => {
      mockGetMedicineById.mockResolvedValue({ _id: 'med1', brandName: 'Napa', genericName: 'Paracetamol', strength: '500', unit: 'mg' });
      mockGetPrescriptionById.mockResolvedValue({ items: [] });
      mockUpdatePrescription.mockResolvedValue({ items: [{ _id: 'i1' }], investigations: [], diagnoses: [] });

      const result = await addMedicineToPrescriptionTool(
        {
          prescriptionId: 'rx1', medicineId: 'med1',
          dosage: '1 tablet', frequency: 'BID', foodInstruction: 'After food', durationValue: '7', durationUnit: 'Days',
        },
        actor,
      );

      expect(result.missingDosageFields).toBeUndefined();
      expect(result.message).not.toMatch(/What's/i);
    });
  });

  describe('addInvestigationToPrescriptionTool', () => {
    test('pulls cost/category from the real TEST_CATALOG, never from the caller', async () => {
      mockGetPrescriptionById.mockResolvedValue({ investigations: [] });
      mockUpdatePrescription.mockResolvedValue({ items: [], investigations: [], diagnoses: [] });

      await addInvestigationToPrescriptionTool({ prescriptionId: 'rx1', testCode: 'CBC_ESR' }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      expect(updates.investigations[0]).toMatchObject({
        testName: 'CBC (Including ESR)',
        category: 'HEMATOLOGY',
        cost: 500,
        currency: 'BDT',
        isCustom: false,
      });
    });

    test('rejects a test code that is not in the catalog rather than inventing one', async () => {
      await expect(
        addInvestigationToPrescriptionTool({ prescriptionId: 'rx1', testCode: 'NOT_A_REAL_TEST' }, actor),
      ).rejects.toThrow(/not found/i);
      expect(mockUpdatePrescription).not.toHaveBeenCalled();
    });
  });

  describe('updateVitalsTool', () => {
    test('merges only the spoken fields, preserving vitals recorded earlier in the same encounter', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        vitals: {
          bloodPressure: { systolic: 120, diastolic: 80 },
          weight: { value: 70, unit: 'kg' },
        },
      });
      mockUpdatePrescription.mockResolvedValue({ vitals: { pulse: { value: 88 } } });

      await updateVitalsTool({ prescriptionId: 'rx1', pulse: 88 }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      // Pulse was added...
      expect(updates.vitals.pulse).toMatchObject({ value: 88 });
      // ...but BP and weight recorded earlier were NOT wiped out by the update.
      expect(updates.vitals.bloodPressure).toMatchObject({ systolic: 120, diastolic: 80 });
      expect(updates.vitals.weight).toMatchObject({ value: 70, unit: 'kg' });
    });

    test('overwrites only the specific sub-field sent, keeping its siblings', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        vitals: { bloodPressure: { systolic: 120, diastolic: 80 } },
      });
      mockUpdatePrescription.mockResolvedValue({ vitals: {} });

      await updateVitalsTool({ prescriptionId: 'rx1', bloodPressureSystolic: 140 }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      expect(updates.vitals.bloodPressure).toMatchObject({ systolic: 140, diastolic: 80 });
    });
  });

  describe('addClinicalNoteTool / updateClinicalNoteTool', () => {
    test('add_clinical_note appends to existing text rather than overwriting it', async () => {
      mockGetPrescriptionById.mockResolvedValue({ chiefComplaint: 'Fever for 3 days' });
      mockUpdatePrescription.mockResolvedValue({ items: [], investigations: [], diagnoses: [] });

      await addClinicalNoteTool(
        { prescriptionId: 'rx1', field: 'chiefComplaint', text: 'and lower abdominal pain' },
        actor,
      );

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      expect(updates.chiefComplaint).toBe('Fever for 3 days and lower abdominal pain');
    });

    test('add_clinical_note on an empty field just sets the text (no leading space)', async () => {
      mockGetPrescriptionById.mockResolvedValue({});
      mockUpdatePrescription.mockResolvedValue({ items: [], investigations: [], diagnoses: [] });

      await addClinicalNoteTool({ prescriptionId: 'rx1', field: 'chiefComplaint', text: 'Fever for 3 days' }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      expect(updates.chiefComplaint).toBe('Fever for 3 days');
    });

    test('update_clinical_note replaces the field outright, ignoring what was there before', async () => {
      mockGetPrescriptionById.mockResolvedValue({ pastHistory: 'Old, incorrect note' });
      mockUpdatePrescription.mockResolvedValue({ items: [], investigations: [], diagnoses: [] });

      await updateClinicalNoteTool({ prescriptionId: 'rx1', field: 'pastHistory', text: 'Corrected note' }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      expect(updates.pastHistory).toBe('Corrected note');
    });

    test('only ever writes the one named field, not the whole prescription document', async () => {
      mockGetPrescriptionById.mockResolvedValue({ chiefComplaint: 'x' });
      mockUpdatePrescription.mockResolvedValue({ items: [], investigations: [], diagnoses: [] });

      await addClinicalNoteTool({ prescriptionId: 'rx1', field: 'drugHistory', text: 'On aspirin' }, actor);

      const [, updates] = mockUpdatePrescription.mock.calls[0];
      expect(Object.keys(updates)).toEqual(['drugHistory']);
    });
  });

  describe('setFollowUpTool', () => {
    test('writes followUpDate — the field the real prescription form actually uses', async () => {
      mockUpdatePrescription.mockResolvedValue({ items: [], investigations: [], diagnoses: [] });

      await setFollowUpTool({ prescriptionId: 'rx1', date: '2026-10-15' }, actor);

      expect(mockUpdatePrescription).toHaveBeenCalledWith('rx1', { followUpDate: '2026-10-15' }, actor);
    });
  });
});
