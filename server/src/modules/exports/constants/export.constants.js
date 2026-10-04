/**
 * BET-19 — Import/Export & Data Interoperability constants.
 *
 * Fixed catalogs, same "extend this file, don't hardcode ad-hoc
 * strings at call sites" discipline `audit/audit.constants.js`
 * (BET-17) already established.
 */

export const EXPORT_FORMATS = Object.freeze({
  CSV: 'CSV',
  XLSX: 'XLSX',
  PDF: 'PDF',
  JSON: 'JSON',
});

/**
 * Every format `GET /api/v1/exports/:entityType` accepts. Named
 * "tabular" because all four ultimately render the same row/column
 * shape (CSV/XLSX/JSON as literal rows-and-columns; PDF as a
 * rendered table) — as opposed to the single-record, richer-layout
 * "Medical-record export" checkpoint, which is a different route.
 */
export const TABULAR_EXPORT_FORMATS = Object.freeze([
  EXPORT_FORMATS.CSV,
  EXPORT_FORMATS.XLSX,
  EXPORT_FORMATS.PDF,
  EXPORT_FORMATS.JSON,
]);

/**
 * Every entity type this checkpoint's tabular (CSV/XLSX) bulk
 * export supports. Deliberately a short, real list rather than a
 * generic "export any Mongoose model" endpoint — master prompt §79
 * ("no fake/placeholder functionality") — each entry here has a
 * genuine row-mapper in `entity-export.service.js` reusing an
 * existing, already-permission-checked domain list function, not a
 * raw unfiltered collection dump.
 */
export const EXPORT_ENTITY_TYPES = Object.freeze({
  PATIENTS: 'PATIENTS',
  ENCOUNTERS: 'ENCOUNTERS',
  PRESCRIPTIONS: 'PRESCRIPTIONS',
  INVESTIGATIONS: 'INVESTIGATIONS',
});

/** Human-readable label per entity type, used for the PDF export's title. */
export const EXPORT_ENTITY_TYPE_LABELS = Object.freeze({
  [EXPORT_ENTITY_TYPES.PATIENTS]: 'Patients',
  [EXPORT_ENTITY_TYPES.ENCOUNTERS]: 'Encounters',
  [EXPORT_ENTITY_TYPES.PRESCRIPTIONS]: 'Prescriptions',
  [EXPORT_ENTITY_TYPES.INVESTIGATIONS]: 'Investigations',
});

/**
 * The permission each entity type's *bulk list* export requires —
 * intentionally the exact same permission the native REST list
 * endpoint for that entity already requires (same principle FHIR's
 * `fhir.routes.js` already established: an interoperability surface
 * never grants wider access than this project's own native routes
 * grant for the same data).
 */
export const EXPORT_ENTITY_PERMISSION = Object.freeze({
  [EXPORT_ENTITY_TYPES.PATIENTS]: 'patients:read',
  [EXPORT_ENTITY_TYPES.ENCOUNTERS]: 'medical_records:read',
  [EXPORT_ENTITY_TYPES.PRESCRIPTIONS]: 'prescriptions:read',
  [EXPORT_ENTITY_TYPES.INVESTIGATIONS]: 'investigations:read',
});

export const MAX_TABULAR_EXPORT_ROWS = 5000;

export const EXPORT_JOB_STATUSES = Object.freeze({
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

/**
 * BET-19 checkpoint 2 — "Controlled export": how long a generated
 * medical-record package's single-use download token stays valid
 * before `ExportRequest`'s TTL index removes it. Short enough that a
 * stale, forgotten-about link doesn't stay a live way to pull a
 * patient's full record long after the requester's session/need for
 * it has passed — the same "time-limited where appropriate" clause
 * master prompt §52 asks for explicitly.
 */
export const CONTROLLED_EXPORT_TOKEN_TTL_MINUTES = 15;

export const MEDICAL_RECORD_EXPORT_FORMATS = Object.freeze([
  EXPORT_FORMATS.PDF,
  EXPORT_FORMATS.JSON,
]);
