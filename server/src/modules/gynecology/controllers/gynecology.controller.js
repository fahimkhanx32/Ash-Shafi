import * as gynecologyService from '../services/gynecology.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { recordCreation } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

/**
 * BET-07 — Gynecology & Sensitive Clinical Records controller.
 *
 * Thin controllers, matching the convention established in
 * `modules/patients/controllers/patient.controller.js` (BET-06). No
 * response-level redaction is needed here the way BET-06 needed
 * `patient-access.util.js` — unlike the general medical history
 * (embedded on the same document as ordinary demographics), *every*
 * field on a `GynecologyRecord` is behind the same
 * `SENSITIVE_RECORDS_READ`/`WRITE` tier, so reaching the controller
 * at all already means the viewer is entitled to see the whole
 * document (enforced in the service layer by
 * `enforceSensitiveRecordAccess` before any data is returned).
 */

const requestMetaFrom = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

export const createGynecologyRecordController = async (req, res, next) => {
  try {
    const { patientProfileId, ...data } = req.body;

    const record = await gynecologyService.createGynecologyRecord(
      patientProfileId,
      data,
      req.user,
      requestMetaFrom(req),
    );

    // As in `pregnancy.controller.js`: BET-07's `enforceSensitiveRecordAccess`
    // already wrote a `sensitive_record_access_logs` entry for this
    // write; this additionally records it in the general BET-17
    // record-creation trail.
    await recordCreation(req, {
      action: AUDIT_ACTIONS.GYNECOLOGY_RECORD_CREATE,
      resourceType: 'GynecologyRecord',
      resourceId: record?._id,
      patientId: patientProfileId,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Gynecology record created successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getGynecologyRecordController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await gynecologyService.getGynecologyRecordById(
      id,
      req.user,
      requestMetaFrom(req),
    );

    return sendSuccess(res, {
      message: 'Gynecology record retrieved successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getGynecologyRecordByPatientController = async (req, res, next) => {
  try {
    const { patientProfileId } = req.params;

    const record = await gynecologyService.getGynecologyRecordByPatientProfileId(
      patientProfileId,
      req.user,
      requestMetaFrom(req),
    );

    return sendSuccess(res, {
      message: 'Gynecology record retrieved successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyGynecologyRecordController = async (req, res, next) => {
  try {
    const record = await gynecologyService.getMyGynecologyRecord(
      req.user,
      requestMetaFrom(req),
    );

    return sendSuccess(res, {
      message: 'Gynecology record retrieved successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateGynecologyRecordController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await gynecologyService.updateGynecologyRecord(
      id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );

    return sendSuccess(res, {
      message: 'Gynecology record updated successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

const makeArrayControllers = (resourceLabel, service) => ({
  add: async (req, res, next) => {
    try {
      const { id } = req.params;
      const record = await service.add(id, req.body, req.user, requestMetaFrom(req));
      return sendSuccess(res, {
        message: `${resourceLabel} added successfully.`,
        data: record,
        requestId: req.requestId,
      });
    } catch (error) {
      return next(error);
    }
  },
  update: async (req, res, next) => {
    try {
      const { id, itemId } = req.params;
      const record = await service.update(id, itemId, req.body, req.user, requestMetaFrom(req));
      return sendSuccess(res, {
        message: `${resourceLabel} updated successfully.`,
        data: record,
        requestId: req.requestId,
      });
    } catch (error) {
      return next(error);
    }
  },
  remove: async (req, res, next) => {
    try {
      const { id, itemId } = req.params;
      const record = await service.remove(id, itemId, req.user, requestMetaFrom(req));
      return sendSuccess(res, {
        message: `${resourceLabel} removed successfully.`,
        data: record,
        requestId: req.requestId,
      });
    } catch (error) {
      return next(error);
    }
  },
});

const gynecologicalConditionControllers = makeArrayControllers('Gynecological condition', {
  add: gynecologyService.addGynecologicalCondition,
  update: gynecologyService.updateGynecologicalCondition,
  remove: gynecologyService.removeGynecologicalCondition,
});
const contraceptionControllers = makeArrayControllers('Contraception record', {
  add: gynecologyService.addContraception,
  update: gynecologyService.updateContraception,
  remove: gynecologyService.removeContraception,
});
const stiHistoryControllers = makeArrayControllers('STI/STD history record', {
  add: gynecologyService.addStiHistory,
  update: gynecologyService.updateStiHistory,
  remove: gynecologyService.removeStiHistory,
});
const cervicalScreeningControllers = makeArrayControllers('Cervical screening', {
  add: gynecologyService.addCervicalScreening,
  update: gynecologyService.updateCervicalScreening,
  remove: gynecologyService.removeCervicalScreening,
});
const breastRecordControllers = makeArrayControllers('Breast record', {
  add: gynecologyService.addBreastRecord,
  update: gynecologyService.updateBreastRecord,
  remove: gynecologyService.removeBreastRecord,
});
const procedureControllers = makeArrayControllers('Gynecological procedure', {
  add: gynecologyService.addProcedure,
  update: gynecologyService.updateProcedure,
  remove: gynecologyService.removeProcedure,
});

export const addGynecologicalConditionController = gynecologicalConditionControllers.add;
export const updateGynecologicalConditionController = gynecologicalConditionControllers.update;
export const removeGynecologicalConditionController = gynecologicalConditionControllers.remove;

export const addContraceptionController = contraceptionControllers.add;
export const updateContraceptionController = contraceptionControllers.update;
export const removeContraceptionController = contraceptionControllers.remove;

export const addStiHistoryController = stiHistoryControllers.add;
export const updateStiHistoryController = stiHistoryControllers.update;
export const removeStiHistoryController = stiHistoryControllers.remove;

export const addCervicalScreeningController = cervicalScreeningControllers.add;
export const updateCervicalScreeningController = cervicalScreeningControllers.update;
export const removeCervicalScreeningController = cervicalScreeningControllers.remove;

export const addBreastRecordController = breastRecordControllers.add;
export const updateBreastRecordController = breastRecordControllers.update;
export const removeBreastRecordController = breastRecordControllers.remove;

export const addProcedureController = procedureControllers.add;
export const updateProcedureController = procedureControllers.update;
export const removeProcedureController = procedureControllers.remove;
