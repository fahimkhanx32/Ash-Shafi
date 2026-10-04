import * as pregnancyService from '../services/pregnancy.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { recordCreation } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

const requestMetaFrom = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

export const createPregnancyRecordController = async (req, res, next) => {
  try {
    const { patientProfileId, ...data } = req.body;
    const record = await pregnancyService.createPregnancyRecord(
      patientProfileId,
      data,
      req.user,
      requestMetaFrom(req),
    );

    // Note: sensitive-record *access* to this record (read/write,
    // allowed or denied) is already logged via `sensitive_record_
    // access_logs` inside `pregnancyService` (reused from BET-07 —
    // pregnancy/reproductive history is sensitive data per master
    // prompt §16). This entry additionally records the creation
    // event itself in the general BET-17 audit trail.
    await recordCreation(req, {
      action: AUDIT_ACTIONS.OBSTETRIC_RECORD_CREATE,
      resourceType: 'PregnancyRecord',
      resourceId: record?._id,
      patientId: patientProfileId,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Pregnancy record created successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPregnancyRecordController = async (req, res, next) => {
  try {
    const record = await pregnancyService.getPregnancyRecordById(
      req.params.id,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Pregnancy record retrieved successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPregnancyRecordsByPatientController = async (req, res, next) => {
  try {
    const records = await pregnancyService.listPregnancyRecordsByPatientProfileId(
      req.params.patientProfileId,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Pregnancy records retrieved successfully.',
      data: records,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyPregnancyRecordsController = async (req, res, next) => {
  try {
    const records = await pregnancyService.getMyPregnancyRecords(req.user, requestMetaFrom(req));
    return sendSuccess(res, {
      message: 'Pregnancy records retrieved successfully.',
      data: records,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePregnancyRecordController = async (req, res, next) => {
  try {
    const record = await pregnancyService.updatePregnancyRecord(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Pregnancy record updated successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateDeliveryController = async (req, res, next) => {
  try {
    const record = await pregnancyService.updateDelivery(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Delivery record updated successfully.',
      data: record,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePostpartumController = async (req, res, next) => {
  try {
    const record = await pregnancyService.updatePostpartum(
      req.params.id,
      req.body,
      req.user,
      requestMetaFrom(req),
    );
    return sendSuccess(res, {
      message: 'Postpartum record updated successfully.',
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

const antenatalVisitControllers = makeArrayControllers('Antenatal visit', {
  add: pregnancyService.addAntenatalVisit,
  update: pregnancyService.updateAntenatalVisit,
  remove: pregnancyService.removeAntenatalVisit,
});
const fetalObservationControllers = makeArrayControllers('Fetal observation', {
  add: pregnancyService.addFetalObservation,
  update: pregnancyService.updateFetalObservation,
  remove: pregnancyService.removeFetalObservation,
});
const complicationControllers = makeArrayControllers('Pregnancy complication', {
  add: pregnancyService.addPregnancyComplication,
  update: pregnancyService.updatePregnancyComplication,
  remove: pregnancyService.removePregnancyComplication,
});

export const addAntenatalVisitController = antenatalVisitControllers.add;
export const updateAntenatalVisitController = antenatalVisitControllers.update;
export const removeAntenatalVisitController = antenatalVisitControllers.remove;

export const addFetalObservationController = fetalObservationControllers.add;
export const updateFetalObservationController = fetalObservationControllers.update;
export const removeFetalObservationController = fetalObservationControllers.remove;

export const addComplicationController = complicationControllers.add;
export const updateComplicationController = complicationControllers.update;
export const removeComplicationController = complicationControllers.remove;
