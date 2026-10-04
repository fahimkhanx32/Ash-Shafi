/**
 * BET-19 checkpoint 1 — CSV / Excel / PDF / JSON export orchestration.
 *
 * Deliberately thin: `entity-export.service.js` decides *which
 * records* are visible (by reusing existing, already-authorized
 * domain list functions); this file only turns that already-scoped
 * row set into a file buffer, using the column definitions the
 * former also owns so every format renders identical fields.
 */

import { resolveExportRows, ENTITY_EXPORT_COLUMNS } from './entity-export.service.js';
import { objectsToCsvBuffer } from '../utils/csv.util.js';
import { objectsToXlsxBuffer } from '../utils/xlsx-writer.util.js';
import { generateTablePdfBuffer } from '../utils/pdf-table.util.js';
import { objectsToJsonBuffer } from '../utils/json.util.js';
import { EXPORT_FORMATS, EXPORT_ENTITY_TYPE_LABELS } from '../constants/export.constants.js';
import { AppError } from '../../../middlewares/error.middleware.js';

const timestampSlug = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * @param {string} entityType - one of `EXPORT_ENTITY_TYPES`
 * @param {string} format - one of `EXPORT_FORMATS`
 * @param {object} filters
 * @param {object} actor - `req.user`
 * @returns {Promise<{ buffer: Buffer, filename: string, mimeType: string, recordCount: number }>}
 */
export const exportEntityAsTabular = async (entityType, format, filters, actor) => {
  const columns = ENTITY_EXPORT_COLUMNS[entityType];

  if (!columns) {
    throw new AppError(`Unsupported export entity type "${entityType}".`, 400, {
      code: 'UNSUPPORTED_EXPORT_ENTITY',
    });
  }

  const rows = await resolveExportRows(entityType, filters, actor);
  const baseName = `${entityType.toLowerCase()}-export-${timestampSlug()}`;

  if (format === EXPORT_FORMATS.CSV) {
    return {
      buffer: objectsToCsvBuffer(rows, columns),
      filename: `${baseName}.csv`,
      mimeType: 'text/csv',
      recordCount: rows.length,
    };
  }

  if (format === EXPORT_FORMATS.XLSX) {
    return {
      buffer: objectsToXlsxBuffer(rows, columns, entityType.slice(0, 31)),
      filename: `${baseName}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      recordCount: rows.length,
    };
  }

  if (format === EXPORT_FORMATS.JSON) {
    return {
      buffer: objectsToJsonBuffer(rows, columns),
      filename: `${baseName}.json`,
      mimeType: 'application/json',
      recordCount: rows.length,
    };
  }

  if (format === EXPORT_FORMATS.PDF) {
    const buffer = await generateTablePdfBuffer({
      title: `${EXPORT_ENTITY_TYPE_LABELS[entityType] || entityType} export`,
      subtitle: `Generated ${new Date().toLocaleString('en-GB')} • ${rows.length} record(s)`,
      headers: columns.map((column) => column.label),
      rows: rows.map((record) =>
        columns.map((column) => (column.get ? column.get(record) : record[column.key])),
      ),
    });

    return {
      buffer,
      filename: `${baseName}.pdf`,
      mimeType: 'application/pdf',
      recordCount: rows.length,
    };
  }

  throw new AppError(`Unsupported tabular export format "${format}".`, 400, {
    code: 'UNSUPPORTED_EXPORT_FORMAT',
  });
};
