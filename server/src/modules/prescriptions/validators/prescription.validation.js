import Joi from 'joi';

import {
  FREQUENCIES,
  DURATION_UNITS,
  PRESCRIPTION_STATUSES,
  MEDICINE_TYPES,
  FOOD_INSTRUCTIONS,
  CONTINUATIONS,
} from '../models/prescription.model.js';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const prescriptionIdParamSchema = Joi.object({ id: mongoIdSchema.required() });
export const patientProfileIdParamSchema = Joi.object({ patientProfileId: mongoIdSchema.required() });
export const verificationTokenParamSchema = Joi.object({ token: Joi.string().trim().min(6).max(100).required() });

const vitalMeasurementSchema = Joi.object({
  systolic: Joi.number().min(0).max(400).allow(null),
  diastolic: Joi.number().min(0).max(300).allow(null),
  value: Joi.number().min(0).allow(null),
  unit: Joi.string().trim().max(40).allow(''),
  recordedAt: Joi.date().iso().allow(null),
});

const vitalsSchema = Joi.object({
  bloodPressure: Joi.object({
    systolic: Joi.number().min(0).max(400).allow(null),
    diastolic: Joi.number().min(0).max(300).allow(null),
    unit: Joi.string().trim().max(40).allow(''),
    recordedAt: Joi.date().iso().allow(null),
  }).allow(null),
  pulse: Joi.object({
    value: Joi.number().min(0).max(300).allow(null),
    unit: Joi.string().trim().max(40).allow(''),
    recordedAt: Joi.date().iso().allow(null),
  }).allow(null),
  weight: Joi.object({
    value: Joi.number().min(0).max(500).allow(null),
    unit: Joi.string().trim().max(40).allow(''),
    recordedAt: Joi.date().iso().allow(null),
  }).allow(null),
  height: Joi.object({
    value: Joi.number().min(0).max(300).allow(null),
    unit: Joi.string().trim().max(40).allow(''),
    recordedAt: Joi.date().iso().allow(null),
  }).allow(null),
  bmi: Joi.object({
    value: Joi.number().min(0).max(200).allow(null),
    category: Joi.string().trim().max(40).allow(''),
    recordedAt: Joi.date().iso().allow(null),
  }).allow(null),
  temperature: Joi.object({
    value: Joi.number().min(0).max(120).allow(null),
    unit: Joi.string().trim().max(40).allow(''),
    recordedAt: Joi.date().iso().allow(null),
  }).allow(null),
  spo2: Joi.object({
    value: Joi.number().min(0).max(100).allow(null),
    unit: Joi.string().trim().max(40).allow(''),
    recordedAt: Joi.date().iso().allow(null),
  }).allow(null),
  custom: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().max(100).allow(''),
        value: Joi.string().trim().max(100).allow(''),
        unit: Joi.string().trim().max(40).allow(''),
        recordedAt: Joi.date().iso().allow(null),
      }),
    )
    .max(20),
}).allow(null);

const diagnosisItemSchema = Joi.object({
  _id: Joi.string().allow(null, ''),
  id: Joi.string().allow(null, ''),
  name: Joi.string().trim().min(1).max(300).required(),
  code: Joi.string().trim().max(60).allow(''),
  type: Joi.string().trim().max(60).default('PRIMARY'),
  isCustom: Joi.boolean().default(false),
  displayOrder: Joi.number().default(1),
});

const investigationItemSchema = Joi.object({
  _id: Joi.string().allow(null, ''),
  id: Joi.string().allow(null, ''),
  feeRef: mongoIdSchema.allow(null),
  testName: Joi.string().trim().min(1).max(250).required(),
  category: Joi.string().trim().max(120).allow(''),
  cost: Joi.number().min(0).default(0),
  currency: Joi.string().trim().length(3).uppercase().default('BDT'),
  notes: Joi.string().trim().max(400).allow(''),
  isCustom: Joi.boolean().default(false),
  displayOrder: Joi.number().default(1),
});

const itemSchema = Joi.object({
  _id: Joi.string().allow(null, ''),
  id: Joi.string().allow(null, ''),
  serialNumber: Joi.number().min(1).default(1),
  medicineRef: mongoIdSchema.allow(null),
  medicineType: Joi.string().trim().max(60).default('Tablet'),
  brandName: Joi.string().trim().max(200).allow(''),
  medicineName: Joi.string().trim().max(200).allow(''),
  genericName: Joi.string().trim().max(200).allow(''),
  strength: Joi.string().trim().max(60).allow(''),
  strengthUnit: Joi.string().trim().max(40).allow(''),
  dosage: Joi.string().trim().max(100).allow(''),
  dosageForm: Joi.string().trim().max(60).allow(''),
  route: Joi.string().trim().max(60).allow(''),
  frequency: Joi.string().trim().max(100).allow(''),
  consumptionTime: Joi.string().trim().max(150).allow(''),
  foodInstruction: Joi.string().trim().max(150).allow(''),
  timing: Joi.string().trim().max(200).allow(''),
  durationValue: Joi.alternatives().try(Joi.number().min(0), Joi.string().trim().max(60)).allow(null, ''),
  durationUnit: Joi.string().trim().max(60).allow(''),
  continuation: Joi.string().trim().max(100).allow(''),
  specialInstruction: Joi.string().trim().max(500).allow(''),
  quantity: Joi.string().trim().max(60).allow(''),
  instructions: Joi.string().trim().max(500).allow(''),
  notes: Joi.string().trim().max(500).allow(''),
  displayOrder: Joi.number().default(1),
});

const adviceItemSchema = Joi.object({
  _id: Joi.string().allow(null, ''),
  id: Joi.string().allow(null, ''),
  text: Joi.string().trim().min(1).max(600).required(),
  displayOrder: Joi.number().default(1),
});

const nextFollowUpSchema = Joi.object({
  date: Joi.date().iso().allow(null),
  time: Joi.string().trim().max(40).allow(''),
  instruction: Joi.string().trim().max(300).allow(''),
  quickOption: Joi.string().trim().max(60).allow(''),
}).allow(null);

const doctorSnapshotSchema = Joi.object({
  name: Joi.string().trim().max(150).allow(''),
  nameBangla: Joi.string().trim().max(150).allow(''),
  degreesEnglish: Joi.string().trim().max(250).allow(''),
  degreesBangla: Joi.string().trim().max(250).allow(''),
  designationEnglish: Joi.string().trim().max(200).allow(''),
  designationBangla: Joi.string().trim().max(200).allow(''),
  departmentEnglish: Joi.string().trim().max(200).allow(''),
  departmentBangla: Joi.string().trim().max(200).allow(''),
  hospitalEnglish: Joi.string().trim().max(250).allow(''),
  hospitalBangla: Joi.string().trim().max(250).allow(''),
  specialtyEnglish: Joi.string().trim().max(200).allow(''),
  specialtyBangla: Joi.string().trim().max(200).allow(''),
  registrationNumber: Joi.string().trim().max(100).allow(''),
  email: Joi.string().trim().max(150).allow(''),
  phone: Joi.string().trim().max(60).allow(''),
  chamberInfo: Joi.string().trim().max(500).allow(''),
  visitingHours: Joi.string().trim().max(300).allow(''),
  signatureUrl: Joi.string().trim().max(500).allow(''),
}).allow(null);

const patientSnapshotSchema = Joi.object({
  name: Joi.string().trim().max(150).allow(''),
  patientId: Joi.string().trim().max(40).allow(''),
  age: Joi.number().min(0).allow(null),
  ageFormatted: Joi.string().trim().max(60).allow(''),
  gender: Joi.string().trim().max(40).allow(''),
  bloodGroup: Joi.string().trim().max(20).allow(''),
  phone: Joi.string().trim().max(60).allow(''),
  address: Joi.string().trim().max(300).allow(''),
  visitNumber: Joi.number().min(1).default(1),
  lastVisitDate: Joi.date().iso().allow(null),
  nextVisitDate: Joi.date().iso().allow(null),
  smokingStatus: Joi.string().trim().max(20).allow(''),
  smokingSummary: Joi.string().trim().max(300).allow(''),
}).allow(null);

const commonFieldsSchema = {
  encounter: mongoIdSchema.allow(null),
  appointment: mongoIdSchema.allow(null),
  // Back-dating is allowed (e.g. entering an old paper prescription); future dates are not.
  prescriptionDate: Joi.date().iso().max('now'),

  chiefComplaint: Joi.string().trim().max(2000).allow(''),
  coMorbidities: Joi.string().trim().max(2000).allow(''),
  pastHistory: Joi.string().trim().max(2000).allow(''),
  personalHistory: Joi.string().trim().max(2000).allow(''),
  smokingHistory: Joi.string().trim().max(2000).allow(''),
  menstrualHistory: Joi.string().trim().max(2000).allow(''),
  drugHistory: Joi.string().trim().max(2000).allow(''),
  vitals: vitalsSchema,
  pathologyAndImaging: Joi.string().trim().max(3000).allow(''),
  attachedReports: Joi.array().items(mongoIdSchema).max(20),

  diagnoses: Joi.array().items(diagnosisItemSchema).max(30),
  diagnosisSummary: Joi.string().trim().max(1000).allow(''),

  items: Joi.array().items(itemSchema).max(50),

  investigations: Joi.array().items(investigationItemSchema).max(50),
  labTests: Joi.array().items(investigationItemSchema).max(50),

  advice: Joi.alternatives().try(
    Joi.array().items(adviceItemSchema),
    Joi.array().items(Joi.string().trim().max(600)),
    Joi.string().trim().max(3000),
  ),
  generalInstructions: Joi.string().trim().max(2000).allow(''),
  investigationAdvice: Joi.string().trim().max(2000).allow(''),
  testAdvices: Joi.string().trim().max(2000).allow(''),

  nextFollowUp: nextFollowUpSchema,
  followUpDate: Joi.date().iso().allow(null),

  doctorSnapshot: doctorSnapshotSchema,
  patientSnapshot: patientSnapshotSchema,
};

export const createPrescriptionSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  ...commonFieldsSchema,
});

export const updatePrescriptionSchema = Joi.object({
  ...commonFieldsSchema,
}).min(1);

export const revisePrescriptionSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
  ...commonFieldsSchema,
}).min(2);

export const cancelPrescriptionSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
});

export const archivePrescriptionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

export const favoriteMedicineSchema = Joi.object({
  brandName: Joi.string().trim().max(200).allow(''),
  medicineName: Joi.string().trim().max(200).allow(''),
  genericName: Joi.string().trim().max(200).allow(''),
  medicineType: Joi.string().trim().max(60).default('Tablet'),
  strength: Joi.string().trim().max(60).allow(''),
  strengthUnit: Joi.string().trim().max(40).default('mg'),
  dosage: Joi.string().trim().max(60).default('1 + 0 + 0'),
  foodInstruction: Joi.string().trim().max(100).default('খাবার পরে'),
  durationValue: Joi.string().trim().max(40).default('14'),
  durationUnit: Joi.string().trim().max(40).default('Days'),
  continuation: Joi.string().trim().max(60).default('চলবে'),
  specialInstruction: Joi.string().trim().max(300).allow(''),
});

export const listPrescriptionsQuerySchema = Joi.object({
  search: Joi.string().trim().max(100).allow(''),
  patientProfileId: mongoIdSchema,
  providerId: mongoIdSchema,
  status: Joi.string().valid(...PRESCRIPTION_STATUSES, ''),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('newest', 'oldest', 'date_asc', 'date_desc').default('newest'),
});
