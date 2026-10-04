import mongoose from 'mongoose';

/**
 * BET-11 / Clinical Prescription Module — Prescription.
 *
 * Full database-backed medical prescription model.
 * Preserves historical data integrity: finalized prescriptions are never
 * mutated in place; revisions create a new version incrementing `versionNumber`
 * and marking the predecessor `SUPERSEDED`.
 *
 * All medicine, patient, and doctor clinical attributes are snapshotted at
 * prescribing time to guarantee the historical document never drifts even if
 * reference catalogs or profiles change.
 */
export const PRESCRIPTION_STATUSES = Object.freeze([
  'DRAFT',
  'PENDING_REVIEW',
  'FINALIZED',
  'SUPERSEDED',
  'CANCELLED',
  'ARCHIVED',
]);

export const MEDICINE_TYPES = Object.freeze([
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Cream',
  'Ointment',
  'Drops',
  'Suppository',
  'Inhaler',
  'Powder',
  'Sachet',
  'Other',
]);

export const FREQUENCIES = Object.freeze([
  '1 + 0 + 0',
  '0 + 1 + 0',
  '0 + 0 + 1',
  '1 + 1 + 1',
  '1 + 0 + 1',
  '1 + 1 + 0',
  '0 + 1 + 1',
  '1 + 1 + 1 + 1',
  'ONCE_DAILY',
  'TWICE_DAILY',
  'THREE_TIMES_DAILY',
  'FOUR_TIMES_DAILY',
  'EVERY_OTHER_DAY',
  'WEEKLY',
  'AS_NEEDED',
  'OTHER',
]);

export const FOOD_INSTRUCTIONS = Object.freeze([
  'খাবার আগে',
  'খাবার পরে',
  'খাবারের সাথে',
  'খালি পেটে',
  'যেকোনো সময়',
  'Custom',
  'Before Meal',
  'After Meal',
  'With Food',
  'Empty Stomach',
  'Anytime',
]);

export const DURATION_UNITS = Object.freeze([
  'Days',
  'Weeks',
  'Months',
  'Years',
  'DAYS',
  'WEEKS',
  'MONTHS',
  'Continuous',
  'ONGOING',
  'Until Follow-up',
  'Until Symptoms Resolve',
  'PRN / As Needed',
  'Custom',
]);

export const CONTINUATIONS = Object.freeze([
  'চলবে',
  'Continue',
  'Stop',
  'Until Next Visit',
  'Custom',
]);

export const CONSUMPTION_TIMES = Object.freeze([
  'Morning',
  'Noon',
  'Afternoon',
  'Evening',
  'Night',
  'Bedtime',
  'Before Sleep',
  'As Needed',
  'Custom',
]);

export const BLOOD_GROUPS = Object.freeze([
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'Unknown',
  'Not Tested',
]);

const vitalMeasurementSchema = new mongoose.Schema(
  {
    systolic: { type: Number, min: 0, max: 400, default: null },
    diastolic: { type: Number, min: 0, max: 300, default: null },
    value: { type: Number, min: 0, default: null },
    unit: { type: String, trim: true, maxlength: 40, default: '' },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const prescriptionVitalsSchema = new mongoose.Schema(
  {
    bloodPressure: {
      systolic: { type: Number, min: 0, max: 400, default: null },
      diastolic: { type: Number, min: 0, max: 300, default: null },
      unit: { type: String, default: 'mm of Hg' },
      recordedAt: { type: Date, default: Date.now },
    },
    pulse: {
      value: { type: Number, min: 0, max: 300, default: null },
      unit: { type: String, default: 'b/min' },
      recordedAt: { type: Date, default: Date.now },
    },
    weight: {
      value: { type: Number, min: 0, max: 500, default: null },
      unit: { type: String, default: 'kg' },
      recordedAt: { type: Date, default: Date.now },
    },
    height: {
      value: { type: Number, min: 0, max: 300, default: null },
      unit: { type: String, default: 'cm' },
      recordedAt: { type: Date, default: Date.now },
    },
    bmi: {
      value: { type: Number, min: 0, max: 200, default: null },
      category: { type: String, trim: true, maxlength: 40, default: '' },
      recordedAt: { type: Date, default: Date.now },
    },
    temperature: {
      value: { type: Number, min: 0, max: 120, default: null },
      unit: { type: String, default: '°F' },
      recordedAt: { type: Date, default: Date.now },
    },
    spo2: {
      value: { type: Number, min: 0, max: 100, default: null },
      unit: { type: String, default: '%' },
      recordedAt: { type: Date, default: Date.now },
    },
    custom: [
      {
        name: { type: String, trim: true, maxlength: 100 },
        value: { type: String, trim: true, maxlength: 100 },
        unit: { type: String, trim: true, maxlength: 40 },
        recordedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { _id: false },
);

/**
 * BMI = weight(kg) / height(m)^2. Returns null when either input is missing
 * or non-positive, rather than throwing — BMI is an optional derived vital,
 * not a required one, and prescriptions must remain saveable without it.
 */
export const computeBMI = (weightKg, heightCm) => {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  const heightM = h / 100;
  const bmi = w / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
};

export const bmiCategory = (bmi) => {
  if (bmi === null || bmi === undefined || Number.isNaN(bmi)) return '';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

const prescriptionDiagnosisItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 300 },
    code: { type: String, trim: true, maxlength: 60, default: '' },
    type: { type: String, trim: true, maxlength: 60, default: 'PRIMARY' },
    isCustom: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 1 },
  },
  { _id: true },
);

const prescriptionInvestigationItemSchema = new mongoose.Schema(
  {
    feeRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', default: null },
    testName: { type: String, required: true, trim: true, maxlength: 250 },
    category: { type: String, trim: true, maxlength: 120, default: '' },
    cost: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'BDT' },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    isCustom: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 1 },
  },
  { _id: true },
);

const prescriptionItemSchema = new mongoose.Schema(
  {
    serialNumber: { type: Number, default: 1 },
    medicineRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    medicineType: { type: String, trim: true, maxlength: 60, default: 'Tablet' },
    brandName: { type: String, trim: true, maxlength: 200, default: '' },
    medicineName: { type: String, trim: true, maxlength: 200, default: '' },
    genericName: { type: String, trim: true, maxlength: 200, default: '' },
    strength: { type: String, trim: true, maxlength: 60, default: '' },
    strengthUnit: { type: String, trim: true, maxlength: 40, default: '' },
    dosage: { type: String, trim: true, maxlength: 100, default: '1 + 0 + 0' },
    dosageForm: { type: String, trim: true, maxlength: 60, default: '' },
    route: { type: String, trim: true, maxlength: 60, default: '' },

    frequency: { type: String, default: '1 + 0 + 0' },
    consumptionTime: { type: String, trim: true, maxlength: 150, default: '' },
    foodInstruction: { type: String, trim: true, maxlength: 150, default: 'খাবার পরে' },
    timing: { type: String, trim: true, maxlength: 200, default: '' },
    durationValue: { type: String, trim: true, maxlength: 60, default: '' },
    durationUnit: { type: String, trim: true, maxlength: 60, default: 'Days' },
    continuation: { type: String, trim: true, maxlength: 100, default: 'চলবে' },
    specialInstruction: { type: String, trim: true, maxlength: 500, default: '' },
    quantity: { type: String, trim: true, maxlength: 60, default: '' },

    instructions: { type: String, trim: true, maxlength: 500, default: '' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    displayOrder: { type: Number, default: 1 },
  },
  { _id: true },
);

const prescriptionAdviceItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 600 },
    displayOrder: { type: Number, default: 1 },
  },
  { _id: true },
);

const prescriptionAuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 80 },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, trim: true, maxlength: 150, default: '' },
    performedByRole: { type: String, trim: true, maxlength: 60, default: '' },
    performedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    changes: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: true },
);

const doctorSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 150, default: '' },
    nameBangla: { type: String, trim: true, maxlength: 150, default: '' },
    degreesEnglish: { type: String, trim: true, maxlength: 250, default: '' },
    degreesBangla: { type: String, trim: true, maxlength: 250, default: '' },
    designationEnglish: { type: String, trim: true, maxlength: 200, default: '' },
    designationBangla: { type: String, trim: true, maxlength: 200, default: '' },
    departmentEnglish: { type: String, trim: true, maxlength: 200, default: '' },
    departmentBangla: { type: String, trim: true, maxlength: 200, default: '' },
    hospitalEnglish: { type: String, trim: true, maxlength: 250, default: '' },
    hospitalBangla: { type: String, trim: true, maxlength: 250, default: '' },
    specialtyEnglish: { type: String, trim: true, maxlength: 200, default: '' },
    specialtyBangla: { type: String, trim: true, maxlength: 200, default: '' },
    registrationNumber: { type: String, trim: true, maxlength: 100, default: '' },
    email: { type: String, trim: true, maxlength: 150, default: '' },
    phone: { type: String, trim: true, maxlength: 60, default: '' },
    chamberInfo: { type: String, trim: true, maxlength: 500, default: '' },
    visitingHours: { type: String, trim: true, maxlength: 300, default: '' },
    signatureUrl: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false },
);

const patientSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 150, default: '' },
    patientId: { type: String, trim: true, maxlength: 40, default: '' },
    age: { type: Number, min: 0, default: null },
    ageFormatted: { type: String, trim: true, maxlength: 60, default: '' },
    gender: { type: String, trim: true, maxlength: 40, default: '' },
    bloodGroup: { type: String, trim: true, maxlength: 20, default: '' },
    phone: { type: String, trim: true, maxlength: 60, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    visitNumber: { type: Number, min: 1, default: 1 },
    lastVisitDate: { type: Date, default: null },
    nextVisitDate: { type: Date, default: null },
    // Personal/smoking history — snapshotted at prescribing time (see
    // PatientProfile.socialHistory) so a later edit to the patient's
    // record never rewrites what an already-finalized prescription
    // recorded about their smoking status.
    smokingStatus: { type: String, trim: true, maxlength: 20, default: '' },
    smokingSummary: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false },
);

const prescriptionFollowUpSchema = new mongoose.Schema(
  {
    date: { type: Date, default: null },
    time: { type: String, trim: true, maxlength: 40, default: '' },
    instruction: { type: String, trim: true, maxlength: 300, default: '' },
    quickOption: { type: String, trim: true, maxlength: 60, default: '' },
  },
  { _id: false },
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: { type: String, unique: true, sparse: true, trim: true, uppercase: true, index: true },
    verificationToken: { type: String, unique: true, sparse: true, trim: true, index: true },

    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    delegatedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter', default: null },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

    status: { type: String, enum: PRESCRIPTION_STATUSES, default: 'DRAFT', index: true },
    prescriptionDate: { type: Date, default: Date.now, index: true },

    // Clinical Sections
    chiefComplaint: { type: String, trim: true, maxlength: 2000, default: '' },
    coMorbidities: { type: String, trim: true, maxlength: 2000, default: '' },
    pastHistory: { type: String, trim: true, maxlength: 2000, default: '' },
    personalHistory: { type: String, trim: true, maxlength: 2000, default: '' },
    smokingHistory: { type: String, trim: true, maxlength: 2000, default: '' },
    menstrualHistory: { type: String, trim: true, maxlength: 2000, default: '' },
    drugHistory: { type: String, trim: true, maxlength: 2000, default: '' },
    vitals: { type: prescriptionVitalsSchema, default: () => ({}) },
    pathologyAndImaging: { type: String, trim: true, maxlength: 3000, default: '' },
    attachedReports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MedicalReport' }],

    // Diagnoses & Summary
    diagnoses: { type: [prescriptionDiagnosisItemSchema], default: [] },
    diagnosisSummary: { type: String, trim: true, maxlength: 1000, default: '' },

    // Rx Medicines
    items: { type: [prescriptionItemSchema], default: [] },

    // Investigations
    investigations: { type: [prescriptionInvestigationItemSchema], default: [] },
    labTests: { type: [prescriptionInvestigationItemSchema], default: [] }, // alias for backward compatibility

    // Advice & Instructions
    advice: { type: [prescriptionAdviceItemSchema], default: [] },
    generalInstructions: { type: String, trim: true, maxlength: 2000, default: '' },
    investigationAdvice: { type: String, trim: true, maxlength: 2000, default: '' },
    testAdvices: { type: String, trim: true, maxlength: 2000, default: '' },

    // Follow-up
    nextFollowUp: { type: prescriptionFollowUpSchema, default: () => ({}) },
    followUpDate: { type: Date, default: null },

    // Snapshots
    doctorSnapshot: { type: doctorSnapshotSchema, default: () => ({}) },
    patientSnapshot: { type: patientSnapshotSchema, default: () => ({}) },

    // Versioning
    versionNumber: { type: Number, default: 1, min: 1 },
    previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    supersededAt: { type: Date, default: null },
    prescriptionGroupId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    // Cancellation & Archiving
    isCancelled: { type: Boolean, default: false, index: true },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, trim: true, maxlength: 500, default: '' },

    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Finalization & Audit
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    auditLog: { type: [prescriptionAuditLogSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

/**
 * Recompute BMI from vitals.weight/vitals.height whenever either changes.
 * Runs on every save (create + revision), so the snapshot always reflects
 * the weight/height recorded on *that* prescription — never a live
 * recalculation against current patient data, preserving the "historical
 * prescriptions do not change later" requirement.
 */
prescriptionSchema.pre('validate', function computeVitalsBMI(next) {
  const vitals = this.vitals;
  if (vitals && (vitals.weight?.value || vitals.height?.value)) {
    const bmiValue = computeBMI(vitals.weight?.value, vitals.height?.value);
    vitals.bmi = {
      value: bmiValue,
      category: bmiCategory(bmiValue),
      recordedAt: vitals.bmi?.recordedAt || new Date(),
    };
  }
  next();
});

prescriptionSchema.index({ patientProfile: 1, prescriptionDate: -1 });
prescriptionSchema.index({ provider: 1, prescriptionDate: -1 });
prescriptionSchema.index({ prescriptionGroupId: 1, versionNumber: 1 });
prescriptionSchema.index({ 'patientSnapshot.name': 'text', 'patientSnapshot.phone': 'text', chiefComplaint: 'text' });

export const Prescription = mongoose.model('Prescription', prescriptionSchema, 'prescriptions');
