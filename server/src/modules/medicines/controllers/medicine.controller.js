import * as medicineService from '../services/medicine.service.js';
import { importMedicines } from '../services/medicine-import.service.js';
import { parseCsv } from '../services/medicine-import.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';
import { AppError } from '../../../middlewares/error.middleware.js';

export const createMedicineController = async (req, res, next) => {
  try {
    const medicine = await medicineService.createMedicine(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.MEDICINE_CREATE,
      resourceType: 'Medicine',
      resourceId: medicine?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Medicine created successfully.',
      data: medicine,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMedicineController = async (req, res, next) => {
  try {
    const medicine = await medicineService.getMedicineById(req.params.id);
    return sendSuccess(res, {
      message: 'Medicine retrieved successfully.',
      data: medicine,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listMedicinesController = async (req, res, next) => {
  try {
    const { items, pagination } = await medicineService.listMedicines(req.query, req.user.role);
    return sendPaginated(res, {
      message: 'Medicines retrieved successfully.',
      items,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMedicineController = async (req, res, next) => {
  try {
    const medicine = await medicineService.updateMedicine(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.MEDICINE_UPDATE,
      resourceType: 'Medicine',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Medicine updated successfully.',
      data: medicine,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deactivateMedicineController = async (req, res, next) => {
  try {
    const medicine = await medicineService.deactivateMedicine(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.MEDICINE_DEACTIVATE,
      resourceType: 'Medicine',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Medicine deactivated successfully.',
      data: medicine,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const reactivateMedicineController = async (req, res, next) => {
  try {
    const medicine = await medicineService.reactivateMedicine(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.MEDICINE_REACTIVATE,
      resourceType: 'Medicine',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Medicine reactivated successfully.',
      data: medicine,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const softDeleteMedicineController = async (req, res, next) => {
  try {
    const medicine = await medicineService.softDeleteMedicine(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.MEDICINE_DEACTIVATE,
      resourceType: 'Medicine',
      resourceId: req.params.id,
      metadata: { type: 'SOFT_DELETE' },
    });

    return sendSuccess(res, {
      message: 'Medicine deleted (archived) successfully.',
      data: medicine,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const hardDeleteMedicineController = async (req, res, next) => {
  try {
    const result = await medicineService.hardDeleteMedicine(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.MEDICINE_DEACTIVATE,
      resourceType: 'Medicine',
      resourceId: req.params.id,
      metadata: { type: 'HARD_DELETE' },
    });

    return sendSuccess(res, {
      message: 'Medicine permanently deleted from database.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const restoreMedicineController = async (req, res, next) => {
  try {
    const medicine = await medicineService.restoreMedicine(req.params.id, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.MEDICINE_REACTIVATE,
      resourceType: 'Medicine',
      resourceId: req.params.id,
      metadata: { type: 'RESTORE' },
    });

    return sendSuccess(res, {
      message: 'Medicine restored successfully.',
      data: medicine,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};


export const autocompleteMedicinesController = async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const items = await medicineService.autocompleteMedicines(q, limit);
    return sendSuccess(res, {
      message: 'Medicine suggestions retrieved successfully.',
      data: items,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Bulk import — accepts EITHER a JSON body `{ origin, sourceVersion,
 * records: [...] }` OR a multipart file upload (`file`, field name
 * matches this module's route) containing CSV or JSON text, parsed
 * here before handing rows to the same `importMedicines` pipeline.
 * Restricted to SOFTWARE_OWNER/SUPER_ADMIN inside the service layer —
 * see `medicine-import.service.js#assertCanImportMedicines` — mirroring
 * the hard-delete/restore pattern already used elsewhere in this
 * controller for admin-tier-only operations.
 */
export const importMedicinesController = async (req, res, next) => {
  try {
    let { records } = req.body || {};
    const origin = req.body?.origin || 'DGDA import';
    const sourceVersion = req.body?.sourceVersion || '';

    if (req.file) {
      const text = req.file.buffer.toString('utf8');
      const isJsonFile = /\.json$/i.test(req.file.originalname || '') || req.file.mimetype === 'application/json';
      if (isJsonFile) {
        try {
          const parsed = JSON.parse(text);
          records = Array.isArray(parsed) ? parsed : parsed?.records;
        } catch (err) {
          throw new AppError('Uploaded file is not valid JSON.', 400, { code: 'INVALID_IMPORT_FILE' });
        }
      } else {
        records = parseCsv(text);
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new AppError('No import records found in the request body or uploaded file.', 400, {
        code: 'EMPTY_IMPORT',
      });
    }

    const stats = await importMedicines(records, { origin, sourceVersion }, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.MEDICINE_IMPORT,
      resourceType: 'Medicine',
      resourceId: null,
      metadata: { origin, sourceVersion, ...stats, errors: undefined },
    });

    return sendSuccess(res, {
      message: 'Medicine database import completed.',
      data: stats,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
