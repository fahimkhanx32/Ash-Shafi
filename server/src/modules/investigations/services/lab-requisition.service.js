import mongoose from 'mongoose';

import { LabRequisition } from '../models/lab-requisition.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { StaffProfile } from '../../staff/models/staff-profile.model.js';
import { User } from '../../../users/user.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { hashPassword } from '../../../security/password.js';
import { logger } from '../../../config/logger.js';
import { ROLES } from '../../../security/permissions.js';
import { TEST_BY_CODE } from '../models/test-catalog.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Reference generator ──────────────────────────────────────────────────────

const generateRequisitionReference = async () => {
  const now = new Date();
  const y  = now.getUTCFullYear();
  const m  = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(now.getUTCDate()).padStart(2, '0');
  const prefix = `REQ-${y}${m}${d}`;

  const latest = await LabRequisition.findOne({ requisitionReference: { $regex: `^${prefix}-` } })
    .sort({ requisitionReference: -1 })
    .select('requisitionReference')
    .lean();

  let nextSeq = 1;
  if (latest?.requisitionReference) {
    const match = latest.requisitionReference.match(/-(\d{4})$/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
};

// ── Snapshot builders (mirrors prescription.service.js) ─────────────────────

const DEFAULT_DOCTOR = {
  name:           'Dr. Rezwanur Rahman',
  qualifications: 'MBBS, MD (Nephrology), FRCP (Edin)',
  bmdc:           '',
  chamberAddress: 'Popular Consultation Centre (Bldg-6), Room 306, Dhanmondi, Dhaka',
  phone:          '01722913036',
  email:          'kidneydial@gmail.com',
};

const buildDoctorSnapshot = async (actorId) => {
  if (!actorId) return DEFAULT_DOCTOR;
  const [staff, user] = await Promise.all([
    StaffProfile.findOne({ user: actorId }).lean(),
    User.findById(actorId).lean(),
  ]);
  if (!staff && !user) return DEFAULT_DOCTOR;
  const dd = staff?.doctorDetails || {};
  return {
    name:           user?.name || DEFAULT_DOCTOR.name,
    qualifications: dd.qualifications?.join(', ') || DEFAULT_DOCTOR.qualifications,
    bmdc:           dd.registrationNumber || '',
    chamberAddress: DEFAULT_DOCTOR.chamberAddress,
    phone:          staff?.phone || DEFAULT_DOCTOR.phone,
    email:          user?.email  || DEFAULT_DOCTOR.email,
  };
};

const buildPatientSnapshot = (profile) => {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—';
  let age = '—';
  if (profile.dateOfBirth) {
    const dob   = new Date(profile.dateOfBirth);
    const today = new Date();
    let yrs = today.getFullYear() - dob.getFullYear();
    let mos = today.getMonth() - dob.getMonth();
    if (mos < 0 || (mos === 0 && today.getDate() < dob.getDate())) { yrs--; mos = (mos + 12) % 12; }
    age = `${yrs} Y ${mos >= 0 ? `${mos} M` : ''}`.trim();
  }
  return {
    name,
    patientId:  profile.patientId || '—',
    age,
    sex:        profile.gender || '—',
    phone:      profile.phone  || profile.alternatePhone || '—',
    bloodGroup: profile.bloodGroup || '—',
    address:    profile.address
      ? `${profile.address.street || ''} ${profile.address.city || ''}`.trim()
      : '',
  };
};

// ── Walk-in patient auto-creation (same as patient.service.js) ──────────────

const ensureWalkInPatientProfile = async (walkIn, actor) => {
  const genUsername = `pat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const genEmail    = `${genUsername}@ashshafi.local`;
  const genName     = `${walkIn.firstName || 'Walk-in'} ${walkIn.lastName || 'Patient'}`.trim();
  const genPassword = `Pat#${Math.random().toString(36).slice(2, 10)}!`;
  const passwordHash = await hashPassword(genPassword);

  const newUser = await User.create({
    name: genName, username: genUsername, email: genEmail,
    passwordHash, role: ROLES.PATIENT, isEmailVerified: true,
  });

  // Generate sequential patient ID
  const now    = new Date();
  const prefix = `PAT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const latest = await PatientProfile.findOne({ patientId: { $regex: `^${prefix}-` } })
    .sort({ patientId: -1 }).select('patientId').lean();
  let seq = 1;
  if (latest?.patientId) {
    const m = latest.patientId.match(/-(\d{4})$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  const patientId = `${prefix}-${String(seq).padStart(4, '0')}`;

  const profile = await PatientProfile.create({
    user:      newUser._id,
    patientId,
    firstName: walkIn.firstName || 'Walk-in',
    lastName:  walkIn.lastName  || 'Patient',
    gender:    walkIn.sex       || undefined,
    phone:     walkIn.phone     || undefined,
    bloodGroup: walkIn.bloodGroup || undefined,
    isWalkIn:  true,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  logger.info({ event: 'walkin_patient_created_for_requisition', patientId }, 'Walk-in patient profile created for lab requisition.');
  return profile;
};

// ── findOrThrow ──────────────────────────────────────────────────────────────

const findRequisitionOrThrow = async (id) => {
  if (!isValidObjectId(id)) throw new AppError('Invalid requisition id.', 400, { code: 'INVALID_ID' });
  const req = await LabRequisition.findById(id).lean();
  if (!req) throw new AppError('Lab requisition not found.', 404, { code: 'REQUISITION_NOT_FOUND' });
  return req;
};

// ── Public service functions ─────────────────────────────────────────────────

/**
 * Create a new lab requisition (DRAFT).
 * Accepts either patientProfileId (registered) or walkIn data (unregistered).
 */
export const createRequisition = async (body, actor) => {
  const { patientProfileId, walkIn, tests, clinicalDiagnosis, priority, notes, admissionDetails, encounterId, prescriptionId } = body;

  let patientProfile;

  if (patientProfileId) {
    if (!isValidObjectId(patientProfileId)) {
      throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
    }
    patientProfile = await PatientProfile.findById(patientProfileId);
    if (!patientProfile) {
      throw new AppError('Patient profile not found.', 404, { code: 'PATIENT_PROFILE_NOT_FOUND' });
    }
  } else if (walkIn) {
    patientProfile = await ensureWalkInPatientProfile(walkIn, actor);
  } else {
    throw new AppError('Either patientProfileId or walkIn data is required.', 400, { code: 'MISSING_PATIENT' });
  }

  // Resolve tests — enrich with catalog costBDT if not supplied
  const enrichedTests = tests.map((t) => {
    const catalogEntry = TEST_BY_CODE[t.code] || {};
    return {
      code:     t.code,
      name:     t.name     || catalogEntry.name     || t.code,
      category: t.category || catalogEntry.category || 'OTHER',
      costBDT:  typeof t.costBDT === 'number' ? t.costBDT : (catalogEntry.costBDT ?? 0),
      notes:    t.notes || '',
    };
  });

  const totalCostBDT = enrichedTests.reduce((sum, t) => sum + (t.costBDT || 0), 0);

  const [requisitionReference, doctorSnapshot] = await Promise.all([
    generateRequisitionReference(),
    buildDoctorSnapshot(actor._id),
  ]);

  const patientSnapshot = buildPatientSnapshot(patientProfile);
  // Walk-in patients have no dateOfBirth to derive age from — honor the
  // free-text age the doctor actually typed rather than always showing "—".
  if (walkIn?.age) patientSnapshot.age = walkIn.age;

  const req = new LabRequisition({
    requisitionReference,
    patientProfile:    patientProfile._id,
    patient:           patientProfile.user,
    orderedBy:         actor._id,
    encounter:         (encounterId   && isValidObjectId(encounterId))   ? encounterId   : null,
    prescription:      (prescriptionId && isValidObjectId(prescriptionId)) ? prescriptionId : null,
    tests:             enrichedTests,
    clinicalDiagnosis: clinicalDiagnosis || '',
    priority:          priority || 'ROUTINE',
    notes:             notes    || '',
    admissionDetails:  admissionDetails || undefined,
    totalCostBDT,
    status:            'DRAFT',
    patientSnapshot,
    doctorSnapshot,
    createdBy:         actor._id,
    updatedBy:         actor._id,
  });

  await req.save();
  return req.toObject();
};

/**
 * Update a DRAFT requisition's editable content — tests, diagnosis,
 * priority, notes, admission-logistics blanks, and (for walk-in
 * patients only) the demographic fields typed on the document itself.
 *
 * This did not exist before: the workspace could create a requisition
 * but had no way to persist further edits to an already-created DRAFT,
 * so ticking boxes or typing on the document after the first save
 * silently updated only local UI state and was discarded — the root
 * cause of "checkboxes/fields aren't working" once a requisition had
 * already been saved once.
 *
 * Deliberately never touches patientProfile/patient/orderedBy/
 * requisitionReference, and never re-runs `ensureWalkInPatientProfile`
 * (that helper is create-only — calling it again here would spawn a
 * second, duplicate walk-in patient account for the same person).
 * Walk-in demographic edits instead patch the SAME already-linked
 * PatientProfile in place.
 */
export const updateRequisition = async (id, body, actor) => {
  const req = await LabRequisition.findById(id);
  if (!req) throw new AppError('Lab requisition not found.', 404, { code: 'REQUISITION_NOT_FOUND' });
  if (req.status !== 'DRAFT') {
    throw new AppError(`Cannot edit a requisition with status ${req.status}.`, 400, { code: 'INVALID_STATUS' });
  }

  const { tests, clinicalDiagnosis, priority, notes, admissionDetails, walkIn } = body;

  if (Array.isArray(tests)) {
    if (tests.length === 0) {
      throw new AppError('At least one test must be selected.', 400, { code: 'NO_TESTS' });
    }
    const enrichedTests = tests.map((t) => {
      const catalogEntry = TEST_BY_CODE[t.code] || {};
      return {
        code:     t.code,
        name:     t.name     || catalogEntry.name     || t.code,
        category: t.category || catalogEntry.category || 'OTHER',
        costBDT:  typeof t.costBDT === 'number' ? t.costBDT : (catalogEntry.costBDT ?? 0),
        notes:    t.notes || '',
      };
    });
    req.tests = enrichedTests;
    req.totalCostBDT = enrichedTests.reduce((sum, t) => sum + (t.costBDT || 0), 0);
  }

  if (clinicalDiagnosis !== undefined) req.clinicalDiagnosis = clinicalDiagnosis;
  if (priority !== undefined) req.priority = priority;
  if (notes !== undefined) req.notes = notes;
  if (admissionDetails !== undefined) {
    req.admissionDetails = {
      ...(req.admissionDetails ? req.admissionDetails.toObject() : {}),
      ...admissionDetails,
    };
  }

  if (walkIn) {
    const profile = await PatientProfile.findById(req.patientProfile);
    if (profile) {
      if (walkIn.firstName) profile.firstName = walkIn.firstName;
      if (walkIn.lastName !== undefined) profile.lastName = walkIn.lastName;
      if (walkIn.sex) profile.gender = walkIn.sex;
      if (walkIn.phone !== undefined) profile.phone = walkIn.phone;
      if (walkIn.bloodGroup) profile.bloodGroup = walkIn.bloodGroup;
      profile.updatedBy = actor._id;
      await profile.save();

      req.patientSnapshot = buildPatientSnapshot(profile);
      // Same free-text-age override as createRequisition — walk-ins
      // have no dateOfBirth for buildPatientSnapshot to compute from.
      if (walkIn.age) req.patientSnapshot.age = walkIn.age;
    }
  }

  req.updatedBy = actor._id;
  await req.save();
  return req.toObject();
};

/**
 * Issue (finalize) a DRAFT requisition.
 */
export const issueRequisition = async (id, actor) => {
  const req = await LabRequisition.findById(id);
  if (!req) throw new AppError('Lab requisition not found.', 404, { code: 'REQUISITION_NOT_FOUND' });
  if (req.status !== 'DRAFT') {
    throw new AppError(`Cannot issue a requisition with status ${req.status}.`, 400, { code: 'INVALID_STATUS' });
  }
  req.status   = 'ISSUED';
  req.issuedAt = new Date();
  req.updatedBy = actor._id;
  await req.save();
  return req.toObject();
};

/**
 * Cancel a DRAFT or ISSUED requisition.
 */
export const cancelRequisition = async (id, reason, actor) => {
  const req = await LabRequisition.findById(id);
  if (!req) throw new AppError('Lab requisition not found.', 404, { code: 'REQUISITION_NOT_FOUND' });
  if (req.status === 'CANCELLED') {
    throw new AppError('Requisition is already cancelled.', 400, { code: 'ALREADY_CANCELLED' });
  }
  req.status             = 'CANCELLED';
  req.cancellationReason = reason || '';
  req.cancelledAt        = new Date();
  req.cancelledBy        = actor._id;
  req.updatedBy          = actor._id;
  await req.save();
  return req.toObject();
};

/**
 * Get a single requisition by ID.
 * Patients can only see their own.
 */
export const getRequisitionById = async (id, actor) => {
  const req = await findRequisitionOrThrow(id);
  if (actor.role === ROLES.PATIENT && String(req.patient) !== String(actor._id)) {
    throw new AppError('Lab requisition not found.', 404, { code: 'REQUISITION_NOT_FOUND' });
  }
  return req;
};

/**
 * List requisitions for staff (INVESTIGATIONS_READ).
 */
export const listRequisitions = async (query) => {
  const { patientProfileId, doctorId, status, search, page = 1, limit = 20 } = query;
  const filter = {};
  if (patientProfileId && isValidObjectId(patientProfileId)) filter.patientProfile = patientProfileId;
  if (doctorId         && isValidObjectId(doctorId))         filter.orderedBy      = doctorId;
  if (status)                                                 filter.status         = status;
  if (search) {
    filter.$or = [
      { 'patientSnapshot.name':           { $regex: search, $options: 'i' } },
      { 'patientSnapshot.patientId':      { $regex: search, $options: 'i' } },
      { requisitionReference:             { $regex: search, $options: 'i' } },
      { clinicalDiagnosis:                { $regex: search, $options: 'i' } },
    ];
  }

  const skip  = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LabRequisition.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    LabRequisition.countDocuments(filter),
  ]);

  return { items, page: Number(page), limit: Number(limit), total };
};

/**
 * Get a patient's own requisitions (patient self-access).
 */
export const getMyRequisitions = async (actor, query) => {
  const { page = 1, limit = 20 } = query;
  const filter = { patient: actor._id };
  const skip   = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LabRequisition.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    LabRequisition.countDocuments(filter),
  ]);
  return { items, page: Number(page), limit: Number(limit), total };
};
