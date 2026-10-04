/**
 * BET-19 — Import constants. See `exports/constants/export.constants.js`
 * for the equivalent export-side catalog and the same "extend this
 * file, don't hardcode ad-hoc strings" discipline.
 */

export const IMPORT_ENTITY_TYPES = Object.freeze({
  PATIENTS: 'PATIENTS',
});

export const IMPORT_FILE_MIME_TYPES = Object.freeze({
  CSV: 'text/csv',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

export const MAX_IMPORT_ROWS = 2000;
