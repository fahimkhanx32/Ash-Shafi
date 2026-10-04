import mongoose from 'mongoose';

import {
  Investigation,
  INVESTIGATION_STATUSES,
  isSensitiveInvestigationCategory,
} from '../models/investigation.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import {
  enforceSensitiveRecordAccess,
  logSensitiveRecordAccess,
} from '../../gynecology/services/sensitive-record-access.service.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Fixed, non-terminal → terminal/next transitions. Enforced here
 * (service layer), not on the model — same convention as
 * `appointment.service.js`/`encounter.service.js`.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  ORDERED: ['SCHEDULED', 'SAMPLE_COLLECTED', 'RESULT_PENDING', 'CANCELLED', 'REJECTED'],
  SCHEDULED: ['SAMPLE_COLLECTED', 'RESULT_PENDING', 'CANCELLED', 'REJECTED'],
  SAMPLE_COLLECTED: ['RESULT_PENDING', 'CANCELLED', 'REJECTED'],
  RESULT_PENDING: ['COMPLETED', 'CANCELLED', 'REJECTED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
});

const pushHistory = (investigation, { action, toStatus, actor, reason = '' }) => {
  investigation.history.push({
    action,
    fromStatus: investigation.status,
    toStatus,
    actor: actor?._id ?? null,
    reason,
  });
};

const generateInvestigationReference = async () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const prefix = `INV-${y}${m}${d}`;

  const latest = await Investigation.findOne({ investigationReference: { $regex: `^${prefix}-` } })
    .sort({ investigationReference: -1 })
    .select('investigationReference')
    .lean();

  let nextSequence = 1;
  if (latest?.investigationReference) {
    const match = latest.investigationReference.match(/-(\d{4})$/);
    if (match) nextSequence = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
};

export const findPatientProfileOrThrow = async (patientProfileId) => {
  if (!isValidObjectId(patientProfileId)) {
    throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
  }

  const patientProfile = await PatientProfile.findById(patientProfileId);

  if (!patientProfile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PATIENT_PROFILE_NOT_FOUND' });
  }

  return patientProfile;
};

export const findInvestigationOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid investigation id.', 400, { code: 'INVALID_ID' });
  }

  const investigation = await Investigation.findById(id).populate(
    'patientProfile',
    'user primaryCareProvider patientId firstName lastName',
  );

  if (!investigation) {
    throw new AppError('Investigation not found.', 404, { code: 'INVESTIGATION_NOT_FOUND' });
  }

  return investigation;
};

/**
 * Sensitive-category investigations (master prompt §16/§BET-12.23) get
 * the same provider-tier gate `GynecologyRecord` uses, reusing BET-07's
 * choke point rather than forking a parallel implementation (same
 * reuse decision BET-08 documented for `PregnancyRecord`). Non-sensitive
 * investigations only need the plain `INVESTIGATIONS_READ`/`WRITE`
 * permission already checked at the route layer — no extra service-layer
 * gate, matching how ordinary `MEDICAL_RECORDS_*` data behaves.
 */
const enforceInvestigationAccess = async ({ actor, investigation, write, action, requestMeta }) => {
  if (!investigation.isSensitive) {
    return;
  }

  const patientProfile = investigation.patientProfile;

  if (actor?.role === ROLES.DOCTOR && !write) {
    // Any doctor may READ any investigation (product decision 2026-10);
    // still audited. Writes keep the assigned-provider rule below.
    await logSensitiveRecordAccess({
      actor,
      patientProfile,
      action,
      resource: 'investigation',
      outcome: 'ALLOWED',
      denialReason: null,
      ...requestMeta,
    });
    return;
  }

  await enforceSensitiveRecordAccess({
    actor,
    patientProfile,
    write,
    action,
    resource: 'investigation',
    requestMeta,
  });
};

/**
 * A `PATIENT` actor may only ever see their own investigations — the
 * client-provided `patientProfileId` is never trusted for that role
 * (master prompt §80), same pattern `appointment.service.js` uses.
 */
const assertCanAccessAsSelf = (investigation, actor) => {
  if (actor.role !== ROLES.PATIENT) {
    return true;
  }

  const ownerId = investigation.patient?._id ?? investigation.patient;
  return ownerId && String(ownerId) === String(actor._id);
};

export const orderInvestigation = async (
  { patientProfileId, category, name, priority, clinicalIndication, clinicalNotes, encounterId, appointmentId, scheduledDate },
  actor,
  requestMeta = {},
) => {
  const patientProfile = await findPatientProfileOrThrow(patientProfileId);

  if (encounterId && !isValidObjectId(encounterId)) {
    throw new AppError('Invalid encounter id.', 400, { code: 'INVALID_ID' });
  }
  if (appointmentId && !isValidObjectId(appointmentId)) {
    throw new AppError('Invalid appointment id.', 400, { code: 'INVALID_ID' });
  }

  const isSensitive = isSensitiveInvestigationCategory(category);

  if (isSensitive) {
    await enforceSensitiveRecordAccess({
      actor,
      patientProfile,
      write: true,
      action: 'CREATE',
      resource: 'investigation',
      requestMeta,
    });
  }

  const investigationReference = await generateInvestigationReference();

  const investigation = new Investigation({
    investigationReference,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    orderedBy: actor._id,
    encounter: encounterId || null,
    appointment: appointmentId || null,
    category,
    name,
    isSensitive,
    priority: priority || 'ROUTINE',
    clinicalIndication: clinicalIndication || '',
    clinicalNotes: clinicalNotes || '',
    scheduledDate: scheduledDate || null,
    status: 'ORDERED',
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  pushHistory(investigation, { action: 'ORDERED', toStatus: 'ORDERED', actor });

  await investigation.save();

  logger.info(
    { investigationId: investigation._id, patientProfileId, category, isSensitive },
    'Investigation ordered.',
  );

  return investigation;
};

const transitionStatus = async (id, toStatus, { action, reason }, actor, requestMeta = {}) => {
  const investigation = await findInvestigationOrThrow(id);

  if (!assertCanAccessAsSelf(investigation, actor)) {
    throw new AppError('Investigation not found.', 404, { code: 'INVESTIGATION_NOT_FOUND' });
  }

  await enforceInvestigationAccess({
    actor,
    investigation,
    write: true,
    action,
    requestMeta,
  });

  const allowed = ALLOWED_TRANSITIONS[investigation.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new AppError(
      `Cannot move investigation from ${investigation.status} to ${toStatus}.`,
      409,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  pushHistory(investigation, { action, toStatus, actor, reason });
  investigation.status = toStatus;
  investigation.updatedBy = actor._id;

  if (toStatus === 'CANCELLED' || toStatus === 'REJECTED') {
    investigation.cancellationReason = reason || '';
    investigation.cancelledBy = actor._id;
    investigation.cancelledAt = new Date();
  }

  await investigation.save();

  return investigation;
};

export const scheduleInvestigation = (id, { scheduledDate, reason }, actor, requestMeta) => {
  return transitionStatus(id, 'SCHEDULED', { action: 'SCHEDULE', reason }, actor, requestMeta).then(
    async (investigation) => {
      investigation.scheduledDate = scheduledDate ? new Date(scheduledDate) : investigation.scheduledDate;
      await investigation.save();
      return investigation;
    },
  );
};

export const markSampleCollected = (id, { reason } = {}, actor, requestMeta) =>
  transitionStatus(id, 'SAMPLE_COLLECTED', { action: 'SAMPLE_COLLECTED', reason }, actor, requestMeta).then(
    async (investigation) => {
      investigation.performedDate = investigation.performedDate || new Date();
      await investigation.save();
      return investigation;
    },
  );

export const markResultPending = (id, { reason } = {}, actor, requestMeta) =>
  transitionStatus(id, 'RESULT_PENDING', { action: 'RESULT_PENDING', reason }, actor, requestMeta);

export const cancelInvestigation = (id, { reason }, actor, requestMeta) =>
  transitionStatus(id, 'CANCELLED', { action: 'CANCEL', reason }, actor, requestMeta);

export const rejectInvestigation = (id, { reason }, actor, requestMeta) =>
  transitionStatus(id, 'REJECTED', { action: 'REJECT', reason }, actor, requestMeta);

/**
 * One-way callback for `modules/reports` to call once a linked
 * report reaches `FINALIZED` — never called from within this module.
 * Same cross-module boundary shape as `modules/queue`'s calls into
 * `appointment.service.js` (BET-10). Does not throw on an
 * already-`COMPLETED`/terminal investigation — finalizing a second
 * report against an already-completed investigation is legitimate
 * (master prompt §BET-12.3: multiple reports over time) and must not
 * fail the report-finalization request.
 */
export const markInvestigationCompletedFromReport = async (investigationId, report, actor) => {
  if (!isValidObjectId(investigationId)) {
    return null;
  }

  const investigation = await Investigation.findById(investigationId);
  if (!investigation) {
    return null;
  }

  if (investigation.status === 'COMPLETED') {
    investigation.primaryReport = report._id;
    await investigation.save();
    return investigation;
  }

  const allowed = ALLOWED_TRANSITIONS[investigation.status] || [];
  if (allowed.includes('COMPLETED')) {
    pushHistory(investigation, {
      action: 'REPORT_FINALIZED',
      toStatus: 'COMPLETED',
      actor,
      reason: `Completed via report ${report._id}`,
    });
    investigation.status = 'COMPLETED';
    investigation.completedAt = new Date();
  }

  investigation.primaryReport = report._id;
  await investigation.save();
  return investigation;
};

export const getInvestigationById = async (id, actor, requestMeta = {}) => {
  const investigation = await findInvestigationOrThrow(id);

  if (!assertCanAccessAsSelf(investigation, actor)) {
    throw new AppError('Investigation not found.', 404, { code: 'INVESTIGATION_NOT_FOUND' });
  }

  await enforceInvestigationAccess({
    actor,
    investigation,
    write: false,
    action: 'VIEW',
    requestMeta,
  });

  return investigation;
};

export const getMyInvestigations = async (actor, { page = 1, limit = 20 } = {}) => {
  const patientProfile = await PatientProfile.findOne({ user: actor._id });
  if (!patientProfile) {
    return { items: [], page, limit, total: 0 };
  }

  const filter = { patientProfile: patientProfile._id };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Investigation.find(filter).sort({ orderedDate: -1 }).skip(skip).limit(limit),
    Investigation.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

/**
 * Staff/doctor listing — server-side pagination + filtering
 * (master prompt §64/§BET-12.30). Sensitive-category results are
 * included only if the actor holds `SENSITIVE_RECORDS_READ` (or is
 * admin-tier) — filtered out entirely rather than returned then
 * blocked one-by-one, so the list/pagination counts stay honest.
 */
export const listInvestigations = async (
  { patientProfileId, doctorId, category, status, search, page = 1, limit = 20 },
  actor,
) => {
  const filter = {};

  if (patientProfileId) {
    if (!isValidObjectId(patientProfileId)) {
      throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
    }
    filter.patientProfile = patientProfileId;
  }

  if (doctorId) {
    if (!isValidObjectId(doctorId)) {
      throw new AppError('Invalid doctor id.', 400, { code: 'INVALID_ID' });
    }
    filter.orderedBy = doctorId;
  }

  if (category) filter.category = category;
  if (status) filter.status = status;

  // BET-12.29 free-text search by investigation name — `reports` already
  // has this; `investigations` didn't. Kept to the `name` field only
  // (there's no equivalent of a report's filename/facility to also match
  // against).
  let searchClause = null;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    searchClause = { name: { $regex: escaped, $options: 'i' } };
  }

  const isAdmin = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR].includes(actor.role);

  let sensitivityOrClause = null;
  if (actor.role === ROLES.DOCTOR) {
    // Doctors list everything (product decision 2026-10); no sensitivity filter.
    sensitivityOrClause = null;
  } else if (!isAdmin) {
    filter.isSensitive = { $ne: true };
  }

  // Combine the search clause and the doctor sensitivity clause via `$and`
  // rather than letting either overwrite `filter.$or` outright — same
  // reasoning as `reports/services/report.service.js`'s `listReports`.
  if (searchClause && sensitivityOrClause) {
    filter.$and = [searchClause, sensitivityOrClause];
  } else if (sensitivityOrClause) {
    Object.assign(filter, sensitivityOrClause);
  } else if (searchClause) {
    Object.assign(filter, searchClause);
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Investigation.find(filter).sort({ orderedDate: -1 }).skip(skip).limit(limit),
    Investigation.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

export { INVESTIGATION_STATUSES };
