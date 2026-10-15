import Joi from 'joi';
import { LAB_REQUISITION_PRIORITIES } from '../models/lab-requisition.model.js';

const mongoId = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

export const createLabRequisitionSchema = Joi.object({
  // Patient — either a registered profile ID or walk-in info
  patientProfileId: mongoId.optional(),
  // Walk-in patient data (used when patientProfileId is absent)
  walkIn: Joi.object({
    firstName:  Joi.string().trim().max(100).required(),
    lastName:   Joi.string().trim().max(100).allow('').optional(),
    age:        Joi.string().trim().max(20).allow('').optional(),
    sex:        Joi.string().valid('Male', 'Female', 'Other').optional(),
    phone:      Joi.string().trim().max(20).allow('').optional(),
    bloodGroup: Joi.string().trim().max(10).allow('').optional(),
  }).optional(),

  tests: Joi.array()
    .items(
      Joi.object({
        code:     Joi.string().trim().max(40).required(),
        name:     Joi.string().trim().max(200).required(),
        category: Joi.string().trim().max(60).required(),
        costBDT:  Joi.number().min(0).default(0),
        notes:    Joi.string().trim().max(300).allow('').optional(),
      }),
    )
    .min(1)
    .required()
    .messages({ 'array.min': 'At least one test must be selected.' }),

  referredByDoctorId: mongoId.allow(null, '').optional(),
  clinicalDiagnosis: Joi.string().trim().max(500).allow('').optional(),
  priority:          Joi.string().valid(...LAB_REQUISITION_PRIORITIES).optional(),
  notes:             Joi.string().trim().max(1000).allow('').optional(),
  admissionDetails: Joi.object({
    cabinSemiCabin: Joi.string().trim().max(60).allow('').optional(),
    opdWardNo:      Joi.string().trim().max(60).allow('').optional(),
    bedNo:          Joi.string().trim().max(30).allow('').optional(),
    payingStatus:   Joi.string().trim().max(30).allow('').optional(),
  }).optional(),
  encounterId:       mongoId.allow(null, '').optional(),
  prescriptionId:    mongoId.allow(null, '').optional(),
}).or('patientProfileId', 'walkIn'); // must supply one or the other

export const updateLabRequisitionSchema = Joi.object({
  walkIn: Joi.object({
    firstName:  Joi.string().trim().max(100).optional(),
    lastName:   Joi.string().trim().max(100).allow('').optional(),
    age:        Joi.string().trim().max(20).allow('').optional(),
    sex:        Joi.string().valid('Male', 'Female', 'Other').optional(),
    phone:      Joi.string().trim().max(20).allow('').optional(),
    bloodGroup: Joi.string().trim().max(10).allow('').optional(),
  }).optional(),

  tests: Joi.array()
    .items(
      Joi.object({
        code:     Joi.string().trim().max(40).required(),
        name:     Joi.string().trim().max(200).required(),
        category: Joi.string().trim().max(60).required(),
        costBDT:  Joi.number().min(0).default(0),
        notes:    Joi.string().trim().max(300).allow('').optional(),
      }),
    )
    .min(1)
    .optional(),

  referredByDoctorId: mongoId.allow(null, '').optional(),
  clinicalDiagnosis: Joi.string().trim().max(500).allow('').optional(),
  priority:          Joi.string().valid(...LAB_REQUISITION_PRIORITIES).optional(),
  notes:             Joi.string().trim().max(1000).allow('').optional(),
  admissionDetails: Joi.object({
    cabinSemiCabin: Joi.string().trim().max(60).allow('').optional(),
    opdWardNo:      Joi.string().trim().max(60).allow('').optional(),
    bedNo:          Joi.string().trim().max(30).allow('').optional(),
    payingStatus:   Joi.string().trim().max(30).allow('').optional(),
  }).optional(),
}).min(1);

export const issueLabRequisitionSchema = Joi.object({
  notes: Joi.string().trim().max(500).allow('').optional(),
});

export const cancelLabRequisitionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('').optional(),
});

export const listLabRequisitionsQuerySchema = Joi.object({
  patientProfileId: mongoId.optional(),
  doctorId:         mongoId.optional(),
  status:           Joi.string().valid('DRAFT', 'ISSUED', 'CANCELLED').optional(),
  search:           Joi.string().trim().max(100).allow('').optional(),
  page:             Joi.number().integer().min(1).default(1),
  limit:            Joi.number().integer().min(1).max(100).default(20),
});

export const myLabRequisitionsQuerySchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const labRequisitionIdParamSchema = Joi.object({
  id: mongoId.required(),
});
