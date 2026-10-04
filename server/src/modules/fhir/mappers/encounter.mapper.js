/**
 * BET-19 — Encounter mapping: this project's own `Encounter`
 * (`modules/encounters/models/encounter.model.js`) → FHIR R4
 * `Encounter`.
 *
 * `Encounter` here is intentionally narrow, the same discipline
 * `patient.mapper.js`/`practitioner.mapper.js` already established:
 * only fields with a genuine FHIR `Encounter` home are mapped.
 * Clinical content that FHIR models as its *own* resource type
 * (diagnoses → `Condition`, vitals/findings → `Observation`) is
 * covered separately, later in this same checkpoint
 * (`diagnoses` are summarized here as `Encounter.diagnosis` per
 * FHIR's own shape — a back-reference + rank — since FHIR's
 * `Encounter.diagnosis` element exists precisely for this, but the
 * full clinical detail (vitals, findings, assessment, treatment
 * plan) has no `Encounter` element and belongs to
 * `clinical-record.mapper.js`, not duplicated here).
 */

import { fhirMeta, buildReference, buildCodeableConcept } from '../utils/fhir-builder.util.js';
import { FHIR_CODE_SYSTEMS } from '../constants/fhir.constants.js';

// FHIR R4's fixed `encounter-status` value set. This project's own
// two-value `ENCOUNTER_STATUSES` (`DRAFT`/`FINALIZED`) is a workflow
// state for note-editing purposes (see `encounter.model.js`'s own
// docstring), not a clinical encounter-progress status — the two
// don't line up 1:1, so this is a deliberate, documented mapping
// rather than a literal enum reuse.
const STATUS_MAP = Object.freeze({
  DRAFT: 'in-progress',
  FINALIZED: 'finished',
});

// FHIR's `Encounter.class` is a required, fixed-vocabulary element
// (v3 ActCode: AMB=ambulatory, IMP=inpatient, EMER=emergency, ...).
// This project has no inpatient/emergency encounter concept anywhere
// in its data model (every consultation is an outpatient clinic
// visit or a telemedicine video consultation — see BET-14) — so
// every mapped Encounter is fixed to `AMB` (ambulatory), the correct
// FHIR code for both in-person and virtual outpatient visits. This
// is not a placeholder; it is the accurate value for what this
// system actually models.
const ENCOUNTER_CLASS = buildCodeableConcept({
  system: FHIR_CODE_SYSTEMS.ENCOUNTER_CLASS,
  code: 'AMB',
  display: 'ambulatory',
});

/**
 * @param {import('mongoose').Document} encounter - an `Encounter` document
 * @returns {object} FHIR R4 Encounter resource
 */
export const mapEncounterToFhir = (encounter) => {
  if (!encounter) {
    throw new TypeError('mapEncounterToFhir requires an Encounter document.');
  }

  const diagnosis =
    Array.isArray(encounter.diagnoses) && encounter.diagnoses.length > 0
      ? encounter.diagnoses.map((d, index) => ({
          condition: { text: d.description },
          use: buildCodeableConcept({
            system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
            code: d.type === 'PRIMARY' ? 'AD' : 'DD',
            display: d.type === 'PRIMARY' ? 'Admission diagnosis' : 'Discharge diagnosis',
          }),
          rank: index + 1,
        }))
      : undefined;

  const reasonCode =
    encounter.chiefComplaint && encounter.chiefComplaint.trim().length > 0
      ? [buildCodeableConcept({ text: encounter.chiefComplaint })]
      : undefined;

  return {
    resourceType: 'Encounter',
    id: String(encounter._id),
    meta: fhirMeta(),
    status: STATUS_MAP[encounter.status] || 'unknown',
    class: ENCOUNTER_CLASS,
    subject: buildReference({ resourceType: 'Patient', id: String(encounter.patientProfile) }),
    participant: [
      {
        individual: buildReference({ resourceType: 'Practitioner', id: String(encounter.provider) }),
      },
    ],
    period: {
      start: encounter.encounterDate ? new Date(encounter.encounterDate).toISOString() : undefined,
      // A `DRAFT` encounter has no defined end yet — FHIR's own
      // convention for an ongoing period is simply omitting `end`,
      // not inventing a placeholder timestamp.
      ...(encounter.status === 'FINALIZED' && encounter.finalizedAt
        ? { end: new Date(encounter.finalizedAt).toISOString() }
        : {}),
    },
    ...(reasonCode ? { reasonCode } : {}),
    ...(diagnosis ? { diagnosis } : {}),
    // `appointment` (BET-10) is a genuine FHIR `Encounter.appointment`
    // back-reference, but this project has no FHIR `Appointment`
    // mapper yet (out of BET-19's roadmap as scoped) — omitted rather
    // than referencing a resource type this server doesn't expose.
  };
};
