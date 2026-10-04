import * as patientService from '../services/patient.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import {
  redactMedicalHistory,
  redactMedicalHistoryList,
} from '../utils/patient-access.util.js';
import {
  recordClinicalAccess,
  recordCreation,
  recordModification,
} from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { PatientProfile } from '../models/patient-profile.model.js';

// Every embedded medical-history sub-resource (allergy/condition/
// surgery/medication/family/social/vaccination) shares the same
// three audit actions (add/update/remove) — `historyType` in
// metadata distinguishes which sub-resource was touched, rather than
// one action identifier per sub-resource kind. See
// `audit.constants.js` for why.
const recordHistoryItemChange = (req, { verb, historyType, profile, itemId }) =>
  recordModification(req, {
    action:
      verb === 'add'
        ? AUDIT_ACTIONS.PATIENT_MEDICAL_HISTORY_ITEM_ADD
        : verb === 'update'
          ? AUDIT_ACTIONS.PATIENT_MEDICAL_HISTORY_ITEM_UPDATE
          : AUDIT_ACTIONS.PATIENT_MEDICAL_HISTORY_ITEM_REMOVE,
    resourceType: 'PatientProfile',
    resourceId: profile?._id,
    patientId: profile?._id,
    metadata: { historyType, itemId: itemId ?? null },
  });

/**
 * BET-06 — Patient & Medical History Controller.
 *
 * Controller layer for patient profile operations, following the same
 * pattern established in BET-05's
 * `modules/users/controllers/user.controller.js` and earlier's
 * `modules/staff/controllers/staff.controller.js` — thin controllers,
 * the service layer owns all business logic, and every response uses
 * the shared `sendSuccess`/`sendPaginated` envelope helpers
 * (`utils/apiResponse.js`, BET-02) rather than a bespoke response
 * shape.
 *
 * Every handler that can return the full profile passes it through
 * `redactMedicalHistory`/`redactMedicalHistoryList` first — see
 * `modules/patients/utils/patient-access.util.js` for why that is
 * necessary even though the routes are already permission-gated.
 */

export const createPatientProfileController = async (req, res, next) => {
  try {
    const { userId, ...profileData } = req.body;

    const profile = await patientService.createPatientProfile(
      profileData,
      userId,
      req.user._id,
    );

    await recordCreation(req, {
      action: AUDIT_ACTIONS.PATIENT_CREATE,
      resourceType: 'PatientProfile',
      resourceId: profile?._id,
      patientId: profile?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Patient profile created successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPatientProfileController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeUser = req.query.includeUser === 'true';

    const profile = await patientService.getPatientProfileById(id, {
      includeUser,
    });

    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.PATIENT_RECORD_VIEW,
      resourceType: 'PatientProfile',
      resourceId: profile?._id ?? id,
      patientId: profile?._id ?? id,
    });

    return sendSuccess(res, {
      message: 'Patient profile retrieved successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPatientProfileByPatientIdController = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const includeUser = req.query.includeUser === 'true';

    const profile = await patientService.getPatientProfileByPatientId(
      patientId,
      { includeUser },
    );

    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.PATIENT_RECORD_VIEW,
      resourceType: 'PatientProfile',
      resourceId: profile?._id,
      patientId: profile?._id,
    });

    return sendSuccess(res, {
      message: 'Patient profile retrieved successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// A patient always sees their own full record — matches the `/me`
// self-view pattern already established in `modules/staff` (BET-05).
export const getMyPatientProfileController = async (req, res, next) => {
  try {
    const includeUser = req.query.includeUser === 'true';

    const profile = await patientService.getPatientProfileByUserId(
      req.user._id,
      { includeUser },
    );

    return sendSuccess(res, {
      message: 'Patient profile retrieved successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPatientProfilesController = async (req, res, next) => {
  try {
    const { profiles, pagination } = await patientService.listPatientProfiles(
      req.query,
    );

    return sendPaginated(res, {
      message: 'Patient profiles retrieved successfully.',
      items: redactMedicalHistoryList(profiles, req.user),
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePatientProfileController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.updatePatientProfile(
      id,
      req.body,
      req.user._id,
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.PATIENT_PROFILE_UPDATE,
      resourceType: 'PatientProfile',
      resourceId: profile?._id ?? id,
      patientId: profile?._id ?? id,
    });

    return sendSuccess(res, {
      message: 'Patient profile updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const addAllergyController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.addAllergy(id, req.body, req.user._id);

    await recordHistoryItemChange(req, { verb: 'add', historyType: 'allergy', profile });

    return sendSuccess(res, {
      message: 'Allergy added successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAllergyController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.updateAllergy(
      id,
      itemId,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'update', historyType: 'allergy', profile, itemId });

    return sendSuccess(res, {
      message: 'Allergy updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeAllergyController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.removeAllergy(id, itemId, req.user._id);

    await recordHistoryItemChange(req, { verb: 'remove', historyType: 'allergy', profile, itemId });

    return sendSuccess(res, {
      message: 'Allergy removed successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const addChronicConditionController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.addChronicCondition(
      id,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'add', historyType: 'chronicCondition', profile });

    return sendSuccess(res, {
      message: 'Chronic condition added successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateChronicConditionController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.updateChronicCondition(
      id,
      itemId,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'update', historyType: 'chronicCondition', profile, itemId });

    return sendSuccess(res, {
      message: 'Chronic condition updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeChronicConditionController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.removeChronicCondition(
      id,
      itemId,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'remove', historyType: 'chronicCondition', profile, itemId });

    return sendSuccess(res, {
      message: 'Chronic condition removed successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const addSurgeryHistoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.addSurgeryHistory(
      id,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'add', historyType: 'surgeryHistory', profile });

    return sendSuccess(res, {
      message: 'Surgery history added successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSurgeryHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.updateSurgeryHistory(
      id,
      itemId,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'update', historyType: 'surgeryHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Surgery history updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeSurgeryHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.removeSurgeryHistory(
      id,
      itemId,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'remove', historyType: 'surgeryHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Surgery history removed successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const addMedicationHistoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.addMedicationHistory(
      id,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'add', historyType: 'medicationHistory', profile });

    return sendSuccess(res, {
      message: 'Medication history added successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMedicationHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.updateMedicationHistory(
      id,
      itemId,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'update', historyType: 'medicationHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Medication history updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeMedicationHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.removeMedicationHistory(
      id,
      itemId,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'remove', historyType: 'medicationHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Medication history removed successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const addFamilyHistoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.addFamilyHistory(
      id,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'add', historyType: 'familyHistory', profile });

    return sendSuccess(res, {
      message: 'Family history added successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateFamilyHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.updateFamilyHistory(
      id,
      itemId,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'update', historyType: 'familyHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Family history updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeFamilyHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.removeFamilyHistory(
      id,
      itemId,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'remove', historyType: 'familyHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Family history removed successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSocialHistoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.updateSocialHistory(
      id,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'update', historyType: 'socialHistory', profile });

    return sendSuccess(res, {
      message: 'Social history updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const addVaccinationHistoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.addVaccinationHistory(
      id,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'add', historyType: 'vaccinationHistory', profile });

    return sendSuccess(res, {
      message: 'Vaccination history added successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateVaccinationHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.updateVaccinationHistory(
      id,
      itemId,
      req.body,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'update', historyType: 'vaccinationHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Vaccination history updated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeVaccinationHistoryController = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;

    const profile = await patientService.removeVaccinationHistory(
      id,
      itemId,
      req.user._id,
    );

    await recordHistoryItemChange(req, { verb: 'remove', historyType: 'vaccinationHistory', profile, itemId });

    return sendSuccess(res, {
      message: 'Vaccination history removed successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deactivatePatientProfileController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.deactivatePatientProfile(
      id,
      req.user._id,
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.PATIENT_DEACTIVATE,
      resourceType: 'PatientProfile',
      resourceId: profile?._id ?? id,
      patientId: profile?._id ?? id,
    });

    return sendSuccess(res, {
      message: 'Patient profile deactivated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const reactivatePatientProfileController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await patientService.reactivatePatientProfile(
      id,
      req.user._id,
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.PATIENT_REACTIVATE,
      resourceType: 'PatientProfile',
      resourceId: profile?._id ?? id,
      patientId: profile?._id ?? id,
    });

    return sendSuccess(res, {
      message: 'Patient profile reactivated successfully.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Patient self-service. Identity ALWAYS comes from the authenticated
 * session (`req.user`) — never from the body — so a patient can only ever
 * create or edit their own profile. Staff use the permissioned routes.
 */
const assertPatientSelf = (req) => {
  if (req.user?.role !== ROLES.PATIENT) {
    throw new AppError('Only patients can manage their own patient profile here.', 403, {
      code: 'PATIENT_ONLY',
    });
  }
};

export const createMyPatientProfileController = async (req, res, next) => {
  try {
    assertPatientSelf(req);

    const existing = await PatientProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (existing) {
      throw new AppError('You already have a patient profile.', 409, { code: 'PROFILE_EXISTS' });
    }

    const profile = await patientService.createPatientProfile(req.body, req.user._id, req.user._id);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.PATIENT_CREATE,
      resourceType: 'PatientProfile',
      resourceId: profile?._id,
      patientId: profile?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Your patient profile was created.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMyPatientProfileController = async (req, res, next) => {
  try {
    assertPatientSelf(req);

    const own = await patientService.getPatientProfileByUserId(req.user._id);
    const profile = await patientService.updatePatientProfile(own._id, req.body, req.user._id);

    await recordModification(req, {
      action: AUDIT_ACTIONS.PATIENT_PROFILE_UPDATE,
      resourceType: 'PatientProfile',
      resourceId: profile?._id ?? own._id,
      patientId: profile?._id ?? own._id,
    });

    return sendSuccess(res, {
      message: 'Your profile was updated.',
      data: redactMedicalHistory(profile, req.user),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
