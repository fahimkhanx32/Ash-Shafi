import * as encounterService from '../services/encounter.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { recordClinicalAccess, recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const createEncounterController = async (req, res, next) => {
  try {
    const { patientProfileId, ...data } = req.body;
    const encounter = await encounterService.createEncounter(patientProfileId, data, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.ENCOUNTER_CREATE,
      resourceType: 'Encounter',
      resourceId: encounter?._id,
      patientId: patientProfileId,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Encounter created successfully.',
      data: encounter,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getEncounterController = async (req, res, next) => {
  try {
    const encounter = await encounterService.getEncounterById(req.params.id);

    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.ENCOUNTER_VIEW,
      resourceType: 'Encounter',
      resourceId: req.params.id,
      patientId: encounter?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Encounter retrieved successfully.',
      data: encounter,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listEncountersByPatientController = async (req, res, next) => {
  try {
    const encounters = await encounterService.listEncountersByPatientProfileId(
      req.params.patientProfileId,
    );
    return sendSuccess(res, {
      message: 'Encounters retrieved successfully.',
      data: encounters,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyEncountersController = async (req, res, next) => {
  try {
    const encounters = await encounterService.getMyEncounters(req.user);
    return sendSuccess(res, {
      message: 'Encounters retrieved successfully.',
      data: encounters,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateEncounterController = async (req, res, next) => {
  try {
    const encounter = await encounterService.updateEncounter(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.ENCOUNTER_UPDATE,
      resourceType: 'Encounter',
      resourceId: req.params.id,
      patientId: encounter?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Encounter updated successfully.',
      data: encounter,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const finalizeEncounterController = async (req, res, next) => {
  try {
    const encounter = await encounterService.finalizeEncounter(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.ENCOUNTER_FINALIZE,
      resourceType: 'Encounter',
      resourceId: req.params.id,
      patientId: encounter?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Encounter finalized successfully.',
      data: encounter,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const amendEncounterController = async (req, res, next) => {
  try {
    const { reason, ...updates } = req.body;
    const encounter = await encounterService.amendEncounter(
      req.params.id,
      updates,
      reason,
      req.user,
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.ENCOUNTER_AMEND,
      resourceType: 'Encounter',
      resourceId: req.params.id,
      patientId: encounter?.patientProfile ?? null,
      reason: reason ?? null,
    });

    return sendSuccess(res, {
      message: 'Encounter amended successfully.',
      data: encounter,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
