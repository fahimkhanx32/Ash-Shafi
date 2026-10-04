import * as prescriptionService from '../services/prescription.service.js';
import { generatePrescriptionPdf } from '../services/prescription-pdf.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import {
  recordClinicalAccess,
  recordCreation,
  recordModification,
  recordExport,
  recordFileAccess,
} from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const createPrescriptionController = async (req, res, next) => {
  try {
    const { patientProfileId, ...data } = req.body;
    const prescription = await prescriptionService.createPrescription(patientProfileId, data, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_CREATE,
      resourceType: 'Prescription',
      resourceId: prescription?._id,
      patientId: patientProfileId,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Prescription drafted successfully.',
      data: prescription,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPrescriptionController = async (req, res, next) => {
  try {
    const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.user);

    await recordClinicalAccess(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_VIEW,
      resourceType: 'Prescription',
      resourceId: prescription?._id || req.params.id,
      patientId: prescription?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Prescription retrieved successfully.',
      data: prescription,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPrescriptionsController = async (req, res, next) => {
  try {
    const result = await prescriptionService.listPrescriptions(req.query);
    return sendSuccess(res, {
      message: 'Prescriptions listed successfully.',
      data: result.items,
      meta: result.pagination,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPrescriptionsByPatientController = async (req, res, next) => {
  try {
    const prescriptions = await prescriptionService.listPrescriptionsByPatientProfileId(
      req.params.patientProfileId,
    );
    return sendSuccess(res, {
      message: 'Prescriptions retrieved successfully.',
      data: prescriptions,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyPrescriptionsController = async (req, res, next) => {
  try {
    const prescriptions = await prescriptionService.getMyPrescriptions(req.user);
    return sendSuccess(res, {
      message: 'Prescriptions retrieved successfully.',
      data: prescriptions,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPrescriptionHistoryController = async (req, res, next) => {
  try {
    const versions = await prescriptionService.getPrescriptionVersionHistory(req.params.id, req.user);
    return sendSuccess(res, {
      message: 'Prescription version history retrieved successfully.',
      data: versions,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePrescriptionController = async (req, res, next) => {
  try {
    const prescription = await prescriptionService.updatePrescription(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_UPDATE,
      resourceType: 'Prescription',
      resourceId: req.params.id,
      patientId: prescription?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Prescription updated successfully.',
      data: prescription,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const finalizePrescriptionController = async (req, res, next) => {
  try {
    const prescription = await prescriptionService.finalizePrescription(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_FINALIZE,
      resourceType: 'Prescription',
      resourceId: req.params.id,
      patientId: prescription?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Prescription finalized successfully.',
      data: prescription,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const revisePrescriptionController = async (req, res, next) => {
  try {
    const { reason, ...updates } = req.body;
    const revision = await prescriptionService.reviseFinalizedPrescription(
      req.params.id,
      updates,
      reason,
      req.user,
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_REVISE,
      resourceType: 'Prescription',
      resourceId: revision?._id ?? req.params.id,
      patientId: revision?.patientProfile ?? null,
      reason: reason ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Prescription revised — a new version was created.',
      data: revision,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const copyPrescriptionController = async (req, res, next) => {
  try {
    const newDraft = await prescriptionService.copyPreviousPrescription(req.params.id, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_CREATE,
      resourceType: 'Prescription',
      resourceId: newDraft?._id,
      patientId: newDraft?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Prescription copied into a new draft successfully.',
      data: newDraft,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelPrescriptionController = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const cancelled = await prescriptionService.cancelPrescription(req.params.id, reason, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_UPDATE,
      resourceType: 'Prescription',
      resourceId: cancelled?._id,
      patientId: cancelled?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Prescription cancelled successfully.',
      data: cancelled,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const archivePrescriptionController = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const archived = await prescriptionService.archivePrescription(req.params.id, reason, req.user);

    return sendSuccess(res, {
      message: 'Prescription archived successfully.',
      data: archived,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePrescriptionController = async (req, res, next) => {
  try {
    const hardDelete = req.query.hardDelete === true || req.query.hardDelete === 'true';
    const result = await prescriptionService.deletePrescription(req.params.id, req.user, { hardDelete });

    await recordModification(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_UPDATE,
      resourceType: 'Prescription',
      resourceId: req.params.id,
      metadata: { deleted: true, hardDelete },
    });

    return sendSuccess(res, {
      message: result?.deletedPermanently
        ? 'Prescription permanently deleted from database.'
        : 'Prescription cancelled and discarded.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyPrescriptionTokenController = async (req, res, next) => {
  try {
    const verification = await prescriptionService.verifyPrescriptionByToken(req.params.token, req.user);
    return sendSuccess(res, {
      message: 'Prescription verification retrieved.',
      data: verification,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getFavoriteMedicinesController = async (req, res, next) => {
  try {
    const favorites = await prescriptionService.getDoctorFavoriteMedicines(req.user._id);
    return sendSuccess(res, {
      message: 'Favorite medicines retrieved successfully.',
      data: favorites,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const saveFavoriteMedicineController = async (req, res, next) => {
  try {
    const saved = await prescriptionService.saveDoctorFavoriteMedicine(req.user._id, req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Favorite medicine saved successfully.',
      data: saved,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPrescriptionPdfController = async (req, res, next) => {
  try {
    const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.user);
    const populated = await prescription.populate([
      { path: 'provider', select: 'name email role' },
      { path: 'delegatedStaff', select: 'name email role' },
      { path: 'patient', select: 'name email' },
      { path: 'patientProfile', select: 'patientId firstName lastName dateOfBirth gender phone bloodGroup' },
    ]);

    await recordFileAccess(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_PDF_DOWNLOAD,
      resourceType: 'Prescription',
      resourceId: populated?._id ?? req.params.id,
      patientId: populated?.patientProfile?._id ?? populated?.patientProfile ?? null,
    });
    await recordExport(req, {
      action: AUDIT_ACTIONS.PRESCRIPTION_PDF_DOWNLOAD,
      resourceType: 'Prescription',
      resourceId: populated?._id ?? req.params.id,
      patientId: populated?.patientProfile?._id ?? populated?.patientProfile ?? null,
    });

    const patientName = populated?.patientSnapshot?.name || populated?.patientProfile?.firstName || 'Patient';
    const dateStr = new Date(populated.prescriptionDate || Date.now()).toISOString().slice(0, 10);
    const filename = `Ash-Shafi_Prescription_${patientName.replace(/\s+/g, '_')}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    await generatePrescriptionPdf(populated, res);
  } catch (error) {
    return next(error);
  }
};
