import Joi from 'joi';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const pregnancyRecordIdParamSchema = Joi.object({ id: mongoIdSchema.required() });
export const patientProfileIdParamSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
});
export const itemIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
  itemId: mongoIdSchema.required(),
});

export const createPregnancyRecordSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  gravida: Joi.number().integer().min(0).max(50).allow(null),
  para: Joi.number().integer().min(0).max(50).allow(null),
  lmp: Joi.date().iso().allow(null),
  edd: Joi.date().iso().allow(null),
  gestationalAgeAtBookingWeeks: Joi.number().integer().min(0).max(45).allow(null),
  isMultiplePregnancy: Joi.boolean(),
  fetusCount: Joi.number().integer().min(1).max(10),
  clinicalNotes: Joi.string().trim().max(5000).allow(''),
});

export const updatePregnancyRecordSchema = Joi.object({
  status: Joi.string().valid(
    'ACTIVE',
    'DELIVERED',
    'MISCARRIAGE',
    'ECTOPIC',
    'TERMINATED',
    'STILLBIRTH',
  ),
  gravida: Joi.number().integer().min(0).max(50).allow(null),
  para: Joi.number().integer().min(0).max(50).allow(null),
  lmp: Joi.date().iso().allow(null),
  edd: Joi.date().iso().allow(null),
  gestationalAgeAtBookingWeeks: Joi.number().integer().min(0).max(45).allow(null),
  isMultiplePregnancy: Joi.boolean(),
  fetusCount: Joi.number().integer().min(1).max(10),
  clinicalNotes: Joi.string().trim().max(5000).allow(''),
}).min(1);

export const addAntenatalVisitSchema = Joi.object({
  visitDate: Joi.date().iso().required(),
  gestationalAgeWeeks: Joi.number().integer().min(0).max(45).allow(null),
  weightKg: Joi.number().min(0).max(300).allow(null),
  bloodPressure: Joi.string().trim().max(20).allow(''),
  fundalHeightCm: Joi.number().min(0).max(60).allow(null),
  fetalHeartRateBpm: Joi.number().min(0).max(300).allow(null),
  findings: Joi.string().trim().max(1000).allow(''),
  complications: Joi.string().trim().max(1000).allow(''),
  nextVisitDate: Joi.date().iso().allow(null),
  provider: Joi.string().trim().max(150).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});
export const updateAntenatalVisitSchema = addAntenatalVisitSchema
  .fork(['visitDate'], (s) => s.optional())
  .min(1);

export const addFetalObservationSchema = Joi.object({
  date: Joi.date().iso().required(),
  gestationalAgeWeeks: Joi.number().integer().min(0).max(45).allow(null),
  method: Joi.string().valid('ULTRASOUND', 'DOPPLER', 'NST', 'OTHER'),
  estimatedFetalWeightGrams: Joi.number().min(0).max(8000).allow(null),
  presentation: Joi.string().valid('CEPHALIC', 'BREECH', 'TRANSVERSE', 'UNKNOWN'),
  findings: Joi.string().trim().max(1000).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});
export const updateFetalObservationSchema = addFetalObservationSchema
  .fork(['date'], (s) => s.optional())
  .min(1);

export const addComplicationSchema = Joi.object({
  complication: Joi.string().trim().min(1).max(300).required(),
  diagnosedDate: Joi.date().iso().allow(null),
  severity: Joi.string().valid('MILD', 'MODERATE', 'SEVERE', 'UNKNOWN'),
  status: Joi.string().valid('ACTIVE', 'MANAGED', 'RESOLVED'),
  notes: Joi.string().trim().max(1000).allow(''),
});
export const updateComplicationSchema = addComplicationSchema
  .fork(['complication'], (s) => s.optional())
  .min(1);

export const updateDeliverySchema = Joi.object({
  date: Joi.date().iso().allow(null),
  type: Joi.string().valid('VAGINAL', 'ASSISTED_VAGINAL', 'C_SECTION', 'UNKNOWN').allow(null),
  location: Joi.string().trim().max(200).allow(''),
  provider: Joi.string().trim().max(150).allow(''),
  outcome: Joi.string()
    .valid('LIVE_BIRTH', 'STILLBIRTH', 'NEONATAL_DEATH', 'UNKNOWN')
    .allow(null),
  babyWeightGrams: Joi.number().min(0).max(8000).allow(null),
  babyGender: Joi.string().valid('MALE', 'FEMALE', 'UNKNOWN').allow(null),
  apgarScore1Min: Joi.number().integer().min(0).max(10).allow(null),
  apgarScore5Min: Joi.number().integer().min(0).max(10).allow(null),
  complications: Joi.string().trim().max(1000).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
}).min(1);

export const updatePostpartumSchema = Joi.object({
  checkupDate: Joi.date().iso().allow(null),
  findings: Joi.string().trim().max(1000).allow(''),
  complications: Joi.string().trim().max(1000).allow(''),
  contraceptionPlan: Joi.string().trim().max(500).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
}).min(1);
