import { AppError } from '../../../middlewares/error.middleware.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { parseImportFile } from '../services/import-file-parser.service.js';
import {
  mapRowsToPatientRecords,
  importPatientRecords,
} from '../services/patient-import.service.js';
import { MAX_IMPORT_ROWS } from '../constants/import.constants.js';
import { recordCreation } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

/**
 * BET-19 checkpoint 1 — `POST /api/v1/imports/patients`
 *
 * Accepts a single `.csv` or `.xlsx` file (field name `file`, same
 * `multipart/form-data` convention `reports/routes/report.routes.js`
 * already uses for document uploads) and bulk-creates patient
 * accounts from it. Every row is processed independently — see
 * `patient-import.service.js`'s docstring for the full contract —
 * so the response always reports per-row outcomes rather than an
 * all-or-nothing success/failure.
 */
export const importPatientsController = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('A file is required (field name "file").', 400, {
        code: 'IMPORT_FILE_REQUIRED',
      });
    }

    const parsed = parseImportFile({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    if (parsed.rows.length === 0) {
      throw new AppError('The uploaded file contains no data rows.', 400, {
        code: 'IMPORT_FILE_EMPTY',
      });
    }

    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      throw new AppError(
        `The uploaded file has ${parsed.rows.length} rows, which exceeds the ${MAX_IMPORT_ROWS}-row limit per import. Split the file and import in batches.`,
        400,
        { code: 'IMPORT_FILE_TOO_LARGE' },
      );
    }

    const records = mapRowsToPatientRecords(parsed);
    const summary = await importPatientRecords(records, req.user._id);

    // "Export audit logging" checkpoint's import-side counterpart —
    // bulk record creation, so it goes through the same
    // `RECORD_CREATE`-category writer every other creation event in
    // this project uses (`recordCreation`), not a bespoke one.
    await recordCreation(req, {
      action: AUDIT_ACTIONS.PATIENT_BULK_IMPORT,
      resourceType: 'PATIENT',
      metadata: {
        fileMimeType: req.file.mimetype,
        totalRows: summary.totalRows,
        createdCount: summary.createdCount,
        failedCount: summary.failedCount,
      },
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: `Import complete: ${summary.createdCount} of ${summary.totalRows} patient(s) created.`,
      data: summary,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
