/**
 * BET-19 — FHIR-ready architecture: the resource-mapper registry.
 *
 * This is the actual "architecture" the checkpoint asks for, not
 * just two one-off mapper functions: every FHIR resource type this
 * module supports (`Patient`, `Practitioner`, and — later
 * checkpoints — `Encounter`, `MedicationRequest`, `DiagnosticReport`,
 * `Observation`/`Condition`) registers itself here with a fixed
 * shape, mirroring the provider-abstraction pattern BET-16 already
 * established for external integrations
 * (`modules/integrations/services/integration-provider.interface.js`):
 * callers (the controller, and any future export/import code that
 * needs "give me this record as FHIR") only ever go through
 * `getMapper(resourceType)` — they never import a concrete mapper
 * file directly — so adding a new resource type later is additive
 * (register it here) rather than requiring every caller to be
 * updated.
 *
 * Each registered mapper must expose:
 *   - `resourceType` — the exact FHIR resource type name (e.g.
 *     `'Patient'`), used both as this registry's key and as the
 *     `resourceType` field FHIR requires on every resource.
 *   - `toFhir(...)` — pure, synchronous transform from whatever this
 *     project's own model/service layer already returned into a FHIR
 *     resource object. The exact argument shape is resource-specific
 *     (e.g. `Patient` needs both the `PatientProfile` and its linked
 *     `User`'s name/email, since `User.name` isn't duplicated onto
 *     `PatientProfile`) — callers already know which resource type
 *     they're asking for and so already know which shape to pass.
 *     Mappers never fetch data themselves (that's `modules/fhir/
 *     services/fhir.service.js`'s job, reusing each domain module's
 *     own existing service functions) — this keeps every mapper a
 *     pure, easily-tested function with no database dependency of
 *     its own.
 *   - `cardinality` — `'one'` (default, `toFhir` returns a single
 *     resource) or `'many'` (`toFhir` returns an array of resources
 *     from one source document — see `MedicationRequest`, where one
 *     `Prescription` can hold several `items`, each its own FHIR
 *     resource). Callers must check this before assuming a single
 *     object back from `toFhir`.
 */

import { mapPatientToFhir } from './patient.mapper.js';
import { mapPractitionerToFhir } from './practitioner.mapper.js';
import { mapEncounterToFhir } from './encounter.mapper.js';
import { mapPrescriptionToFhir } from './medication-request.mapper.js';
import { mapMedicalReportToFhir } from './diagnostic-report.mapper.js';
import {
  mapAllergiesToFhir,
  mapChronicConditionsToFhir,
  mapVaccinationsToFhir,
} from './clinical-record.mapper.js';

const REGISTRY = new Map([
  ['Patient', { resourceType: 'Patient', toFhir: mapPatientToFhir, cardinality: 'one' }],
  ['Practitioner', { resourceType: 'Practitioner', toFhir: mapPractitionerToFhir, cardinality: 'one' }],
  ['Encounter', { resourceType: 'Encounter', toFhir: mapEncounterToFhir, cardinality: 'one' }],
  [
    'MedicationRequest',
    { resourceType: 'MedicationRequest', toFhir: mapPrescriptionToFhir, cardinality: 'many' },
  ],
  // `DiagnosticReport` is registered with `cardinality: 'compound'` —
  // its `toFhir` returns `{ diagnosticReport, observations }`, not a
  // single resource or a flat array, since two distinct FHIR
  // resource types are produced together (see
  // `diagnostic-report.mapper.js`'s own docstring). Callers that only
  // know the generic registry shape must check for this case
  // explicitly rather than assuming 'one'/'many' cover everything.
  [
    'DiagnosticReport',
    { resourceType: 'DiagnosticReport', toFhir: mapMedicalReportToFhir, cardinality: 'compound' },
  ],
  ['AllergyIntolerance', { resourceType: 'AllergyIntolerance', toFhir: mapAllergiesToFhir, cardinality: 'many' }],
  ['Condition', { resourceType: 'Condition', toFhir: mapChronicConditionsToFhir, cardinality: 'many' }],
  ['Immunization', { resourceType: 'Immunization', toFhir: mapVaccinationsToFhir, cardinality: 'many' }],
]);

/** @returns {string[]} every FHIR resource type this deployment currently supports. */
export const getSupportedResourceTypes = () => Array.from(REGISTRY.keys());

/**
 * @param {string} resourceType
 * @returns {{ resourceType: string, toFhir: Function } | null}
 */
export const getMapper = (resourceType) => REGISTRY.get(resourceType) || null;
