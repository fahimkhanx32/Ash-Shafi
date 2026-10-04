/**
 * BET-19 checkpoint 1 — shared CSV/Excel import file parsing.
 *
 * Deliberately reuses two already-built dependency-free readers
 * rather than adding a third parsing implementation: `csvBufferToRows`
 * (new this checkpoint, `modules/exports/utils/csv.util.js`) and
 * `extractXlsx` (already built for BET-12.33's report-spreadsheet
 * extraction, `modules/reports/services/spreadsheet-extraction.service.js`).
 * Both already return the same `{ headers, rows }` shape, so this
 * file is only a thin MIME-type dispatch, not a third parser.
 */

import { csvBufferToRows } from '../../exports/utils/csv.util.js';
import { extractXlsx } from '../../reports/services/spreadsheet-extraction.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';

const CSV_MIME_TYPE = 'text/csv';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const parseImportFile = ({ buffer, mimeType }) => {
  if (mimeType === CSV_MIME_TYPE) {
    return csvBufferToRows(buffer);
  }

  if (mimeType === XLSX_MIME_TYPE) {
    const { headers, rows } = extractXlsx(buffer);
    return { headers, rows };
  }

  throw new AppError('Unsupported import file type. Upload a .csv or .xlsx file.', 400, {
    code: 'UNSUPPORTED_IMPORT_FILE_TYPE',
  });
};
