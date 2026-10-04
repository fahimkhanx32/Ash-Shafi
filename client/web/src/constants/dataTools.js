/**
 * FET-21 — Analytics, Reporting & Import/Export.
 *
 * Mirrors `server/src/modules/exports/constants/export.constants.js`
 * and `server/src/modules/imports/constants/import.constants.js`.
 * Kept as plain data (not derived from a live endpoint) since these
 * are fixed catalogs on the backend too — same "extend this file,
 * don't hardcode ad-hoc strings" discipline every other constants
 * file in this project follows.
 */

export const EXPORT_FORMATS = Object.freeze({
  CSV: 'CSV',
  XLSX: 'XLSX',
  PDF: 'PDF',
  JSON: 'JSON',
});

export const TABULAR_EXPORT_FORMATS = [
  EXPORT_FORMATS.CSV,
  EXPORT_FORMATS.XLSX,
  EXPORT_FORMATS.PDF,
  EXPORT_FORMATS.JSON,
];

export const MEDICAL_RECORD_EXPORT_FORMATS = [EXPORT_FORMATS.PDF, EXPORT_FORMATS.JSON];

export const EXPORT_ENTITY_TYPES = Object.freeze({
  PATIENTS: 'PATIENTS',
  ENCOUNTERS: 'ENCOUNTERS',
  PRESCRIPTIONS: 'PRESCRIPTIONS',
  INVESTIGATIONS: 'INVESTIGATIONS',
});

export const EXPORT_ENTITY_TYPE_LABELS = Object.freeze({
  [EXPORT_ENTITY_TYPES.PATIENTS]: 'Patients',
  [EXPORT_ENTITY_TYPES.ENCOUNTERS]: 'Encounters',
  [EXPORT_ENTITY_TYPES.PRESCRIPTIONS]: 'Prescriptions',
  [EXPORT_ENTITY_TYPES.INVESTIGATIONS]: 'Investigations',
});

// Filter fields the tabular-export query accepts, per entity type —
// mirrors `tabularExportQuerySchema` (`export.validation.js`). Drives
// which filter inputs `ExportTab.jsx` renders for the selected entity,
// so a `category`/`status` field never shows up for an entity type
// the backend would just ignore it on.
export const EXPORT_ENTITY_FILTER_FIELDS = Object.freeze({
  [EXPORT_ENTITY_TYPES.PATIENTS]: ['search', 'patientStatus', 'gender'],
  [EXPORT_ENTITY_TYPES.ENCOUNTERS]: ['patientProfileId', 'status', 'search'],
  [EXPORT_ENTITY_TYPES.PRESCRIPTIONS]: ['patientProfileId', 'status', 'search'],
  [EXPORT_ENTITY_TYPES.INVESTIGATIONS]: ['patientProfileId', 'category', 'status', 'search'],
});

export const MAX_TABULAR_EXPORT_ROWS = 5000;

export const CONTROLLED_EXPORT_TOKEN_TTL_MINUTES = 15;

export const IMPORT_FILE_ACCEPT = '.csv,.xlsx';

export const MAX_IMPORT_ROWS = 2000;

// Mirrors `PATIENT_IMPORT_COLUMNS` (`patient-import.service.js`) —
// shown to the user as the expected header row before they upload,
// since a mismatched header silently produces empty fields rather
// than a clear error (the backend maps by header name, not position).
export const PATIENT_IMPORT_COLUMNS = [
  'firstName',
  'lastName',
  'email',
  'username',
  'gender',
  'dateOfBirth',
  'phone',
  'alternatePhone',
  'bloodGroup',
  'nationality',
];
