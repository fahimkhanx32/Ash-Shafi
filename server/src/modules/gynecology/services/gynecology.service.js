import mongoose from 'mongoose';

import { GynecologyRecord } from '../models/gynecology-record.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { enforceSensitiveRecordAccess } from './sensitive-record-access.service.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-07 — Gynecology & Sensitive Clinical Records service.
 *
 * Every function that touches an existing record loads the owning
 * `PatientProfile` (for `user`/`primaryCareProvider`) and runs it
 * through `enforceSensitiveRecordAccess` — which both applies the
 * provider-based access rule and unconditionally writes an access-log
 * entry (allowed or denied) — before doing anything else. This is the
 * single choke point for BET-07's "granular access control" /
 * "sensitive-record audit requirements" / "access tracking" /
 * "unauthorized-access prevention" requirements; no other code path
 * reads or writes a `GynecologyRecord`.
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const ARRAY_FIELD_RESOURCE = Object.freeze({
  gynecologicalConditions: 'gynecological_condition',
  contraceptionHistory: 'contraception',
  stiHistory: 'sti_history',
  cervicalScreenings: 'cervical_screening',
  breastRecords: 'breast_record',
  procedures: 'gynecological_procedure',
});

const findPatientProfileOrThrow = async (patientProfileId) => {
  if (!isValidObjectId(patientProfileId)) {
    throw new AppError('Invalid patient profile id.', 400, {
      code: 'INVALID_ID',
    });
  }

  const patientProfile = await PatientProfile.findById(patientProfileId);

  if (!patientProfile) {
    throw new AppError('Patient profile not found.', 404, {
      code: 'PATIENT_PROFILE_NOT_FOUND',
    });
  }

  return patientProfile;
};

const findRecordWithProfile = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid gynecology record id.', 400, {
      code: 'INVALID_ID',
    });
  }

  const record = await GynecologyRecord.findById(id).populate(
    'patientProfile',
    'user primaryCareProvider patientId firstName lastName',
  );

  if (!record) {
    throw new AppError('Gynecology record not found.', 404, {
      code: 'RECORD_NOT_FOUND',
    });
  }

  return record;
};

/**
 * Create a gynecology record for a patient. Write access is checked
 * against the *target* patient's `primaryCareProvider` — a DOCTOR can
 * only open a sensitive record for a patient they are assigned to.
 */
export const createGynecologyRecord = async (
  patientProfileId,
  data,
  actor,
  requestMeta = {},
) => {
  const patientProfile = await findPatientProfileOrThrow(patientProfileId);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile,
    write: true,
    action: 'CREATE',
    requestMeta,
  });

  const existing = await GynecologyRecord.exists({
    patientProfile: patientProfile._id,
  });

  if (existing) {
    throw new AppError(
      'A gynecology record already exists for this patient.',
      409,
      { code: 'RECORD_ALREADY_EXISTS' },
    );
  }

  const record = new GynecologyRecord({
    ...data,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    createdBy: actor._id,
  });

  await record.save();

  logger.info(
    {
      event: 'gynecology_record_created',
      recordId: record._id.toString(),
      patientProfileId: patientProfile._id.toString(),
      createdBy: String(actor._id),
    },
    'Gynecology record created.',
  );

  return record;
};

export const getGynecologyRecordById = async (id, actor, requestMeta = {}) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: false,
    action: 'VIEW',
    requestMeta,
  });

  return record;
};

export const getGynecologyRecordByPatientProfileId = async (
  patientProfileId,
  actor,
  requestMeta = {},
) => {
  if (!isValidObjectId(patientProfileId)) {
    throw new AppError('Invalid patient profile id.', 400, {
      code: 'INVALID_ID',
    });
  }

  const record = await GynecologyRecord.findOne({
    patientProfile: patientProfileId,
  }).populate('patientProfile', 'user primaryCareProvider patientId firstName lastName');

  if (!record) {
    throw new AppError('Gynecology record not found for this patient.', 404, {
      code: 'RECORD_NOT_FOUND',
    });
  }

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: false,
    action: 'VIEW',
    requestMeta,
  });

  return record;
};

// A patient always sees their own record — same self-access shape as
// `GET /patients/me` (BET-06). `enforceSensitiveRecordAccess` is
// still called (with a minimal owner-shaped object) purely so the
// view is captured in the access log like every other read.
export const getMyGynecologyRecord = async (actor, requestMeta = {}) => {
  const record = await GynecologyRecord.findOne({ patient: actor._id }).populate(
    'patientProfile',
    'user primaryCareProvider patientId firstName lastName',
  );

  if (!record) {
    throw new AppError('You do not have a gynecology record yet.', 404, {
      code: 'RECORD_NOT_FOUND',
    });
  }

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: false,
    action: 'VIEW',
    requestMeta,
  });

  return record;
};

export const updateGynecologyRecord = async (
  id,
  updates,
  actor,
  requestMeta = {},
) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: true,
    action: 'UPDATE',
    requestMeta,
  });

  // Defense in depth on top of the schema-driven field allowlist
  // already enforced by `validate()`/`stripUnknown` — see BET-06's
  // `patient.service.js` for the same reasoning.
  const protectedFields = [
    '_id',
    'patientProfile',
    'patient',
    'createdBy',
    'gynecologicalConditions',
    'contraceptionHistory',
    'stiHistory',
    'cervicalScreenings',
    'breastRecords',
    'procedures',
  ];
  protectedFields.forEach((field) => delete updates[field]);

  Object.keys(updates).forEach((key) => {
    record[key] = updates[key];
  });

  record.updatedBy = actor._id;

  await record.save();

  logger.info(
    {
      event: 'gynecology_record_updated',
      recordId: record._id.toString(),
      updatedBy: String(actor._id),
      fields: Object.keys(updates),
    },
    'Gynecology record updated.',
  );

  return record;
};

// ---------------------------------------------------------------------
// Generic array sub-resource helpers (gynecological conditions,
// contraception, STI history, cervical screenings, breast records,
// procedures) — one shared implementation, exported per-field below
// so callers get the same explicit, named-function surface every
// other module in this codebase uses.
// ---------------------------------------------------------------------

const addArrayItem = async (id, field, itemData, actor, requestMeta) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: true,
    action: 'CREATE',
    resource: ARRAY_FIELD_RESOURCE[field],
    requestMeta,
  });

  record[field].push(itemData);
  record.updatedBy = actor._id;

  await record.save();

  return record;
};

const updateArrayItem = async (id, field, itemId, itemData, actor, requestMeta) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: true,
    action: 'UPDATE',
    resource: ARRAY_FIELD_RESOURCE[field],
    requestMeta,
  });

  const item = record[field].id(itemId);

  if (!item) {
    throw new AppError('Item not found.', 404, { code: 'ITEM_NOT_FOUND' });
  }

  Object.keys(itemData).forEach((key) => {
    item[key] = itemData[key];
  });

  record.updatedBy = actor._id;

  await record.save();

  return record;
};

const removeArrayItem = async (id, field, itemId, actor, requestMeta) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: true,
    action: 'DELETE',
    resource: ARRAY_FIELD_RESOURCE[field],
    requestMeta,
  });

  const item = record[field].id(itemId);

  if (!item) {
    throw new AppError('Item not found.', 404, { code: 'ITEM_NOT_FOUND' });
  }

  record[field].pull(itemId);
  record.updatedBy = actor._id;

  await record.save();

  return record;
};

// --- Gynecological conditions ---
export const addGynecologicalCondition = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'gynecologicalConditions', data, actor, requestMeta);
export const updateGynecologicalCondition = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'gynecologicalConditions', itemId, data, actor, requestMeta);
export const removeGynecologicalCondition = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'gynecologicalConditions', itemId, actor, requestMeta);

// --- Contraception ---
export const addContraception = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'contraceptionHistory', data, actor, requestMeta);
export const updateContraception = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'contraceptionHistory', itemId, data, actor, requestMeta);
export const removeContraception = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'contraceptionHistory', itemId, actor, requestMeta);

// --- STI / STD history ---
export const addStiHistory = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'stiHistory', data, actor, requestMeta);
export const updateStiHistory = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'stiHistory', itemId, data, actor, requestMeta);
export const removeStiHistory = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'stiHistory', itemId, actor, requestMeta);

// --- Cervical screenings ---
export const addCervicalScreening = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'cervicalScreenings', data, actor, requestMeta);
export const updateCervicalScreening = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'cervicalScreenings', itemId, data, actor, requestMeta);
export const removeCervicalScreening = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'cervicalScreenings', itemId, actor, requestMeta);

// --- Breast records ---
export const addBreastRecord = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'breastRecords', data, actor, requestMeta);
export const updateBreastRecord = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'breastRecords', itemId, data, actor, requestMeta);
export const removeBreastRecord = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'breastRecords', itemId, actor, requestMeta);

// --- Gynecological procedures ---
export const addProcedure = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'procedures', data, actor, requestMeta);
export const updateProcedure = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'procedures', itemId, data, actor, requestMeta);
export const removeProcedure = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'procedures', itemId, actor, requestMeta);
