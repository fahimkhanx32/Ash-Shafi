import Joi from 'joi';

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const encounterIdParamSchema = Joi.object({ id: mongoIdSchema.required() });
export const patientProfileIdParamSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
});

const vitalsSchema = Joi.object({
  bloodPressureSystolic: Joi.number().min(0).max(300).allow(null),
  bloodPressureDiastolic: Joi.number().min(0).max(200).allow(null),
  pulseBpm: Joi.number().min(0).max(300).allow(null),
  temperatureCelsius: Joi.number().min(25).max(45).allow(null),
  weightKg: Joi.number().min(0).max(400).allow(null),
  heightCm: Joi.number().min(0).max(250).allow(null),
  respiratoryRate: Joi.number().min(0).max(100).allow(null),
  oxygenSaturationPercent: Joi.number().min(0).max(100).allow(null),
});

const diagnosisSchema = Joi.object({
  description: Joi.string().trim().min(1).max(300).required(),
  code: Joi.string().trim().max(30).allow(''),
  type: Joi.string().valid('PRIMARY', 'SECONDARY'),
});

const followUpSchema = Joi.object({
  required: Joi.boolean(),
  date: Joi.date().iso().allow(null),
  notes: Joi.string().trim().max(500).allow(''),
});

const clinicalFieldsSchema = {
  chiefComplaint: Joi.string().trim().max(1000).allow(''),
  examinationFindings: Joi.string().trim().max(2000).allow(''),
  vitals: vitalsSchema,
  diagnoses: Joi.array().items(diagnosisSchema).max(20),
  clinicalFindings: Joi.string().trim().max(2000).allow(''),
  assessment: Joi.string().trim().max(2000).allow(''),
  treatmentPlan: Joi.string().trim().max(2000).allow(''),
  instructions: Joi.string().trim().max(1000).allow(''),
  followUp: followUpSchema,
};

export const createEncounterSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  encounterDate: Joi.date().iso(),
  ...clinicalFieldsSchema,
});

export const updateEncounterSchema = Joi.object({
  encounterDate: Joi.date().iso(),
  ...clinicalFieldsSchema,
}).min(1);

export const amendEncounterSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
  ...clinicalFieldsSchema,
}).min(2); // reason + at least one changed field
