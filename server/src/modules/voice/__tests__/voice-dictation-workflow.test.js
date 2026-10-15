import { jest } from '@jest/globals';

const mockGetMedicineById = jest.fn();
const mockAutocompleteMedicines = jest.fn();
const mockListPatientProfiles = jest.fn();
const mockGetPatientProfileById = jest.fn();
const mockGetPrescriptionById = jest.fn();
const mockUpdatePrescription = jest.fn();
const mockCreatePrescription = jest.fn();
const mockFinalizePrescription = jest.fn();
const mockCancelPrescription = jest.fn();
const mockRecordAuditEvent = jest.fn();

jest.unstable_mockModule('../../medicines/services/medicine.service.js', () => ({
  getMedicineById: mockGetMedicineById,
  autocompleteMedicines: mockAutocompleteMedicines,
}));

jest.unstable_mockModule('../../patients/services/patient.service.js', () => ({
  listPatientProfiles: mockListPatientProfiles,
  getPatientProfileById: mockGetPatientProfileById,
  getPatientProfileByUserId: jest.fn(),
}));

jest.unstable_mockModule('../../prescriptions/services/prescription.service.js', () => ({
  getPrescriptionById: mockGetPrescriptionById,
  updatePrescription: mockUpdatePrescription,
  createPrescription: mockCreatePrescription,
  finalizePrescription: mockFinalizePrescription,
  cancelPrescription: mockCancelPrescription,
}));

jest.unstable_mockModule('../../../audit/audit.service.js', () => ({
  recordAuditEvent: mockRecordAuditEvent,
}));

const { executeVoiceTool } = await import('../services/voice-tool-executor.service.js');
const { validateToolArgs } = await import('../validators/voice.validation.js');
const { searchPatient } = await import('../tools/patient.tools.js');
const { searchMedicine } = await import('../tools/medicine.tools.js');

const doctor = { _id: '507f1f77bcf86cd799439011', role: 'DOCTOR' };
const patientProfileId = '507f1f77bcf86cd799439012';
const prescriptionId = '507f1f77bcf86cd799439013';
const medicineId = '507f1f77bcf86cd799439014';
const itemId = '507f1f77bcf86cd799439015';

describe('Voice-to-Prescription Complete Dictation Workflow Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Search disambiguation without false confirmation gates', () => {
    test('search_patient with multiple matches does NOT set requiresConfirmation: true', async () => {
      mockListPatientProfiles.mockResolvedValue({
        profiles: [
          { _id: '507f1f77bcf86cd799439012', firstName: 'Rahim', lastName: 'Ahmed', patientId: 'P-1', phone: '01711111111' },
          { _id: '507f1f77bcf86cd799439016', firstName: 'Rahim', lastName: 'Khan', patientId: 'P-2', phone: '01722222222' },
        ],
      });

      const res = await searchPatient({ query: 'Rahim' }, doctor);
      expect(res.success).toBe(true);
      expect(res.results.length).toBe(2);
      expect(res.requiresConfirmation).toBeUndefined();
      expect(res.disambiguationNeeded).toBe(true);
    });

    test('search_medicine with multiple matches does NOT set requiresConfirmation: true', async () => {
      mockAutocompleteMedicines.mockResolvedValue([
        { _id: '507f1f77bcf86cd799439014', brandName: 'Napa', genericName: 'Paracetamol', strength: '500', unit: 'mg' },
        { _id: '507f1f77bcf86cd799439017', brandName: 'Napa Extra', genericName: 'Paracetamol + Caffeine', strength: '500+65', unit: 'mg' },
      ]);

      const res = await searchMedicine({ query: 'Napa' });
      expect(res.success).toBe(true);
      expect(res.results.length).toBe(2);
      expect(res.requiresConfirmation).toBeUndefined();
      expect(res.disambiguationNeeded).toBe(true);
    });
  });

  describe('Normalizations in validateToolArgs', () => {
    test('normalizes shorthand frequency 1+0+1 to "1 + 0 + 1"', () => {
      const { value, error } = validateToolArgs('add_medicine_to_prescription', {
        prescriptionId,
        medicineId,
        frequency: '1+0+1',
      });
      expect(error).toBeUndefined();
      expect(value.frequency).toBe('1 + 0 + 1');
    });

    test('normalizes natural language frequency "twice daily" to "TWICE_DAILY"', () => {
      const { value, error } = validateToolArgs('add_medicine_to_prescription', {
        prescriptionId,
        medicineId,
        frequency: 'twice daily',
      });
      expect(error).toBeUndefined();
      expect(value.frequency).toBe('TWICE_DAILY');
    });

    test('normalizes "after meal" food instruction and "days" duration unit', () => {
      const { value, error } = validateToolArgs('add_medicine_to_prescription', {
        prescriptionId,
        medicineId,
        foodInstruction: 'after meal',
        durationUnit: 'days',
      });
      expect(error).toBeUndefined();
      expect(value.foodInstruction).toBe('After Meal');
      expect(value.durationUnit).toBe('Days');
    });

    test('normalizes clinical note field "chief_complaint" to "chiefComplaint"', () => {
      const { value, error } = validateToolArgs('add_clinical_note', {
        prescriptionId,
        field: 'chief_complaint',
        text: 'Fever for 3 days',
      });
      expect(error).toBeUndefined();
      expect(value.field).toBe('chiefComplaint');
    });
  });

  describe('End-to-End Dictation Actions via executeVoiceTool', () => {
    test('1. create_prescription starts a new draft', async () => {
      mockCreatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        patientSnapshot: { name: 'Rahim Ahmed' },
        items: [],
        investigations: [],
        diagnoses: [],
      });

      const res = await executeVoiceTool({
        toolName: 'create_prescription',
        args: { patientProfileId },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.prescription.prescriptionId).toBe(prescriptionId);
      expect(mockCreatePrescription).toHaveBeenCalledWith(patientProfileId, {}, doctor);
    });

    test('2. add_clinical_note appends to chief complaint', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
        chiefComplaint: '',
      });
      mockUpdatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        chiefComplaint: 'Fever with chills for 3 days',
      });

      const res = await executeVoiceTool({
        toolName: 'add_clinical_note',
        args: { prescriptionId, field: 'chiefComplaint', text: 'Fever with chills for 3 days', patientProfileId },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('chief complaint');
      expect(mockUpdatePrescription).toHaveBeenCalledWith(
        prescriptionId,
        { chiefComplaint: 'Fever with chills for 3 days' },
        doctor,
      );
    });

    test('3. update_vitals records vital signs', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
        vitals: {},
      });
      mockUpdatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        vitals: {
          bloodPressure: { systolic: 120, diastolic: 80 },
          pulse: { value: 72 },
          temperature: { value: 101 },
          weight: { value: 65 },
          spo2: { value: 98 },
        },
      });

      const res = await executeVoiceTool({
        toolName: 'update_vitals',
        args: {
          prescriptionId,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          pulse: 72,
          temperatureF: 101,
          weightKg: 65,
          spo2: 98,
          patientProfileId,
        },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('BP 120/80');
      expect(res.message).toContain('pulse 72');
    });

    test('4. add_diagnosis_to_prescription records diagnosis', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
        diagnoses: [],
      });
      mockUpdatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        diagnoses: [{ name: 'Acute Viral Fever', type: 'PRIMARY' }],
      });

      const res = await executeVoiceTool({
        toolName: 'add_diagnosis_to_prescription',
        args: { prescriptionId, name: 'Acute Viral Fever', type: 'PRIMARY', patientProfileId },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Acute Viral Fever');
    });

    test('5. add_medicine_to_prescription adds medicine with dosage, frequency, duration', async () => {
      mockGetMedicineById.mockResolvedValue({
        _id: medicineId,
        brandName: 'Napa',
        genericName: 'Paracetamol',
        strength: '500',
        unit: 'mg',
        dosageForm: 'Tablet',
        route: 'Oral',
      });
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
        items: [],
      });
      mockUpdatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        items: [{ _id: itemId, brandName: 'Napa', strength: '500', strengthUnit: 'mg' }],
      });

      const res = await executeVoiceTool({
        toolName: 'add_medicine_to_prescription',
        args: {
          prescriptionId,
          medicineId,
          dosage: '1 tablet',
          frequency: '1 + 1 + 1',
          foodInstruction: 'After Meal',
          durationValue: '5',
          durationUnit: 'Days',
          patientProfileId,
        },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Napa 500mg has been added');
    });

    test('6. add_investigation_to_prescription adds CBC from test catalog', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
        investigations: [],
      });
      mockUpdatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        investigations: [{ testName: 'Complete Blood Count (CBC)' }],
      });

      const res = await executeVoiceTool({
        toolName: 'add_investigation_to_prescription',
        args: { prescriptionId, testCode: 'CBC', notes: 'Routine', patientProfileId },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('CBC (Including ESR)');
    });

    test('7. add_advice records patient advice', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
        advice: [],
      });
      mockUpdatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        advice: [{ text: 'Drink plenty of water' }],
      });

      const res = await executeVoiceTool({
        toolName: 'add_advice',
        args: { prescriptionId, text: 'Drink plenty of water and take bed rest.', patientProfileId },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('Advice added.');
    });

    test('8. set_follow_up sets follow-up date', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
      });
      mockUpdatePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'DRAFT',
        followUpDate: new Date('2026-10-25'),
      });

      const res = await executeVoiceTool({
        toolName: 'set_follow_up',
        args: { prescriptionId, date: '2026-10-25', patientProfileId },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Follow-up set');
    });

    test('9. finalize_prescription requires doctor confirmation first, then commits', async () => {
      // Step A: Calling without confirmed: true -> returns requiresConfirmation: true
      const stepA = await executeVoiceTool({
        toolName: 'finalize_prescription',
        args: { prescriptionId, patientProfileId },
        actor: doctor,
      });

      expect(stepA.success).toBe(false);
      expect(stepA.requiresConfirmation).toBe(true);
      expect(stepA.message).toContain('explicit confirmation');
      expect(mockFinalizePrescription).not.toHaveBeenCalled();

      // Step B: Doctor confirms -> calls with confirmed: true
      mockFinalizePrescription.mockResolvedValue({
        _id: prescriptionId,
        prescriptionId: 'RX-2026-0001',
        status: 'FINALIZED',
      });

      const stepB = await executeVoiceTool({
        toolName: 'finalize_prescription',
        args: { prescriptionId, confirmed: true, patientProfileId },
        actor: doctor,
      });

      expect(stepB.success).toBe(true);
      expect(stepB.message).toBe('Prescription finalized.');
      expect(mockFinalizePrescription).toHaveBeenCalledWith(prescriptionId, doctor);
    });

    test('10. generate_prescription_pdf returns printable PDF URL', async () => {
      mockGetPrescriptionById.mockResolvedValue({
        _id: prescriptionId,
        patientProfile: patientProfileId,
      });

      const res = await executeVoiceTool({
        toolName: 'generate_prescription_pdf',
        args: { prescriptionId, patientProfileId },
        actor: doctor,
      });

      expect(res.success).toBe(true);
      expect(res.pdfUrl).toBe(`/api/v1/prescriptions/${prescriptionId}/pdf`);
    });
  });
});
