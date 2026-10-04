import mongoose from 'mongoose';

import { Encounter } from '../models/encounter.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-09 — Consultation & Clinical Encounters service.
 *
 * Authorization is `MEDICAL_RECORDS_READ`/`WRITE` at the route layer
 * (matching BET-06's precedent — see
 * `modules/patients/utils/patient-access.util.js`'s comment on why
 * that's a distinct permission from `PATIENTS_READ`/`WRITE`), not the
 * per-record provider-based check gynecology/obstetrics use — that
 * pattern exists specifically for `SENSITIVE_RECORDS_*` and a general
 * consultation record isn't automatically reproductive/sexual-health
 * data the way a `GynecologyRecord`/`PregnancyRecord` is.
 *
 * "All changes must be auditable" (master prompt §21) is implemented
 * two ways here: structured `logger.info` events on every mutation
 * (the same lightweight convention BET-06/07/08 already use, pending
 * BET-17's real audit-log collection), and — the part that actually
 * matters for medical-record integrity (§50) — a finalized encounter
 * cannot be silently edited. `updateEncounter` only works on DRAFT
 * encounters; correcting a FINALIZED one goes through
 * `amendEncounter`, which snapshots the pre-correction state into an
 * append-only `amendments` array before applying the change.
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findPatientProfileOrThrow = async (patientProfileId) => {
  if (!isValidObjectId(patientProfileId)) {
    throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
  }
  const patientProfile = await PatientProfile.findById(patientProfileId);
  if (!patientProfile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PATIENT_PROFILE_NOT_FOUND' });
  }
  return patientProfile;
};

const findEncounterOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid encounter id.', 400, { code: 'INVALID_ID' });
  }
  const encounter = await Encounter.findById(id);
  if (!encounter) {
    throw new AppError('Encounter not found.', 404, { code: 'ENCOUNTER_NOT_FOUND' });
  }
  return encounter;
};

const CLINICAL_FIELDS = [
  'chiefComplaint',
  'examinationFindings',
  'vitals',
  'diagnoses',
  'clinicalFindings',
  'assessment',
  'treatmentPlan',
  'instructions',
  'followUp',
];

const snapshotClinicalFields = (encounter) => {
  const snapshot = {};
  for (const field of CLINICAL_FIELDS) {
    const value = encounter[field];
    snapshot[field] = value && typeof value.toObject === 'function' ? value.toObject() : value;
  }
  return snapshot;
};

export const createEncounter = async (patientProfileId, data, actor) => {
  const patientProfile = await findPatientProfileOrThrow(patientProfileId);

  const encounter = await Encounter.create({
    ...data,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    provider: actor._id,
    createdBy: actor._id,
  });

  logger.info(
    {
      event: 'encounter_created',
      encounterId: encounter._id.toString(),
      patientProfileId: patientProfile._id.toString(),
      provider: String(actor._id),
    },
    'Clinical encounter created.',
  );

  return encounter;
};

export const getEncounterById = async (id) => findEncounterOrThrow(id);

// BET-23 — deliberately NOT paginated: a clinician viewing a
// patient's encounter timeline needs the complete continuity-of-care
// history in one call, not a page-1-of-N list that could silently
// hide an older but clinically relevant encounter. `.lean()` is
// still applied since this is read-only display data with no
// downstream `.save()` on these results.
export const listEncountersByPatientProfileId = async (patientProfileId) => {
  await findPatientProfileOrThrow(patientProfileId);
  return Encounter.find({ patientProfile: patientProfileId })
    .sort({ encounterDate: -1 })
    .populate('provider', 'name email role')
    .lean();
};

// Self-access — same shape as `getMyGynecologyRecord`/`getMyPregnancyRecords`.
export const getMyEncounters = async (actor) =>
  Encounter.find({ patient: actor._id })
    .sort({ encounterDate: -1 })
    .populate('provider', 'name email role')
    .lean();

export const updateEncounter = async (id, updates, actor) => {
  const encounter = await findEncounterOrThrow(id);

  if (encounter.status === 'FINALIZED') {
    throw new AppError(
      'This encounter has been finalized and cannot be edited directly — use the amend endpoint instead.',
      409,
      { code: 'ENCOUNTER_FINALIZED' },
    );
  }

  const protectedFields = [
    '_id',
    'patientProfile',
    'patient',
    'provider',
    'status',
    'amendments',
    'finalizedAt',
    'finalizedBy',
    'createdBy',
  ];
  protectedFields.forEach((field) => delete updates[field]);

  Object.assign(encounter, updates, { updatedBy: actor._id });
  await encounter.save();

  logger.info(
    { event: 'encounter_updated', encounterId: encounter._id.toString(), updatedBy: String(actor._id) },
    'Clinical encounter updated.',
  );

  return encounter;
};

export const finalizeEncounter = async (id, actor) => {
  const encounter = await findEncounterOrThrow(id);

  if (encounter.status === 'FINALIZED') {
    throw new AppError('This encounter has already been finalized.', 409, {
      code: 'ENCOUNTER_ALREADY_FINALIZED',
    });
  }

  const hasClinicalContent =
    encounter.chiefComplaint || encounter.diagnoses.length > 0 || encounter.assessment;
  if (!hasClinicalContent) {
    throw new AppError(
      'Add at least a chief complaint, diagnosis, or assessment before finalizing.',
      422,
      { code: 'ENCOUNTER_EMPTY' },
    );
  }

  encounter.status = 'FINALIZED';
  encounter.finalizedAt = new Date();
  encounter.finalizedBy = actor._id;
  encounter.updatedBy = actor._id;
  await encounter.save();

  logger.info(
    { event: 'encounter_finalized', encounterId: encounter._id.toString(), finalizedBy: String(actor._id) },
    'Clinical encounter finalized.',
  );

  return encounter;
};

export const amendEncounter = async (id, updates, reason, actor) => {
  const encounter = await findEncounterOrThrow(id);

  if (encounter.status !== 'FINALIZED') {
    throw new AppError('Only a finalized encounter can be amended — use the regular update endpoint instead.', 409, {
      code: 'ENCOUNTER_NOT_FINALIZED',
    });
  }

  const previousSnapshot = snapshotClinicalFields(encounter);

  const editableFields = CLINICAL_FIELDS;
  Object.keys(updates).forEach((key) => {
    if (!editableFields.includes(key)) delete updates[key];
  });

  encounter.amendments.push({
    amendedBy: actor._id,
    reason,
    previousSnapshot,
  });
  Object.assign(encounter, updates, { updatedBy: actor._id });
  await encounter.save();

  logger.info(
    {
      event: 'encounter_amended',
      encounterId: encounter._id.toString(),
      amendedBy: String(actor._id),
      reason,
    },
    'Finalized clinical encounter amended.',
  );

  return encounter;
};
