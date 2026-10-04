/**
 * BET-19 — FHIR-ready architecture: fixed identifier-system URIs.
 *
 * FHIR resources identify things (a patient record number, a
 * practitioner's registration number) with a `system` URI plus a
 * `value`, not a bare string — the system tells a receiving FHIR
 * server *which* identifier scheme the value belongs to. These are
 * defined once, here, so every mapper in this module references the
 * same URIs rather than each inventing its own ad-hoc string
 * (exactly the kind of drift that makes a "FHIR-ready" architecture
 * not actually interoperable in practice).
 *
 * `ASHSHAFI_BASE_URI` is a placeholder, organization-owned URI —
 * FHIR's own convention (a URN or a URL the organization controls,
 * not necessarily a resolvable endpoint) — used to namespace this
 * clinic's own internal identifiers (`patientId`, `employeeId`) when
 * they appear inside a FHIR resource. It is not a real deployed
 * FHIR server base URL; this project does not operate one.
 */

export const ASHSHAFI_BASE_URI = 'https://ash-shafi.example/fhir';

export const FHIR_IDENTIFIER_SYSTEMS = Object.freeze({
  // This clinic's own human-friendly sequential patient ID
  // (`PatientProfile.patientId`, e.g. "PT-000123").
  PATIENT_ID: `${ASHSHAFI_BASE_URI}/identifier/patient-id`,
  // This clinic's own human-friendly sequential staff ID
  // (`StaffProfile.employeeId`).
  EMPLOYEE_ID: `${ASHSHAFI_BASE_URI}/identifier/employee-id`,
  // The doctor's professional registration number
  // (`StaffProfile.doctorDetails.registrationNumber` — e.g. a BM&DC
  // number; the exact registering body is jurisdiction-dependent,
  // see that field's own docstring). FHIR's standard system for a
  // generic national practitioner identifier when the specific
  // registry isn't itself modeled as a FHIR NamingSystem.
  PRACTITIONER_LICENSE: `${ASHSHAFI_BASE_URI}/identifier/practitioner-license`,
  // A national ID number, when present
  // (`PatientProfile.nationalIdNumber`).
  NATIONAL_ID: `${ASHSHAFI_BASE_URI}/identifier/national-id`,
});

// FHIR R4's own fixed code system URIs (not this project's own — these
// are the actual HL7-published URIs every FHIR resource of this shape
// uses, reused verbatim so output resources validate against real
// FHIR terminology, not a private vocabulary).
export const FHIR_CODE_SYSTEMS = Object.freeze({
  ADMINISTRATIVE_GENDER: 'http://hl7.org/fhir/administrative-gender',
  CONTACT_POINT_SYSTEM: 'http://hl7.org/fhir/contact-point-system',
  CONTACT_POINT_USE: 'http://hl7.org/fhir/contact-point-use',
  ENCOUNTER_STATUS: 'http://hl7.org/fhir/encounter-status',
  ENCOUNTER_CLASS: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  MEDICATION_REQUEST_STATUS: 'http://hl7.org/fhir/CodeSystem/medicationrequest-status',
  MEDICATION_REQUEST_INTENT: 'http://hl7.org/fhir/CodeSystem/medicationrequest-intent',
  OBSERVATION_STATUS: 'http://hl7.org/fhir/observation-status',
  DIAGNOSTIC_REPORT_STATUS: 'http://hl7.org/fhir/diagnostic-report-status',
  CONDITION_CLINICAL_STATUS: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
  ISSUE_SEVERITY: 'http://hl7.org/fhir/issue-severity',
  ISSUE_TYPE: 'http://hl7.org/fhir/issue-type',
});

export const FHIR_VERSION = '4.0.1'; // FHIR R4
