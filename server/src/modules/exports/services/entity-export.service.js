/**
 * BET-19 — Import/Export & Data Interoperability: entity-export
 * layer.
 *
 * Same principle `fhir.service.js` (BET-19's other half, built
 * earlier this checkpoint sequence) already established for FHIR:
 * this deliberately never queries a Mongoose model directly for the
 * *broad/list* case — it reuses the exact same service function the
 * REST-native list endpoint already calls
 * (`listPatientProfiles`, `listEncountersByPatientProfileId`,
 * `listPrescriptionsByPatientProfileId`, `listInvestigations`), so a
 * CSV/Excel export can never see a wider or differently-filtered
 * slice of data than this project's own dashboard already shows the
 * same caller. Row shape (which fields are included, in which
 * order) is this file's own concern; *which records* are visible at
 * all is always decided by the reused domain service.
 */

import { AppError } from '../../../middlewares/error.middleware.js';
import { listPatientProfiles } from '../../patients/services/patient.service.js';
import { listEncountersByPatientProfileId } from '../../encounters/services/encounter.service.js';
import { listPrescriptionsByPatientProfileId } from '../../prescriptions/services/prescription.service.js';
import { listInvestigations } from '../../investigations/services/investigation.service.js';
import { EXPORT_ENTITY_TYPES, MAX_TABULAR_EXPORT_ROWS } from '../constants/export.constants.js';

const dateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const dateTime = (value) => (value ? new Date(value).toISOString() : '');

// --- Column definitions -----------------------------------------
// One ordered list per entity type, shared by the CSV writer, the
// XLSX writer, and the PDF table renderer (checkpoint 2) — every
// export format for a given entity type shows the exact same fields
// in the exact same order, so a caller comparing a CSV export
// against a PDF export of the same data sees them agree.

export const PATIENT_EXPORT_COLUMNS = Object.freeze([
  { key: 'patientId', label: 'Patient ID' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'gender', label: 'Gender' },
  { label: 'Date of Birth', get: (r) => dateOnly(r.dateOfBirth) },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'phone', label: 'Phone' },
  { label: 'Email', get: (r) => r.user?.email || '' },
  { key: 'patientStatus', label: 'Status' },
  { label: 'Registration Date', get: (r) => dateOnly(r.registrationDate) },
  { label: 'Primary Care Provider', get: (r) => r.primaryCareProvider?.name || '' },
]);

export const ENCOUNTER_EXPORT_COLUMNS = Object.freeze([
  { label: 'Encounter ID', get: (r) => String(r._id) },
  { label: 'Date', get: (r) => dateOnly(r.encounterDate) },
  { key: 'status', label: 'Status' },
  { label: 'Provider', get: (r) => r.provider?.name || '' },
  { key: 'chiefComplaint', label: 'Chief Complaint' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'treatmentPlan', label: 'Treatment Plan' },
  { label: 'Finalized At', get: (r) => dateTime(r.finalizedAt) },
]);

export const PRESCRIPTION_EXPORT_COLUMNS = Object.freeze([
  { label: 'Prescription ID', get: (r) => String(r._id) },
  { label: 'Date', get: (r) => dateOnly(r.prescriptionDate) },
  { key: 'status', label: 'Status' },
  { label: 'Provider', get: (r) => r.provider?.name || '' },
  {
    label: 'Items',
    get: (r) =>
      (r.items || [])
        .map((item) =>
          [item.genericName, item.strength, item.frequency].filter(Boolean).join(' '),
        )
        .join('; '),
  },
  { key: 'diagnosisSummary', label: 'Diagnosis Summary' },
  { label: 'Version', get: (r) => r.versionNumber },
]);

export const INVESTIGATION_EXPORT_COLUMNS = Object.freeze([
  { label: 'Investigation ID', get: (r) => String(r._id) },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { label: 'Ordered Date', get: (r) => dateOnly(r.orderedDate) },
  { label: 'Ordered By', get: (r) => r.orderedBy?.name || String(r.orderedBy || '') },
  { key: 'clinicalIndication', label: 'Clinical Indication' },
]);

export const ENTITY_EXPORT_COLUMNS = Object.freeze({
  [EXPORT_ENTITY_TYPES.PATIENTS]: PATIENT_EXPORT_COLUMNS,
  [EXPORT_ENTITY_TYPES.ENCOUNTERS]: ENCOUNTER_EXPORT_COLUMNS,
  [EXPORT_ENTITY_TYPES.PRESCRIPTIONS]: PRESCRIPTION_EXPORT_COLUMNS,
  [EXPORT_ENTITY_TYPES.INVESTIGATIONS]: INVESTIGATION_EXPORT_COLUMNS,
});

/**
 * Resolves the row set for a bulk (CSV/XLSX/PDF-table) export.
 *
 * @param {string} entityType - one of `EXPORT_ENTITY_TYPES`
 * @param {object} filters - `patientProfileId` plus a small set of
 *   entity-specific filters, all forwarded verbatim to the reused
 *   domain list function so its own validation/authorization runs
 *   exactly as it does for the native REST list endpoint.
 * @param {object} actor - the authenticated caller (`req.user`),
 *   forwarded to `listInvestigations` for its built-in
 *   sensitive-record role scoping.
 */
export const resolveExportRows = async (entityType, filters, actor) => {
  switch (entityType) {
    case EXPORT_ENTITY_TYPES.PATIENTS: {
      const { profiles } = await listPatientProfiles({
        ...filters,
        page: 1,
        limit: MAX_TABULAR_EXPORT_ROWS,
      });
      return profiles;
    }

    case EXPORT_ENTITY_TYPES.ENCOUNTERS: {
      if (!filters.patientProfileId) {
        throw new AppError(
          'A "patientProfileId" is required to export encounters.',
          400,
          { code: 'PATIENT_PROFILE_ID_REQUIRED' },
        );
      }
      const encounters = await listEncountersByPatientProfileId(filters.patientProfileId);
      return encounters.slice(0, MAX_TABULAR_EXPORT_ROWS);
    }

    case EXPORT_ENTITY_TYPES.PRESCRIPTIONS: {
      if (!filters.patientProfileId) {
        throw new AppError(
          'A "patientProfileId" is required to export prescriptions.',
          400,
          { code: 'PATIENT_PROFILE_ID_REQUIRED' },
        );
      }
      const prescriptions = await listPrescriptionsByPatientProfileId(filters.patientProfileId);
      return prescriptions.slice(0, MAX_TABULAR_EXPORT_ROWS);
    }

    case EXPORT_ENTITY_TYPES.INVESTIGATIONS: {
      const { items } = await listInvestigations(
        {
          patientProfileId: filters.patientProfileId,
          category: filters.category,
          status: filters.status,
          search: filters.search,
          page: 1,
          limit: MAX_TABULAR_EXPORT_ROWS,
        },
        actor,
      );
      return items;
    }

    default:
      throw new AppError(`Unsupported export entity type "${entityType}".`, 400, {
        code: 'UNSUPPORTED_EXPORT_ENTITY',
      });
  }
};
