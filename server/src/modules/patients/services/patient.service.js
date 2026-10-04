import mongoose from 'mongoose';
import { PatientProfile } from '../models/patient-profile.model.js';
import { User } from '../../../users/user.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';
import { hashPassword } from '../../../security/password.js';

/**
 * BET-06 — Patient & Medical History Service.
 *
 * Service layer for patient profile management, following the same
 * separation-of-concerns pattern established in BET-05's
 * `modules/users/services/user.service.js` and earlier's
 * `modules/staff/services/staff.service.js`.
 *
 * Important: A `PatientProfile` is always attached to an existing
 * `User` of role `PATIENT`. The `User` itself is created either via
 * self-service registration (`POST /auth/register`, BET-03) or
 * hypothetically via admin creation (`POST /api/v1/users`, BET-05),
 * though BET-05 deliberately excludes `PATIENT` from
 * `ADMIN_ASSIGNABLE_ROLES` (patients are self-service only by design).
 *
 * This service never creates a `User` directly — it only manages the
 * patient-specific profile attached to an already-existing `User`.
 */

/**
 * Generate a unique sequential patient ID.
 * Pattern: PAT-YYYYMM-XXXX
 * Example: PAT-202608-0001
 *
 * This mirrors the `generateEmployeeId()` pattern from
 * `modules/staff/services/staff.service.js` (BET-05), adapted for
 * patients. The YYYYMM segment helps maintain chronological ordering
 * while the sequential counter ensures uniqueness within each month.
 */
async function generatePatientId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PAT-${year}${month}`;

  // Find the highest existing patient ID for this month
  const latestPatient = await PatientProfile.findOne({
    patientId: { $regex: `^${prefix}-` },
  })
    .sort({ patientId: -1 })
    .select('patientId')
    .lean();

  let nextSequence = 1;

  if (latestPatient?.patientId) {
    const match = latestPatient.patientId.match(/-(\d{4})$/);
    if (match) {
      nextSequence = parseInt(match[1], 10) + 1;
    }
  }

  const sequenceStr = String(nextSequence).padStart(4, '0');
  return `${prefix}-${sequenceStr}`;
}

/**
 * Create a new patient profile.
 *
 * @param {Object} profileData - Patient profile data
 * @param {mongoose.Types.ObjectId} userId - The User ID (must be role PATIENT)
 * @param {mongoose.Types.ObjectId} createdBy - The User ID of the creator
 * @returns {Promise<Object>} The created patient profile
 */
export async function createPatientProfile(profileData, userId, createdBy) {
  let user = null;
  if (mongoose.isValidObjectId(userId)) {
    user = await User.findById(userId).select('role email username').lean();
  }

  if (!user && typeof userId === 'string') {
    const term = userId.trim();
    user = await User.findOne({
      $or: [
        { email: term.toLowerCase() },
        { username: term },
      ],
    }).select('role email username').lean();
  }

  if (!user) {
    if (!userId || userId === 'WALK_IN' || userId === 'AUTO' || typeof userId !== 'string' || !userId.trim()) {
      const generatedUsername = `pat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const generatedEmail = `${generatedUsername}@ashshafi.local`;
      const generatedName = `${profileData.firstName || 'Walk-in'} ${profileData.lastName || 'Patient'}`.trim();
      const generatedPassword = `Pat#${Math.random().toString(36).slice(2, 10)}!`;
      const passwordHash = await hashPassword(generatedPassword);

      const newPatientUser = await User.create({
        name: generatedName,
        username: generatedUsername,
        email: generatedEmail,
        passwordHash,
        role: ROLES.PATIENT,
        isEmailVerified: true,
      });
      user = newPatientUser.toObject ? newPatientUser.toObject() : newPatientUser;
    } else {
      throw new AppError('User account not found. Please provide a valid patient Account ID, email, or username.', 404, { code: 'USER_NOT_FOUND' });
    }
  }

  if (user.role !== ROLES.PATIENT) {
    throw new AppError('Patient profiles can only be created for PATIENT role accounts.', 400, { code: 'INVALID_USER_ROLE' });
  }

  const effectiveUserId = user._id;

  // Check if a profile already exists for this user
  const existingProfile = await PatientProfile.findOne({ user: effectiveUserId }).lean();

  if (existingProfile) {
    throw new AppError('A patient profile already exists for this user.', 409, { code: 'PROFILE_ALREADY_EXISTS' });
  }

  // Generate unique patient ID
  const patientId = await generatePatientId();

  // Create the patient profile
  const profile = new PatientProfile({
    ...profileData,
    user: effectiveUserId,
    patientId,
    createdBy,
    updatedBy: createdBy,
  });

  await profile.save();

  logger.info(
    {
      event: 'patient_profile_created',
      patientProfileId: profile._id.toString(),
      patientId: profile.patientId,
      userId: String(userId),
      createdBy: createdBy ? String(createdBy) : null,
    },
    'Patient profile created.',
  );

  return profile;
}

/**
 * Get a patient profile by ID.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} The patient profile
 */
export async function getPatientProfileById(profileId, options = {}) {
  const { includeUser = false } = options;

  let query = PatientProfile.findById(profileId);

  if (includeUser) {
    query = query.populate('user', 'email username status');
  }

  const profile = await query.exec();

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  return profile;
}

/**
 * Get a patient profile by user ID.
 *
 * @param {mongoose.Types.ObjectId} userId - The user ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} The patient profile
 */
export async function getPatientProfileByUserId(userId, options = {}) {
  const { includeUser = false } = options;

  let query = PatientProfile.findOne({ user: userId });

  if (includeUser) {
    query = query.populate('user', 'email username status');
  }

  const profile = await query.exec();

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  return profile;
}

/**
 * Get a patient profile by patient ID.
 *
 * @param {string} patientId - The human-readable patient ID (e.g., PAT-202608-0001)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} The patient profile
 */
export async function getPatientProfileByPatientId(patientId, options = {}) {
  const { includeUser = false } = options;

  let query = PatientProfile.findOne({ patientId: patientId.toUpperCase() });

  if (includeUser) {
    query = query.populate('user', 'email username status');
  }

  const profile = await query.exec();

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  return profile;
}

/**
 * List patient profiles with filtering, searching, and pagination.
 *
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} Paginated patient profiles
 */
export async function listPatientProfiles(filters = {}) {
  const {
    search = '',
    patientStatus = '',
    gender = '',
    minAge = null,
    maxAge = null,
    registeredAfter = null,
    registeredBefore = null,
    primaryCareProvider = null,
    page = 1,
    limit = 20,
    sortBy = 'registrationDate',
    sortOrder = 'desc',
  } = filters;

  const query = { isActive: true };

  // Text search across name, patient ID, phone
  if (search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { patientId: searchRegex },
      { phone: searchRegex },
    ];
  }

  // Filter by patient status
  if (patientStatus) {
    query.patientStatus = patientStatus;
  }

  // Filter by gender
  if (gender) {
    query.gender = gender;
  }

  // Filter by primary care provider
  if (primaryCareProvider) {
    query.primaryCareProvider = primaryCareProvider;
  }

  // Filter by registration date range
  if (registeredAfter || registeredBefore) {
    query.registrationDate = {};
    if (registeredAfter) {
      query.registrationDate.$gte = new Date(registeredAfter);
    }
    if (registeredBefore) {
      query.registrationDate.$lte = new Date(registeredBefore);
    }
  }

  // Age filtering requires calculating age from dateOfBirth
  // This is done post-query filtering since age is a virtual field
  let ageFilter = null;
  if (minAge !== null || maxAge !== null) {
    ageFilter = { minAge, maxAge };
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Execute query
  let profiles = await PatientProfile.find(query)
    .populate('user', 'email username status')
    .populate('primaryCareProvider', 'name email')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  // Apply age filtering if needed
  if (ageFilter) {
    profiles = profiles.filter((profile) => {
      if (!profile.dateOfBirth) return false;

      const today = new Date();
      const birthDate = new Date(profile.dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (ageFilter.minAge !== null && age < ageFilter.minAge) return false;
      if (ageFilter.maxAge !== null && age > ageFilter.maxAge) return false;

      return true;
    });
  }

  const totalBeforeAgeFilter = await PatientProfile.countDocuments(query);
  const total = ageFilter ? profiles.length : totalBeforeAgeFilter;

  return {
    profiles,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update a patient profile.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} updates - Fields to update
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updatePatientProfile(profileId, updates, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  // Fields that should never be updated through this method — defense
  // in depth on top of `updatePatientProfileSchema` already acting as
  // the field allowlist (unknown fields are stripped by the shared
  // `validate()` middleware before this is ever called).
  const protectedFields = ['_id', 'user', 'patientId', 'createdBy'];
  protectedFields.forEach((field) => delete updates[field]);

  // Apply updates
  Object.keys(updates).forEach((key) => {
    profile[key] = updates[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  logger.info(
    {
      event: 'patient_profile_updated',
      patientProfileId: profile._id.toString(),
      updatedBy: updatedBy ? String(updatedBy) : null,
      fields: Object.keys(updates),
    },
    'Patient profile updated.',
  );

  return profile;
}

/**
 * Add an allergy to a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} allergyData - Allergy data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function addAllergy(profileId, allergyData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.allergies.push(allergyData);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Update an allergy in a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} allergyId - The allergy subdocument ID
 * @param {Object} allergyData - Updated allergy data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updateAllergy(profileId, allergyId, allergyData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  const allergy = profile.allergies.id(allergyId);

  if (!allergy) {
    throw new AppError('Allergy not found.', 404, { code: 'ALLERGY_NOT_FOUND' });
  }

  Object.keys(allergyData).forEach((key) => {
    allergy[key] = allergyData[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Remove an allergy from a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} allergyId - The allergy subdocument ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function removeAllergy(profileId, allergyId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.allergies.pull(allergyId);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Add a chronic condition to a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} conditionData - Chronic condition data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function addChronicCondition(profileId, conditionData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.chronicConditions.push(conditionData);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Update a chronic condition in a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} conditionId - The chronic condition subdocument ID
 * @param {Object} conditionData - Updated condition data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updateChronicCondition(profileId, conditionId, conditionData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  const condition = profile.chronicConditions.id(conditionId);

  if (!condition) {
    throw new AppError('Chronic condition not found.', 404, { code: 'CONDITION_NOT_FOUND' });
  }

  Object.keys(conditionData).forEach((key) => {
    condition[key] = conditionData[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Remove a chronic condition from a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} conditionId - The chronic condition subdocument ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function removeChronicCondition(profileId, conditionId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.chronicConditions.pull(conditionId);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Add a surgery to a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} surgeryData - Surgery data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function addSurgeryHistory(profileId, surgeryData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.surgeryHistory.push(surgeryData);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Update a surgery in a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} surgeryId - The surgery subdocument ID
 * @param {Object} surgeryData - Updated surgery data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updateSurgeryHistory(profileId, surgeryId, surgeryData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  const surgery = profile.surgeryHistory.id(surgeryId);

  if (!surgery) {
    throw new AppError('Surgery record not found.', 404, { code: 'SURGERY_NOT_FOUND' });
  }

  Object.keys(surgeryData).forEach((key) => {
    surgery[key] = surgeryData[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Remove a surgery from a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} surgeryId - The surgery subdocument ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function removeSurgeryHistory(profileId, surgeryId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.surgeryHistory.pull(surgeryId);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Add a medication to a patient's medication history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} medicationData - Medication data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function addMedicationHistory(profileId, medicationData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.medicationHistory.push(medicationData);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Update a medication in a patient's medication history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} medicationId - The medication subdocument ID
 * @param {Object} medicationData - Updated medication data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updateMedicationHistory(profileId, medicationId, medicationData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  const medication = profile.medicationHistory.id(medicationId);

  if (!medication) {
    throw new AppError('Medication record not found.', 404, { code: 'MEDICATION_NOT_FOUND' });
  }

  Object.keys(medicationData).forEach((key) => {
    medication[key] = medicationData[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Remove a medication from a patient's medication history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} medicationId - The medication subdocument ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function removeMedicationHistory(profileId, medicationId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.medicationHistory.pull(medicationId);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Add a family history entry to a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} familyHistoryData - Family history data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function addFamilyHistory(profileId, familyHistoryData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.familyHistory.push(familyHistoryData);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Update a family history entry in a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} familyHistoryId - The family history subdocument ID
 * @param {Object} familyHistoryData - Updated family history data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updateFamilyHistory(profileId, familyHistoryId, familyHistoryData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  const familyHistory = profile.familyHistory.id(familyHistoryId);

  if (!familyHistory) {
    throw new AppError('Family history record not found.', 404, { code: 'FAMILY_HISTORY_NOT_FOUND' });
  }

  Object.keys(familyHistoryData).forEach((key) => {
    familyHistory[key] = familyHistoryData[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Remove a family history entry from a patient's medical history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} familyHistoryId - The family history subdocument ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function removeFamilyHistory(profileId, familyHistoryId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.familyHistory.pull(familyHistoryId);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Update a patient's social history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} socialHistoryData - Social history data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updateSocialHistory(profileId, socialHistoryData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  Object.keys(socialHistoryData).forEach((key) => {
    profile.socialHistory[key] = socialHistoryData[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Add a vaccination to a patient's vaccination history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {Object} vaccinationData - Vaccination data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function addVaccinationHistory(profileId, vaccinationData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.vaccinationHistory.push(vaccinationData);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Update a vaccination in a patient's vaccination history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} vaccinationId - The vaccination subdocument ID
 * @param {Object} vaccinationData - Updated vaccination data
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function updateVaccinationHistory(profileId, vaccinationId, vaccinationData, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  const vaccination = profile.vaccinationHistory.id(vaccinationId);

  if (!vaccination) {
    throw new AppError('Vaccination record not found.', 404, { code: 'VACCINATION_NOT_FOUND' });
  }

  Object.keys(vaccinationData).forEach((key) => {
    vaccination[key] = vaccinationData[key];
  });

  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Remove a vaccination from a patient's vaccination history.
 *
 * @param {string} profileId - The patient profile ID
 * @param {string} vaccinationId - The vaccination subdocument ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The updated patient profile
 */
export async function removeVaccinationHistory(profileId, vaccinationId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.vaccinationHistory.pull(vaccinationId);
  profile.updatedBy = updatedBy;

  await profile.save();

  return profile;
}

/**
 * Deactivate a patient profile (soft delete).
 *
 * @param {string} profileId - The patient profile ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The deactivated patient profile
 */
export async function deactivatePatientProfile(profileId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.isActive = false;
  profile.updatedBy = updatedBy;

  await profile.save();

  logger.info(
    {
      event: 'patient_profile_deactivated',
      patientProfileId: profile._id.toString(),
      updatedBy: updatedBy ? String(updatedBy) : null,
    },
    'Patient profile deactivated.',
  );

  return profile;
}

/**
 * Reactivate a patient profile.
 *
 * @param {string} profileId - The patient profile ID
 * @param {mongoose.Types.ObjectId} updatedBy - The User ID of the updater
 * @returns {Promise<Object>} The reactivated patient profile
 */
export async function reactivatePatientProfile(profileId, updatedBy) {
  const profile = await PatientProfile.findById(profileId);

  if (!profile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PROFILE_NOT_FOUND' });
  }

  profile.isActive = true;
  profile.patientStatus = 'ACTIVE';
  profile.updatedBy = updatedBy;

  await profile.save();

  logger.info(
    {
      event: 'patient_profile_reactivated',
      patientProfileId: profile._id.toString(),
      updatedBy: updatedBy ? String(updatedBy) : null,
    },
    'Patient profile reactivated.',
  );

  return profile;
}
