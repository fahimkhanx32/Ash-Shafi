import mongoose from 'mongoose';
import { Conversation } from '../models/conversation.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { User } from '../../../users/user.model.js';
import { assertIsConversationParticipant, isAdminTier } from './conversation-access.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-13 — Conversations (master prompt §29).
 *
 * Creation is provider-scoped, reusing the same "is this doctor
 * actually this patient's provider" signal BET-07 established for
 * sensitive clinical records (`PatientProfile.primaryCareProvider`):
 *   - A `PATIENT` may only start a conversation with their own
 *     assigned `primaryCareProvider` — not an arbitrary doctor id
 *     (master prompt §80 — never trust a client-supplied id as
 *     authorization).
 *   - A `DOCTOR` may only start a conversation with a patient
 *     currently assigned to them.
 *   - Admin-tier roles (`SOFTWARE_OWNER`/`SUPER_ADMIN`/`DIRECTOR`)
 *     may create a conversation for any valid patient/doctor pair
 *     (e.g. setting up a channel on a patient's behalf) — consistent
 *     with their unconditional exemption everywhere else this
 *     project checks provider-based access.
 */

const ADMIN_TIER_ROLES = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR];

const populateParticipants = (query) =>
  query
    .populate('patient', 'name email role status')
    .populate('doctor', 'name email role status')
    .populate('patientProfile', 'patientId primaryCareProvider');

export const assertActiveDoctor = async (doctorId) => {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw new AppError('Invalid doctor id.', 400, { code: 'INVALID_ID' });
  }
  const doctor = await User.findById(doctorId).select('role status');
  if (!doctor || doctor.role !== ROLES.DOCTOR || doctor.status !== 'ACTIVE') {
    throw new AppError('Doctor not found.', 404, { code: 'DOCTOR_NOT_FOUND' });
  }
  return doctor;
};

/**
 * Server-side conversation lookup/creation with NO actor-role
 * restriction, used by report intake to deliver its notice to a
 * routed doctor. Not exposed over HTTP. The caller is responsible for
 * having already authorized the underlying action (an intake
 * submission) — this only guarantees the thread exists.
 */
export const ensureConversationForPair = async ({ patientProfile, doctorId, createdBy }) => {
  const existing = await Conversation.findOne({ patient: patientProfile.user, doctor: doctorId });
  if (existing) return existing;
  try {
    return await Conversation.create({
      patientProfile: patientProfile._id,
      patient: patientProfile.user,
      doctor: doctorId,
      createdBy,
    });
  } catch (error) {
    // Unique {patient, doctor} index: a concurrent submission created it first.
    if (error?.code === 11000) {
      return Conversation.findOne({ patient: patientProfile.user, doctor: doctorId });
    }
    throw error;
  }
};

export const findOrCreateConversation = async (
  { patientProfileId, doctorId },
  actor,
) => {
  if (!patientProfileId || !doctorId) {
    throw new AppError('patientProfileId and doctorId are required.', 400, {
      code: 'VALIDATION_ERROR',
    });
  }

  const patientProfile = await PatientProfile.findById(patientProfileId);

  if (!patientProfile) {
    throw new AppError('Patient profile not found.', 404, {
      code: 'PROFILE_NOT_FOUND',
    });
  }

  const providerId = patientProfile.primaryCareProvider
    ? String(patientProfile.primaryCareProvider)
    : null;

  if (actor.role === ROLES.PATIENT) {
    if (String(patientProfile.user) !== String(actor._id)) {
      throw new AppError('Patient profile not found.', 404, {
        code: 'PROFILE_NOT_FOUND',
      });
    }

    // A patient may message ANY active doctor in the practice, not only
    // their assigned provider. The doctor must be a real, active DOCTOR
    // account — never a client-supplied id trusted blindly. (Doctor-
    // initiated conversations stay restricted to assigned patients
    // below; a doctor can always reply once a patient opens the thread.)
    await assertActiveDoctor(doctorId);
  } else if (actor.role === ROLES.DOCTOR) {
    if (String(doctorId) !== String(actor._id)) {
      throw new AppError(
        'You can only start a conversation as yourself.',
        403,
        { code: 'FORBIDDEN' },
      );
    }

    if (!providerId || providerId !== String(actor._id)) {
      throw new AppError(
        'You can only message patients currently assigned to you.',
        403,
        { code: 'NOT_ASSIGNED_PROVIDER' },
      );
    }
  } else if (!ADMIN_TIER_ROLES.includes(actor.role)) {
    throw new AppError('You do not have permission to perform this action.', 403, {
      code: 'FORBIDDEN',
    });
  }

  let conversation = await Conversation.findOne({
    patient: patientProfile.user,
    doctor: doctorId,
  });

  if (conversation) {
    return populateParticipants(Conversation.findById(conversation._id));
  }

  conversation = await Conversation.create({
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    doctor: doctorId,
    createdBy: actor._id,
  });

  logger.info(
    { conversationId: conversation._id, patientProfileId, doctorId },
    'Conversation created.',
  );

  return populateParticipants(Conversation.findById(conversation._id));
};

export const findConversationOrThrow = async (id) => {
  const conversation = await Conversation.findById(id);

  if (!conversation) {
    throw new AppError('Conversation not found.', 404, {
      code: 'CONVERSATION_NOT_FOUND',
    });
  }

  return conversation;
};

export const getConversationById = async (id, actor, requestMeta = {}) => {
  const conversation = await findConversationOrThrow(id);

  await assertIsConversationParticipant({
    actor,
    conversation,
    write: false,
    requestMeta,
  });

  return populateParticipants(Conversation.findById(conversation._id));
};

/**
 * `GET /conversations/me` — identity-resolved, no permission beyond
 * authentication, same `/me` shape as appointments/patients/reports.
 * A `PATIENT` sees conversations where they are `patient`; a
 * `DOCTOR` sees conversations where they are `doctor`. Admin-tier
 * callers get an empty result here by design (they have no personal
 * conversations) — they use the filtered admin listing below instead.
 */
export const listMyConversations = async (actor, { page = 1, limit = 20 } = {}) => {
  const filter =
    actor.role === ROLES.PATIENT
      ? { patient: actor._id }
      : actor.role === ROLES.DOCTOR
        ? { doctor: actor._id }
        : { _id: null };

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    populateParticipants(Conversation.find(filter))
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Conversation.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

/**
 * Admin-tier filtered listing. Deliberately requires at least one of
 * `patientProfileId`/`doctorId` — the same "no blanket roster of
 * every private conversation" decision BET-07 made for
 * `GynecologyRecord` (master prompt §16 — restrict access to
 * sensitive/private records even for roles that technically hold the
 * permission).
 */
export const listConversationsForAdmin = async ({
  patientProfileId,
  doctorId,
  page = 1,
  limit = 20,
} = {}) => {
  if (!patientProfileId && !doctorId) {
    throw new AppError(
      'patientProfileId or doctorId filter is required.',
      400,
      { code: 'VALIDATION_ERROR' },
    );
  }

  const filter = {};
  if (patientProfileId) filter.patientProfile = patientProfileId;
  if (doctorId) filter.doctor = doctorId;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    populateParticipants(Conversation.find(filter))
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Conversation.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

export { isAdminTier };
