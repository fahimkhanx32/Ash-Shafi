import mongoose from 'mongoose';

import { PregnancyRecord } from '../models/pregnancy-record.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { enforceSensitiveRecordAccess } from '../../gynecology/services/sensitive-record-access.service.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-08 — Obstetric & Pregnancy Records service.
 *
 * Deliberately reuses BET-07's `enforceSensitiveRecordAccess` rather
 * than forking it — it was already written generically (a `resource`
 * string parameter, a `patientProfile` argument, no gynecology-specific
 * assumptions) specifically so BET-08 could reuse it. Every function
 * that touches a `PregnancyRecord` still loads the owning
 * `PatientProfile` and runs the same provider-based-access + audit-log
 * check before doing anything else.
 */

const RESOURCE = 'pregnancy_record';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const ARRAY_FIELD_RESOURCE = Object.freeze({
  antenatalVisits: 'antenatal_visit',
  fetalObservations: 'fetal_observation',
  complications: 'pregnancy_complication',
});

const findPatientProfileOrThrow = async (patientProfileId) => {
  if (!isValidObjectId(patientProfileId)) {
    throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
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
    throw new AppError('Invalid pregnancy record id.', 400, { code: 'INVALID_ID' });
  }

  const record = await PregnancyRecord.findById(id).populate(
    'patientProfile',
    'user primaryCareProvider patientId firstName lastName',
  );

  if (!record) {
    throw new AppError('Pregnancy record not found.', 404, { code: 'RECORD_NOT_FOUND' });
  }

  return record;
};

export const createPregnancyRecord = async (patientProfileId, data, actor, requestMeta = {}) => {
  const patientProfile = await findPatientProfileOrThrow(patientProfileId);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile,
    write: true,
    action: 'CREATE',
    resource: RESOURCE,
    requestMeta,
  });

  const activeExists = await PregnancyRecord.exists({
    patientProfile: patientProfile._id,
    status: 'ACTIVE',
  });

  if (activeExists) {
    throw new AppError(
      'This patient already has an active pregnancy record. Update or close it before starting a new one.',
      409,
      { code: 'ACTIVE_PREGNANCY_EXISTS' },
    );
  }

  const record = new PregnancyRecord({
    ...data,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    createdBy: actor._id,
  });

  await record.save();

  logger.info(
    {
      event: 'pregnancy_record_created',
      recordId: record._id.toString(),
      patientProfileId: patientProfile._id.toString(),
      createdBy: String(actor._id),
    },
    'Pregnancy record created.',
  );

  return record;
};

export const getPregnancyRecordById = async (id, actor, requestMeta = {}) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: false,
    action: 'VIEW',
    resource: RESOURCE,
    requestMeta,
  });

  return record;
};

export const listPregnancyRecordsByPatientProfileId = async (
  patientProfileId,
  actor,
  requestMeta = {},
) => {
  const patientProfile = await findPatientProfileOrThrow(patientProfileId);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile,
    write: false,
    action: 'VIEW',
    resource: RESOURCE,
    requestMeta,
  });

  const records = await PregnancyRecord.find({ patientProfile: patientProfile._id }).sort({
    createdAt: -1,
  });

  return records;
};

// Self-access — same shape as `getMyGynecologyRecord` (BET-07).
export const getMyPregnancyRecords = async (actor, requestMeta = {}) => {
  const records = await PregnancyRecord.find({ patient: actor._id })
    .populate('patientProfile', 'user primaryCareProvider patientId firstName lastName')
    .sort({ createdAt: -1 });

  if (records.length === 0) {
    return [];
  }

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: records[0].patientProfile,
    write: false,
    action: 'VIEW',
    resource: RESOURCE,
    requestMeta,
  });

  return records;
};

export const updatePregnancyRecord = async (id, updates, actor, requestMeta = {}) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: true,
    action: 'UPDATE',
    resource: RESOURCE,
    requestMeta,
  });

  const protectedFields = [
    '_id',
    'patientProfile',
    'patient',
    'createdBy',
    'antenatalVisits',
    'fetalObservations',
    'complications',
  ];
  protectedFields.forEach((field) => delete updates[field]);

  Object.keys(updates).forEach((key) => {
    record[key] = updates[key];
  });

  record.updatedBy = actor._id;
  await record.save();

  logger.info(
    {
      event: 'pregnancy_record_updated',
      recordId: record._id.toString(),
      updatedBy: String(actor._id),
      fields: Object.keys(updates),
    },
    'Pregnancy record updated.',
  );

  return record;
};

// ---------------------------------------------------------------------
// Generic array sub-resource helpers — same shape as BET-07's.
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

export const addAntenatalVisit = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'antenatalVisits', data, actor, requestMeta);
export const updateAntenatalVisit = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'antenatalVisits', itemId, data, actor, requestMeta);
export const removeAntenatalVisit = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'antenatalVisits', itemId, actor, requestMeta);

export const addFetalObservation = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'fetalObservations', data, actor, requestMeta);
export const updateFetalObservation = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'fetalObservations', itemId, data, actor, requestMeta);
export const removeFetalObservation = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'fetalObservations', itemId, actor, requestMeta);

export const addPregnancyComplication = (id, data, actor, requestMeta) =>
  addArrayItem(id, 'complications', data, actor, requestMeta);
export const updatePregnancyComplication = (id, itemId, data, actor, requestMeta) =>
  updateArrayItem(id, 'complications', itemId, data, actor, requestMeta);
export const removePregnancyComplication = (id, itemId, actor, requestMeta) =>
  removeArrayItem(id, 'complications', itemId, actor, requestMeta);

// --- Delivery / postpartum — single embedded objects, updated as a whole ---

export const updateDelivery = async (id, data, actor, requestMeta = {}) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: true,
    action: 'UPDATE',
    resource: 'delivery_record',
    requestMeta,
  });

  record.delivery = { ...record.delivery.toObject(), ...data };

  // Recording a delivery outcome closes the pregnancy lifecycle.
  if (data.outcome === 'LIVE_BIRTH' || data.outcome === 'NEONATAL_DEATH') {
    record.status = 'DELIVERED';
  } else if (data.outcome === 'STILLBIRTH') {
    record.status = 'STILLBIRTH';
  }

  record.updatedBy = actor._id;
  await record.save();

  return record;
};

export const updatePostpartum = async (id, data, actor, requestMeta = {}) => {
  const record = await findRecordWithProfile(id);

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile: record.patientProfile,
    write: true,
    action: 'UPDATE',
    resource: 'postpartum_record',
    requestMeta,
  });

  record.postpartum = { ...record.postpartum.toObject(), ...data };
  record.updatedBy = actor._id;
  await record.save();

  return record;
};
