import crypto from 'crypto';
import mongoose from 'mongoose';

import { Prescription } from '../models/prescription.model.js';
import { PrescriptionFavorite } from '../models/prescription-favorite.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { StaffProfile } from '../../staff/models/staff-profile.model.js';
import { User } from '../../../users/user.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { ROLES } from '../../../security/permissions.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Generates a sequential prescription ID: RX-YYYY-XXXXXX
 */
const generatePrescriptionId = async () => {
  const year = new Date().getFullYear();
  const count = await Prescription.countDocuments({
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1),
    },
  });
  const seq = String(count + 1).padStart(6, '0');
  return `RX-${year}-${seq}`;
};

/**
 * Generates a secure random verification token for QR code lookups.
 */
const generateVerificationToken = () => crypto.randomBytes(16).toString('hex');

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

const findPrescriptionOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid prescription id.', 400, { code: 'INVALID_ID' });
  }
  const prescription = await Prescription.findById(id);
  if (!prescription) {
    throw new AppError('Prescription not found.', 404, { code: 'PRESCRIPTION_NOT_FOUND' });
  }
  return prescription;
};

const assertCanAccessPrescription = (prescription, actor) => {
  if (actor?.role === 'PATIENT' && String(prescription.patient) !== String(actor._id)) {
    throw new AppError('Prescription not found.', 404, { code: 'PRESCRIPTION_NOT_FOUND' });
  }
};

/**
 * Builds patient demographic snapshot at prescribing time.
 */
const buildPatientSnapshot = async (patientProfile, customSnapshot = {}) => {
  const fullName = [patientProfile.firstName, patientProfile.lastName].filter(Boolean).join(' ') || '—';

  let age = null;
  let ageFormatted = '—';
  if (patientProfile.dateOfBirth) {
    const dob = new Date(patientProfile.dateOfBirth);
    const today = new Date();
    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < dob.getDate())) {
      years--;
      months = (months + 12) % 12;
    }
    age = years;
    ageFormatted = `${years} Y ${months >= 0 ? `${months} M` : ''}`.trim();
  }

  // Count past visits/prescriptions
  const visitCount = await Prescription.countDocuments({
    patientProfile: patientProfile._id,
    status: { $in: ['FINALIZED', 'SUPERSEDED'] },
  });

  const lastPrescription = await Prescription.findOne({
    patientProfile: patientProfile._id,
    status: { $in: ['FINALIZED', 'SUPERSEDED'] },
  }).sort({ prescriptionDate: -1 });

  return {
    name: customSnapshot.name || fullName,
    patientId: customSnapshot.patientId || patientProfile.patientId || '—',
    age: customSnapshot.age ?? age,
    ageFormatted: customSnapshot.ageFormatted || ageFormatted,
    gender: customSnapshot.gender || patientProfile.gender || '—',
    bloodGroup: customSnapshot.bloodGroup || patientProfile.bloodGroup || 'Unknown',
    phone: customSnapshot.phone || patientProfile.phone || patientProfile.alternatePhone || '—',
    address: customSnapshot.address || (patientProfile.address ? `${patientProfile.address.street || ''} ${patientProfile.address.city || ''}`.trim() : ''),
    visitNumber: (customSnapshot.visitNumber ?? visitCount) + 1,
    lastVisitDate: customSnapshot.lastVisitDate || (lastPrescription ? lastPrescription.prescriptionDate : null),
    nextVisitDate: customSnapshot.nextVisitDate || null,
  };
};

/**
 * Builds doctor credentials and chamber snapshot at prescribing time.
 */
const buildDoctorSnapshot = async (providerId, customSnapshot = {}) => {
  const defaultHeader = {
    name: 'Dr. Rezwanur Rahman',
    nameBangla: 'প্রফেসর ডা. রেজওয়ানুর রহমান',
    degreesEnglish: 'MBBS, MD (Nephrology), FRCP (Edin)',
    degreesBangla: 'এমবিবিএস, এমডি (নেফ্রোলজি), এফআরসিপি (এডিন)',
    designationEnglish: 'Professor & Head',
    designationBangla: 'অধ্যাপক ও বিভাগীয় প্রধান',
    departmentEnglish: 'Department of Nephrology',
    departmentBangla: 'কিডনী রোগ ও ডায়ালাইসিস বিভাগ',
    hospitalEnglish: 'Bangladesh Medical College Hospital, Dhaka',
    hospitalBangla: 'বাংলাদেশ মেডিকেল কলেজ হাসপাতাল, ঢাকা',
    specialtyEnglish: 'Kidney Disease and Transplant Specialist',
    specialtyBangla: 'কিডনী রোগ ও কিডনি প্রতিস্থাপন বিশেষজ্ঞ',
    chamberInfo: 'চেম্বার : পপুলার কনসালটেশন সেন্টার (ভবন-৬), রুম নং-৩০৬ (লেভেল-৩), বাড়ী-২, রোড-২, ধানমন্ডি, ঢাকা | রোগী দেখার সময় : শনি থেকে বৃহস্পতিবার বিকাল ৪টা থেকে রাত ১০টা, শুক্রবার বন্ধ E-mail : kidneydial@gmail.com',
    visitingHours: 'শনি থেকে বৃহস্পতিবার বিকাল ৪টা থেকে রাত ১০টা, শুক্রবার বন্ধ',
    email: 'kidneydial@gmail.com',
    phone: '০১৭২২৯১৩০৩৬, ০১৬৬৬ ৭৮৭৮০১',
  };

  if (!providerId) return { ...defaultHeader, ...customSnapshot };

  const [staff, user] = await Promise.all([
    StaffProfile.findOne({ user: providerId }),
    User.findById(providerId),
  ]);

  if (!staff && !user) return { ...defaultHeader, ...customSnapshot };

  const doctorDetails = staff?.doctorDetails || {};

  return {
    name: customSnapshot.name || user?.name || defaultHeader.name,
    nameBangla: customSnapshot.nameBangla || doctorDetails.nameBangla || defaultHeader.nameBangla,
    degreesEnglish: customSnapshot.degreesEnglish || doctorDetails.qualifications?.join(', ') || defaultHeader.degreesEnglish,
    degreesBangla: customSnapshot.degreesBangla || doctorDetails.degreesBangla || defaultHeader.degreesBangla,
    designationEnglish: customSnapshot.designationEnglish || staff?.designation || defaultHeader.designationEnglish,
    designationBangla: customSnapshot.designationBangla || doctorDetails.designationBangla || defaultHeader.designationBangla,
    departmentEnglish: customSnapshot.departmentEnglish || staff?.department || defaultHeader.departmentEnglish,
    departmentBangla: customSnapshot.departmentBangla || doctorDetails.departmentBangla || defaultHeader.departmentBangla,
    hospitalEnglish: customSnapshot.hospitalEnglish || defaultHeader.hospitalEnglish,
    hospitalBangla: customSnapshot.hospitalBangla || defaultHeader.hospitalBangla,
    specialtyEnglish: customSnapshot.specialtyEnglish || doctorDetails.specialization || defaultHeader.specialtyEnglish,
    specialtyBangla: customSnapshot.specialtyBangla || doctorDetails.specialtyBangla || defaultHeader.specialtyBangla,
    registrationNumber: customSnapshot.registrationNumber || doctorDetails.registrationNumber || '',
    chamberInfo: customSnapshot.chamberInfo || defaultHeader.chamberInfo,
    visitingHours: customSnapshot.visitingHours || defaultHeader.visitingHours,
    email: customSnapshot.email || user?.email || defaultHeader.email,
    phone: customSnapshot.phone || staff?.phone || defaultHeader.phone,
    signatureUrl: customSnapshot.signatureUrl || '',
  };
};

/**
 * Normalizes medicine item serial numbers.
 */
const normalizeItemSerialNumbers = (items = []) =>
  items.map((item, index) => ({
    ...item,
    serialNumber: index + 1,
    displayOrder: index + 1,
  }));

export const createPrescription = async (patientProfileId, data, actor) => {
  const patientProfile = await findPatientProfileOrThrow(patientProfileId);

  const prescriptionId = await generatePrescriptionId();
  const verificationToken = generateVerificationToken();

  const patientSnapshot = await buildPatientSnapshot(patientProfile, data.patientSnapshot);
  const doctorSnapshot = await buildDoctorSnapshot(actor._id, data.doctorSnapshot);

  const items = normalizeItemSerialNumbers(data.items || []);

  const prescription = await Prescription.create({
    ...data,
    prescriptionId,
    verificationToken,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    provider: actor._id,
    delegatedStaff: actor.role !== 'DOCTOR' ? actor._id : null,
    prescriptionGroupId: new mongoose.Types.ObjectId(),
    items,
    patientSnapshot,
    doctorSnapshot,
    createdBy: actor._id,
    auditLog: [
      {
        action: 'DRAFT_CREATED',
        performedBy: actor._id,
        performedByName: actor.name || 'Staff',
        performedByRole: actor.role || 'DOCTOR',
        performedAt: new Date(),
        reason: 'Initial prescription draft created.',
      },
    ],
  });

  logger.info(
    {
      event: 'prescription_created',
      prescriptionId: prescription.prescriptionId,
      mongoId: prescription._id.toString(),
      patientProfileId: patientProfile._id.toString(),
      provider: String(actor._id),
    },
    'Prescription drafted.',
  );

  return prescription;
};

export const getPrescriptionById = async (id, actor) => {
  let query;
  if (isValidObjectId(id)) {
    query = { _id: id };
  } else {
    query = { prescriptionId: id.toUpperCase() };
  }

  const prescription = await Prescription.findOne(query)
    .populate('provider', 'name email role')
    .populate('delegatedStaff', 'name email role')
    .populate('patientProfile', 'patientId firstName lastName dateOfBirth gender phone bloodGroup');

  if (!prescription) {
    throw new AppError('Prescription not found.', 404, { code: 'PRESCRIPTION_NOT_FOUND' });
  }

  assertCanAccessPrescription(prescription, actor);
  return prescription;
};

export const listPrescriptions = async ({
  search,
  patientProfileId,
  providerId,
  status,
  fromDate,
  toDate,
  page = 1,
  limit = 20,
  sort = 'newest',
}) => {
  const query = {};

  if (patientProfileId && isValidObjectId(patientProfileId)) {
    query.patientProfile = patientProfileId;
  }
  if (providerId && isValidObjectId(providerId)) {
    query.provider = providerId;
  }
  if (status) {
    query.status = status;
  }
  if (fromDate || toDate) {
    query.prescriptionDate = {};
    if (fromDate) query.prescriptionDate.$gte = new Date(fromDate);
    if (toDate) query.prescriptionDate.$lte = new Date(toDate);
  }

  if (search && search.trim()) {
    const term = search.trim();
    query.$or = [
      { prescriptionId: new RegExp(term, 'i') },
      { 'patientSnapshot.name': new RegExp(term, 'i') },
      { 'patientSnapshot.patientId': new RegExp(term, 'i') },
      { 'patientSnapshot.phone': new RegExp(term, 'i') },
      { chiefComplaint: new RegExp(term, 'i') },
      { diagnosisSummary: new RegExp(term, 'i') },
      { 'items.brandName': new RegExp(term, 'i') },
      { 'items.genericName': new RegExp(term, 'i') },
    ];
  }

  const sortOption =
    sort === 'oldest' || sort === 'date_asc' ? { prescriptionDate: 1 } : { prescriptionDate: -1 };

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Prescription.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('provider', 'name email role')
      .populate('patientProfile', 'patientId firstName lastName dateOfBirth gender phone')
      .lean(),
    Prescription.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const listPrescriptionsByPatientProfileId = async (patientProfileId) => {
  await findPatientProfileOrThrow(patientProfileId);
  return Prescription.find({ patientProfile: patientProfileId })
    .sort({ prescriptionDate: -1 })
    .populate('provider', 'name email role')
    .populate('delegatedStaff', 'name email role')
    .lean();
};

export const getMyPrescriptions = async (actor) =>
  Prescription.find({ patient: actor._id, status: { $nin: ['DRAFT', 'CANCELLED'] } })
    .sort({ prescriptionDate: -1 })
    .populate('provider', 'name email role')
    .lean();

export const getPrescriptionVersionHistory = async (id, actor) => {
  const prescription = await findPrescriptionOrThrow(id);
  assertCanAccessPrescription(prescription, actor);

  const query = { prescriptionGroupId: prescription.prescriptionGroupId };
  if (actor?.role === 'PATIENT') {
    query.status = { $nin: ['DRAFT', 'CANCELLED'] };
  }

  return Prescription.find(query)
    .sort({ versionNumber: 1 })
    .populate('provider', 'name email role')
    .populate('delegatedStaff', 'name email role');
};

export const updatePrescription = async (id, updates, actor) => {
  const prescription = await findPrescriptionOrThrow(id);

  if (prescription.status !== 'DRAFT' && prescription.status !== 'PENDING_REVIEW') {
    throw new AppError(
      'Only draft or pending review prescriptions can be edited directly — use revise for finalized prescriptions.',
      409,
      { code: 'PRESCRIPTION_NOT_DRAFT' },
    );
  }

  const protectedFields = [
    '_id',
    'prescriptionId',
    'verificationToken',
    'patientProfile',
    'patient',
    'provider',
    'versionNumber',
    'previousVersion',
    'supersededBy',
    'supersededAt',
    'prescriptionGroupId',
    'finalizedAt',
    'finalizedBy',
    'createdBy',
  ];
  protectedFields.forEach((field) => delete updates[field]);

  if (updates.items) {
    updates.items = normalizeItemSerialNumbers(updates.items);
  }

  // Update blood group on patient profile if supplied
  if (updates.patientSnapshot?.bloodGroup && prescription.patientProfile) {
    await PatientProfile.findByIdAndUpdate(prescription.patientProfile, {
      bloodGroup: updates.patientSnapshot.bloodGroup,
    });
  }

  Object.assign(prescription, updates, { updatedBy: actor._id });

  prescription.auditLog.push({
    action: 'DRAFT_UPDATED',
    performedBy: actor._id,
    performedByName: actor.name || 'Staff',
    performedByRole: actor.role || 'DOCTOR',
    performedAt: new Date(),
    reason: 'Prescription draft updated.',
  });

  await prescription.save();

  logger.info(
    { event: 'prescription_updated', prescriptionId: prescription.prescriptionId, updatedBy: String(actor._id) },
    'Draft prescription updated.',
  );

  return prescription;
};

export const finalizePrescription = async (id, actor) => {
  const prescription = await findPrescriptionOrThrow(id);

  if (prescription.status === 'FINALIZED') {
    throw new AppError('This prescription has already been finalized.', 409, {
      code: 'PRESCRIPTION_ALREADY_FINALIZED',
    });
  }

  if (prescription.status === 'CANCELLED' || prescription.status === 'SUPERSEDED') {
    throw new AppError(`Cannot finalize a ${prescription.status.toLowerCase()} prescription.`, 409, {
      code: 'INVALID_PRESCRIPTION_STATUS',
    });
  }

  if (!prescription.prescriptionId) {
    prescription.prescriptionId = await generatePrescriptionId();
  }
  if (!prescription.verificationToken) {
    prescription.verificationToken = generateVerificationToken();
  }

  // Refresh snapshots before locking
  const patientProfile = await PatientProfile.findById(prescription.patientProfile);
  if (patientProfile) {
    prescription.patientSnapshot = await buildPatientSnapshot(patientProfile, prescription.patientSnapshot);
  }
  prescription.doctorSnapshot = await buildDoctorSnapshot(prescription.provider || actor._id, prescription.doctorSnapshot);

  prescription.status = 'FINALIZED';
  prescription.finalizedAt = new Date();
  prescription.finalizedBy = actor._id;
  prescription.updatedBy = actor._id;

  prescription.auditLog.push({
    action: 'FINALIZED',
    performedBy: actor._id,
    performedByName: actor.name || 'Doctor',
    performedByRole: actor.role || 'DOCTOR',
    performedAt: new Date(),
    reason: 'Prescription finalized and locked.',
  });

  await prescription.save();

  logger.info(
    { event: 'prescription_finalized', prescriptionId: prescription.prescriptionId, finalizedBy: String(actor._id) },
    'Prescription finalized.',
  );

  return prescription;
};

export const reviseFinalizedPrescription = async (id, updates, reason, actor) => {
  const original = await findPrescriptionOrThrow(id);

  if (original.status !== 'FINALIZED') {
    throw new AppError(
      'Only a finalized prescription can be revised — edit the draft directly instead.',
      409,
      { code: 'PRESCRIPTION_NOT_FINALIZED' },
    );
  }

  const newPrescriptionId = await generatePrescriptionId();
  const newVerificationToken = generateVerificationToken();

  const nextItems = updates.items ? normalizeItemSerialNumbers(updates.items) : original.items;

  const revision = await Prescription.create({
    prescriptionId: newPrescriptionId,
    verificationToken: newVerificationToken,
    patientProfile: original.patientProfile,
    patient: original.patient,
    provider: original.provider || actor._id,
    delegatedStaff: actor.role !== 'DOCTOR' ? actor._id : null,
    encounter: updates.encounter !== undefined ? updates.encounter : original.encounter,
    appointment: updates.appointment !== undefined ? updates.appointment : original.appointment,

    prescriptionDate: new Date(),
    status: 'FINALIZED',
    finalizedAt: new Date(),
    finalizedBy: actor._id,

    chiefComplaint: updates.chiefComplaint !== undefined ? updates.chiefComplaint : original.chiefComplaint,
    coMorbidities: updates.coMorbidities !== undefined ? updates.coMorbidities : original.coMorbidities,
    pastHistory: updates.pastHistory !== undefined ? updates.pastHistory : original.pastHistory,
    personalHistory: updates.personalHistory !== undefined ? updates.personalHistory : original.personalHistory,
    smokingHistory: updates.smokingHistory !== undefined ? updates.smokingHistory : original.smokingHistory,
    menstrualHistory: updates.menstrualHistory !== undefined ? updates.menstrualHistory : original.menstrualHistory,
    drugHistory: updates.drugHistory !== undefined ? updates.drugHistory : original.drugHistory,
    vitals: updates.vitals !== undefined ? updates.vitals : original.vitals,
    pathologyAndImaging: updates.pathologyAndImaging !== undefined ? updates.pathologyAndImaging : original.pathologyAndImaging,
    attachedReports: updates.attachedReports !== undefined ? updates.attachedReports : original.attachedReports,

    diagnoses: updates.diagnoses !== undefined ? updates.diagnoses : original.diagnoses,
    diagnosisSummary: updates.diagnosisSummary !== undefined ? updates.diagnosisSummary : original.diagnosisSummary,

    items: nextItems,
    investigations: updates.investigations !== undefined ? updates.investigations : original.investigations,
    labTests: updates.labTests !== undefined ? updates.labTests : original.labTests,

    advice: updates.advice !== undefined ? updates.advice : original.advice,
    generalInstructions: updates.generalInstructions !== undefined ? updates.generalInstructions : original.generalInstructions,
    investigationAdvice: updates.investigationAdvice !== undefined ? updates.investigationAdvice : original.investigationAdvice,
    testAdvices: updates.testAdvices !== undefined ? updates.testAdvices : original.testAdvices,

    nextFollowUp: updates.nextFollowUp !== undefined ? updates.nextFollowUp : original.nextFollowUp,
    followUpDate: updates.followUpDate !== undefined ? updates.followUpDate : original.followUpDate,

    doctorSnapshot: updates.doctorSnapshot || original.doctorSnapshot,
    patientSnapshot: updates.patientSnapshot || original.patientSnapshot,

    versionNumber: original.versionNumber + 1,
    previousVersion: original._id,
    prescriptionGroupId: original.prescriptionGroupId,
    createdBy: actor._id,
    auditLog: [
      {
        action: 'REVISED_FROM_VERSION',
        performedBy: actor._id,
        performedByName: actor.name || 'Doctor',
        performedByRole: actor.role || 'DOCTOR',
        performedAt: new Date(),
        reason: reason || 'Prescription revision created.',
        changes: { previousVersionId: original._id, versionNumber: original.versionNumber + 1 },
      },
    ],
  });

  original.status = 'SUPERSEDED';
  original.supersededBy = revision._id;
  original.supersededAt = new Date();
  original.updatedBy = actor._id;
  original.auditLog.push({
    action: 'SUPERSEDED_BY_REVISION',
    performedBy: actor._id,
    performedByName: actor.name || 'Doctor',
    performedByRole: actor.role || 'DOCTOR',
    performedAt: new Date(),
    reason: reason || 'Superseded by new revision.',
    changes: { newVersionId: revision._id, newVersionNumber: revision.versionNumber },
  });

  await original.save();

  logger.info(
    {
      event: 'prescription_revised',
      originalId: original._id.toString(),
      revisionId: revision._id.toString(),
      versionNumber: revision.versionNumber,
      revisedBy: String(actor._id),
      reason,
    },
    'Finalized prescription revised — new version created, original superseded.',
  );

  return revision;
};

/**
 * Clones a previous prescription into a brand new DRAFT for the patient.
 */
export const copyPreviousPrescription = async (prescriptionId, actor) => {
  const source = await findPrescriptionOrThrow(prescriptionId);
  const patientProfile = await findPatientProfileOrThrow(source.patientProfile);

  const newPrescriptionId = await generatePrescriptionId();
  const verificationToken = generateVerificationToken();

  const patientSnapshot = await buildPatientSnapshot(patientProfile);
  const doctorSnapshot = await buildDoctorSnapshot(actor._id);

  const copiedItems = (source.items || []).map((item, idx) => ({
    serialNumber: idx + 1,
    medicineRef: item.medicineRef,
    medicineType: item.medicineType || 'Tablet',
    brandName: item.brandName || '',
    genericName: item.genericName,
    strength: item.strength || '',
    strengthUnit: item.strengthUnit || '',
    dosage: item.dosage || item.frequency || '1 + 0 + 0',
    dosageForm: item.dosageForm || '',
    route: item.route || '',
    frequency: item.frequency || '1 + 0 + 0',
    consumptionTime: item.consumptionTime || '',
    foodInstruction: item.foodInstruction || 'খাবার পরে',
    timing: item.timing || '',
    durationValue: item.durationValue || '',
    durationUnit: item.durationUnit || 'Days',
    continuation: item.continuation || 'চলবে',
    specialInstruction: item.specialInstruction || '',
    instructions: item.instructions || '',
    notes: item.notes || '',
    displayOrder: idx + 1,
  }));

  const draft = await Prescription.create({
    prescriptionId: newPrescriptionId,
    verificationToken,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    provider: actor._id,
    delegatedStaff: actor.role !== 'DOCTOR' ? actor._id : null,
    status: 'DRAFT',
    prescriptionDate: new Date(),

    chiefComplaint: source.chiefComplaint || '',
    coMorbidities: source.coMorbidities || '',
    pastHistory: source.pastHistory || '',
    menstrualHistory: source.menstrualHistory || '',
    drugHistory: source.drugHistory || '',
    vitals: source.vitals || {},

    diagnoses: source.diagnoses || [],
    diagnosisSummary: source.diagnosisSummary || '',

    items: copiedItems,
    investigations: source.investigations || source.labTests || [],
    labTests: source.labTests || source.investigations || [],

    advice: source.advice || [],
    generalInstructions: source.generalInstructions || '',
    testAdvices: source.testAdvices || '',

    doctorSnapshot,
    patientSnapshot,

    versionNumber: 1,
    prescriptionGroupId: new mongoose.Types.ObjectId(),
    createdBy: actor._id,
    auditLog: [
      {
        action: 'COPIED_FROM_PREVIOUS',
        performedBy: actor._id,
        performedByName: actor.name || 'Staff',
        performedByRole: actor.role || 'DOCTOR',
        performedAt: new Date(),
        reason: `Copied from previous prescription ${source.prescriptionId || source._id}`,
      },
    ],
  });

  return draft;
};

export const cancelPrescription = async (id, reason, actor) => {
  const prescription = await findPrescriptionOrThrow(id);

  if (prescription.isCancelled) {
    throw new AppError('This prescription is already cancelled.', 409, { code: 'ALREADY_CANCELLED' });
  }

  prescription.isCancelled = true;
  prescription.status = 'CANCELLED';
  prescription.cancelledAt = new Date();
  prescription.cancelledBy = actor._id;
  prescription.cancelReason = reason || 'Cancelled by clinician.';
  prescription.updatedBy = actor._id;

  prescription.auditLog.push({
    action: 'CANCELLED',
    performedBy: actor._id,
    performedByName: actor.name || 'Staff',
    performedByRole: actor.role || 'DOCTOR',
    performedAt: new Date(),
    reason: reason || 'Prescription cancelled.',
  });

  await prescription.save();
  return prescription;
};

export const archivePrescription = async (id, reason, actor) => {
  const prescription = await findPrescriptionOrThrow(id);

  prescription.isArchived = true;
  prescription.status = 'ARCHIVED';
  prescription.archivedAt = new Date();
  prescription.archivedBy = actor._id;
  prescription.updatedBy = actor._id;

  prescription.auditLog.push({
    action: 'ARCHIVED',
    performedBy: actor._id,
    performedByName: actor.name || 'Staff',
    performedByRole: actor.role || 'DOCTOR',
    performedAt: new Date(),
    reason: reason || 'Prescription archived.',
  });

  await prescription.save();
  return prescription;
};

/**
 * Public/Authorized QR code verification lookup.
 * Returns non-sensitive verification status or full record for authorized actors.
 */
export const verifyPrescriptionByToken = async (token, actor = null) => {
  if (!token || !token.trim()) {
    throw new AppError('Verification token is required.', 400, { code: 'TOKEN_REQUIRED' });
  }

  const prescription = await Prescription.findOne({ verificationToken: token.trim() })
    .populate('provider', 'name email role')
    .populate('patientProfile', 'patientId firstName lastName dateOfBirth gender phone')
    .lean();

  if (!prescription) {
    throw new AppError('Invalid or expired verification token.', 404, { code: 'TOKEN_INVALID' });
  }

  // If unauthenticated or external scan, return safe verification payload without leaking full medical record
  if (!actor || actor.role === 'PATIENT' && String(prescription.patient) !== String(actor._id)) {
    return {
      verified: true,
      prescriptionId: prescription.prescriptionId,
      status: prescription.status,
      prescriptionDate: prescription.prescriptionDate,
      doctorName: prescription.doctorSnapshot?.name || prescription.provider?.name || 'Dr. Rezwanur Rahman',
      patientName: prescription.patientSnapshot?.name || 'Authorized Patient',
      patientId: prescription.patientSnapshot?.patientId || prescription.patientProfile?.patientId || '—',
      isFinalized: prescription.status === 'FINALIZED',
      isCancelled: Boolean(prescription.isCancelled),
    };
  }

  return prescription;
};

/**
 * Doctor favorite medicines management.
 */
export const getDoctorFavoriteMedicines = async (doctorId) =>
  PrescriptionFavorite.find({ doctor: doctorId }).sort({ useCount: -1, updatedAt: -1 }).limit(30).lean();

export const saveDoctorFavoriteMedicine = async (doctorId, data) => {
  const existing = await PrescriptionFavorite.findOne({
    doctor: doctorId,
    genericName: data.genericName.trim(),
    brandName: (data.brandName || '').trim(),
  });

  if (existing) {
    existing.useCount += 1;
    Object.assign(existing, data);
    await existing.save();
    return existing;
  }

  return PrescriptionFavorite.create({
    ...data,
    doctor: doctorId,
    useCount: 1,
  });
};

/**
 * Discard / Delete a prescription:
 * - If status === 'DRAFT': directly removes draft from DB.
 * - If hardDelete === true and caller is SOFTWARE_OWNER or SUPER_ADMIN: permanently removes from DB.
 * - Otherwise: marks status as CANCELLED with cancellation audit log.
 */
export const deletePrescription = async (id, actor, { hardDelete = false } = {}) => {
  const prescription = await findPrescriptionOrThrow(id);
  const isSuperOrOwner = actor.role === ROLES.SOFTWARE_OWNER || actor.role === ROLES.SUPER_ADMIN;

  if (prescription.status === 'DRAFT' || (hardDelete && isSuperOrOwner)) {
    const deletedId = prescription._id.toString();
    const prescriptionCode = prescription.prescriptionId;
    await Prescription.deleteOne({ _id: prescription._id });

    logger.info(
      { event: 'prescription_deleted', prescriptionId: prescriptionCode, deletedBy: String(actor._id) },
      'Prescription document deleted from database.',
    );

    return { _id: deletedId, deletedPermanently: true, prescriptionId: prescriptionCode };
  }

  return cancelPrescription(id, 'Prescription cancelled and discarded.', actor);
};

