/**
 * BET-19 — Diagnostic/report mapping: this project's own
 * `MedicalReport` (`modules/reports/models/medical-report.model.js`)
 * → FHIR R4 `DiagnosticReport`, with its structured `parameters[]`
 * additionally exposed as FHIR `Observation` resources (a
 * `DiagnosticReport` references its `Observation`s by id; it does
 * not embed their values inline — this is FHIR's own standard
 * shape, not an Ash-Shāfī-specific split).
 *
 * `mapMedicalReportToFhir` therefore returns `{ diagnosticReport,
 * observations }` rather than a single resource — the same
 * documented one-to-many exception `medication-request.mapper.js`
 * already established for `MedicationRequest`, just with a named
 * object instead of a bare array since two distinct resource types
 * are involved here, not N of the same type.
 */

import { fhirMeta, buildReference, buildCodeableConcept, buildIdentifier } from '../utils/fhir-builder.util.js';
import { FHIR_CODE_SYSTEMS, ASHSHAFI_BASE_URI } from '../constants/fhir.constants.js';

// `REPORT_STATUSES` (upload → ... → finalized/amended/rejected/
// cancelled) is a workflow-lifecycle enum, richer than FHIR's fixed
// `diagnostic-report-status` value set — mapped down deliberately,
// not 1:1, the same reasoning `encounter.mapper.js`'s STATUS_MAP
// documents for its own richer source enum.
const STATUS_MAP = Object.freeze({
  UPLOADED: 'registered',
  PROCESSING: 'partial',
  EXTRACTED: 'partial',
  NEEDS_REVIEW: 'partial',
  EXTRACTION_FAILED: 'partial',
  VERIFIED: 'preliminary',
  FINALIZED: 'final',
  AMENDED: 'amended',
  REJECTED: 'cancelled',
  CANCELLED: 'cancelled',
});

// `ABNORMAL_FLAGS` → FHIR's `observation-interpretation` codes
// (v3 ObservationInterpretation, referenced verbatim by
// FHIR's own DiagnosticReport/Observation examples).
const INTERPRETATION_MAP = Object.freeze({
  NORMAL: { code: 'N', display: 'Normal' },
  LOW: { code: 'L', display: 'Low' },
  HIGH: { code: 'H', display: 'High' },
  CRITICAL_LOW: { code: 'LL', display: 'Critical low' },
  CRITICAL_HIGH: { code: 'HH', display: 'Critical high' },
  ABNORMAL: { code: 'A', display: 'Abnormal' },
  UNKNOWN: null,
});

const OBSERVATION_INTERPRETATION_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';

const buildParameterObservation = (report, parameter) => {
  const interpretation = INTERPRETATION_MAP[parameter.abnormalFlag];

  // A numeric result gets `valueQuantity` (FHIR's preferred shape
  // for anything genuinely measurable); a non-numeric one (e.g.
  // "Positive"/"Negative"/free text) gets `valueString` instead —
  // never coerced into a fabricated numeric value.
  const value =
    typeof parameter.numericValue === 'number'
      ? { valueQuantity: { value: parameter.numericValue, unit: parameter.unit || undefined } }
      : parameter.value
        ? { valueString: parameter.value }
        : {};

  return {
    resourceType: 'Observation',
    id: `${report._id}-${parameter._id}`,
    meta: fhirMeta(),
    status: parameter.verification?.status === 'REJECTED' ? 'cancelled' : 'final',
    code: buildCodeableConcept({ text: parameter.name }),
    subject: buildReference({ resourceType: 'Patient', id: String(report.patientProfile) }),
    ...value,
    ...(parameter.referenceRange
      ? { referenceRange: [{ text: parameter.referenceRange }] }
      : {}),
    ...(interpretation
      ? {
          interpretation: [
            buildCodeableConcept({
              system: OBSERVATION_INTERPRETATION_SYSTEM,
              code: interpretation.code,
              display: interpretation.display,
            }),
          ],
        }
      : {}),
    ...(parameter.specimenType ? { specimen: { display: parameter.specimenType } } : {}),
    // `extraction`/`verification.correctionReason` are this project's
    // own OCR-provenance/correction-audit fields (master prompt
    // §BET-12.15/12.16) — real and important, but internal workflow
    // detail with no FHIR `Observation` element; not carried over,
    // same "don't force-fit" rule every mapper here follows.
  };
};

/**
 * @param {import('mongoose').Document} report - a `MedicalReport` document
 * @returns {{ diagnosticReport: object, observations: object[] }}
 */
export const mapMedicalReportToFhir = (report) => {
  if (!report) {
    throw new TypeError('mapMedicalReportToFhir requires a MedicalReport document.');
  }

  const observations = Array.isArray(report.parameters)
    ? report.parameters.map((p) => buildParameterObservation(report, p))
    : [];

  const identifier = buildIdentifier({
    system: `${ASHSHAFI_BASE_URI}/identifier/report-reference`,
    value: report.reportReference,
    use: 'usual',
  });

  const diagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: String(report._id),
    meta: fhirMeta(),
    ...(identifier ? { identifier: [identifier] } : {}),
    status: STATUS_MAP[report.status] || 'unknown',
    code: buildCodeableConcept({ text: report.title }),
    subject: buildReference({ resourceType: 'Patient', id: String(report.patientProfile) }),
    ...(report.orderingDoctor
      ? {
          performer: [
            buildReference({ resourceType: 'Practitioner', id: String(report.orderingDoctor) }),
          ],
        }
      : {}),
    effectiveDateTime: report.reportDate
      ? new Date(report.reportDate).toISOString()
      : report.uploadDate
        ? new Date(report.uploadDate).toISOString()
        : undefined,
    issued: report.finalizedAt
      ? new Date(report.finalizedAt).toISOString()
      : new Date(report.uploadDate || Date.now()).toISOString(),
    category: [
      buildCodeableConcept({
        system: FHIR_CODE_SYSTEMS.DIAGNOSTIC_REPORT_STATUS,
        code: report.reportType,
        text: report.reportType,
      }),
    ],
    ...(observations.length > 0
      ? {
          result: observations.map((o) =>
            buildReference({ resourceType: 'Observation', id: o.id }),
          ),
        }
      : {}),
    ...(report.interpretation && report.interpretation.trim().length > 0
      ? { conclusion: report.interpretation }
      : {}),
    // `structuredSections` (imaging findings, Pap-smear adequacy,
    // etc.) is deliberately `Mixed`-shaped per-report-type free
    // structure on the source model itself (see the model's own
    // docstring) — no single FHIR element captures it faithfully
    // across every `reportType`, so it is not force-mapped here;
    // `conclusion` above already carries the clinician-authored
    // free-text interpretation, which is the genuinely portable part.
  };

  return { diagnosticReport, observations };
};
