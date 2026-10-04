import Joi from 'joi';

import {
  EXPORT_ENTITY_TYPES,
  TABULAR_EXPORT_FORMATS,
  MEDICAL_RECORD_EXPORT_FORMATS,
} from '../constants/export.constants.js';

/**
 * `GET /api/v1/exports/:entityType` query schema — checkpoint 1
 * (CSV/XLSX/PDF/JSON). Extended in later checkpoints
 * (medical-record/controlled export) rather than replaced.
 */
export const tabularExportQuerySchema = Joi.object({
  format: Joi.string()
    .valid(...TABULAR_EXPORT_FORMATS)
    .required(),
  patientProfileId: Joi.string().hex().length(24).optional(),
  category: Joi.string().optional(),
  status: Joi.string().optional(),
  search: Joi.string().trim().max(200).optional(),
  // Passed straight through to `listPatientProfiles` for the
  // `PATIENTS` entity type — same filter surface the native
  // `GET /api/v1/patients` list endpoint already accepts.
  patientStatus: Joi.string().optional(),
  gender: Joi.string().optional(),
});

export const tabularExportParamsSchema = Joi.object({
  entityType: Joi.string()
    .valid(...Object.values(EXPORT_ENTITY_TYPES))
    .required(),
});

/**
 * BET-19 checkpoint 2 — "Medical-record export" / "Controlled
 * export": `POST /api/v1/exports/patients/:patientProfileId/medical-record`
 */
export const medicalRecordExportParamsSchema = Joi.object({
  patientProfileId: Joi.string().hex().length(24).required(),
});

export const medicalRecordExportBodySchema = Joi.object({
  format: Joi.string()
    .valid(...MEDICAL_RECORD_EXPORT_FORMATS)
    .default('PDF'),
});

/** `GET /api/v1/exports/download/:token` */
export const exportDownloadParamsSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
});
