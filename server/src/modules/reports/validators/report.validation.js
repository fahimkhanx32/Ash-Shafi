import Joi from 'joi';
import {
  REPORT_STATUSES,
  REPORT_TYPES,
  ABNORMAL_FLAGS,
  DOCUMENT_SUBTYPES,
  DOCUMENT_SUBTYPE_TO_REPORT_TYPE,
} from '../models/medical-report.model.js';

// documentSubType is optional; when present it decides reportType (a client
// cannot pair, say, ULTRASOUND with a non-sensitive reportType to dodge the
// sensitive flag). reportType is required only when no sub-type is given.
const resolveClassification = (value, helpers) => {
  if (!value.documentSubType) {
    if (!value.reportType) return helpers.error('any.required', { label: 'reportType' });
    return value;
  }
  const derived = DOCUMENT_SUBTYPE_TO_REPORT_TYPE[value.documentSubType];
  if (value.reportType && value.reportType !== derived) {
    return helpers.message(`documentSubType ${value.documentSubType} belongs to reportType ${derived}.`);
  }
  return { ...value, reportType: derived };
};

const mongoIdSchema = Joi.string().hex().length(24);

const parameterSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  value: Joi.alternatives().try(Joi.string().trim().max(200), Joi.number()).required(),
  numericValue: Joi.number().allow(null),
  unit: Joi.string().trim().max(40).allow('', null),
  referenceRange: Joi.string().trim().max(100).allow('', null),
  abnormalFlag: Joi.string().valid(...ABNORMAL_FLAGS).default('UNKNOWN'),
  specimenType: Joi.string().trim().max(100).allow(''),
});

export const reportIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const patientProfileIdParamSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
});

export const reportParameterParamSchema = Joi.object({
  id: mongoIdSchema.required(),
  parameterId: mongoIdSchema.required(),
});

export const uploadReportBodySchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  investigationId: mongoIdSchema.allow('', null),
  reportType: Joi.string().valid(...REPORT_TYPES),
  documentSubType: Joi.string().valid(...DOCUMENT_SUBTYPES),
  orderingDoctorId: mongoIdSchema.allow('', null),
  title: Joi.string().trim().min(2).max(200).required(),
  clinicalIndication: Joi.string().trim().max(500).allow(''),
  reportDate: Joi.date().iso().allow('', null),
  performingFacility: Joi.string().trim().max(200).allow(''),
  ocrLanguage: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_+.-]{2,40}$/)
    .default('eng'),
}).custom(resolveClassification);

// Intake (patient self-submission / staff upload on a patient's behalf).
// `patientProfileId` is required for staff and deliberately ignored for
// a PATIENT caller: the service always resolves the patient from the
// caller's identity (checked there, since the rule depends on role).
export const intakeSubmitBodySchema = Joi.object({
  patientProfileId: mongoIdSchema.allow('', null),
  targetDoctorId: mongoIdSchema.allow('', null),
  reportType: Joi.string().valid(...REPORT_TYPES),
  documentSubType: Joi.string().valid(...DOCUMENT_SUBTYPES),
  orderingDoctorId: mongoIdSchema.allow('', null),
  title: Joi.string().trim().min(2).max(200).required(),
  reportDate: Joi.date().iso().allow('', null),
  performingFacility: Joi.string().trim().max(200).allow(''),
  patientNote: Joi.string().trim().max(500).allow(''),
  ocrLanguage: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_+.-]{2,40}$/)
    .default('eng'),
}).custom(resolveClassification);

export const intakeListQuerySchema = Joi.object({
  intakeStatus: Joi.string().valid('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'ALL').default('PENDING_REVIEW'),
  doctorId: mongoIdSchema,
  patientProfileId: mongoIdSchema,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// A rejection must carry a note; enforced with `when` so the error
// message names the field rather than a generic custom failure.
export const intakeSummaryQuerySchema = Joi.object({
  doctorId: mongoIdSchema,
});

export const intakeReviewSchema = Joi.object({
  decision: Joi.string().valid('ACCEPT', 'REJECT').required(),
  note: Joi.string().trim().max(500).allow('').default('').when('decision', {
    is: 'REJECT',
    then: Joi.string().trim().min(3).max(500).required(),
  }),
});

export const intakeShareSchema = Joi.object({
  targetDoctorId: mongoIdSchema.required(),
  note: Joi.string().trim().max(500).allow('').default(''),
});

export const listReportsQuerySchema = Joi.object({
  patientProfileId: mongoIdSchema,
  investigationId: mongoIdSchema,
  // BET-12.29 — "ordering doctor" filter. Named `orderingDoctorId` (not
  // `doctorId`) to match the model field it filters on (`orderingDoctor`)
  // and to stay unambiguous next to `investigations`' own `doctorId` filter,
  // which means something different there (the assigned/ordering doctor on
  // the investigation, not the report).
  orderingDoctorId: mongoIdSchema,
  reportType: Joi.string().valid(...REPORT_TYPES),
  status: Joi.string().valid(...REPORT_STATUSES),
  verificationStatus: Joi.string().valid('NOT_STARTED', 'IN_REVIEW', 'VERIFIED'),
  search: Joi.string().trim().max(100).allow(''),
  // BET-12.29 — date-range filter, applied against `reportDate` (the date
  // printed on the report itself) when present, falling back to
  // `uploadDate` per-document when a report has no `reportDate` yet — see
  // the service layer for why this can't be expressed as a single Mongo
  // field comparison.
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().when('dateFrom', {
    is: Joi.exist(),
    then: Joi.date().iso().min(Joi.ref('dateFrom')),
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const myReportsQuerySchema = Joi.object({
  investigationId: mongoIdSchema,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const reviewParameterSchema = Joi.object({
  action: Joi.string().valid('CONFIRM', 'CORRECT', 'REJECT').required(),
  correctedValue: Joi.alternatives().try(Joi.string().trim().max(200), Joi.number()).when('action', {
    is: 'CORRECT',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  unit: Joi.string().trim().max(40).allow('', null),
  referenceRange: Joi.string().trim().max(100).allow('', null),
  abnormalFlag: Joi.string().valid(...ABNORMAL_FLAGS),
  reason: Joi.string().trim().max(500).allow(''),
});

export const manualEntrySchema = Joi.object({
  parameters: Joi.array().items(parameterSchema).max(500).default([]),
  structuredSections: Joi.object().unknown(true),
  interpretation: Joi.string().trim().max(3000).allow(''),
  reportDate: Joi.date().iso().allow('', null),
}).min(1);

export const interpretationSchema = Joi.object({
  interpretation: Joi.string().trim().max(3000).required(),
});

export const amendReportSchema = Joi.object({
  parameters: Joi.array().items(parameterSchema).max(500),
  interpretation: Joi.string().trim().max(3000).allow(''),
  reason: Joi.string().trim().min(3).max(500).required(),
}).or('parameters', 'interpretation');

export const reasonSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('').default(''),
});

export const extractionRetrySchema = Joi.object({});

