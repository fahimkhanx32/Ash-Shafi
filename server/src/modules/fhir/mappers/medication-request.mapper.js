/**
 * BET-19 — Medication mapping: this project's own `Prescription`
 * (`modules/prescriptions/models/prescription.model.js`) → FHIR R4
 * `MedicationRequest`.
 *
 * A single `Prescription` document can hold several `items` (e.g.
 * three medicines prescribed at one visit), but FHIR's
 * `MedicationRequest` represents exactly *one* ordered medication —
 * there is no native FHIR resource for "a prescription containing N
 * medications". `mapPrescriptionToFhir` therefore returns an
 * **array** of `MedicationRequest` resources, one per `item`, each
 * carrying `groupIdentifier` so a receiving FHIR system can still
 * tell they were prescribed together in the same clinical act — this
 * is FHIR's own documented mechanism for exactly this situation, not
 * an Ash-Shāfī-specific workaround. Every other mapper in this module
 * returns a single resource; the registry (`mapper-registry.js`) and
 * the service/controller layer both account for this one
 * one-to-many exception explicitly rather than silently assuming
 * `toFhir` always returns a single object.
 */

import { fhirMeta, buildReference, buildCodeableConcept, buildIdentifier } from '../utils/fhir-builder.util.js';
import { FHIR_CODE_SYSTEMS, ASHSHAFI_BASE_URI } from '../constants/fhir.constants.js';

// This project's own three-state `PRESCRIPTION_STATUSES` maps
// directly onto three of FHIR's `medicationrequest-status` codes —
// unlike Encounter's status, these line up cleanly because both
// vocabularies are describing the same underlying "is this the
// currently-active order or not" concept.
const STATUS_MAP = Object.freeze({
  DRAFT: 'draft',
  FINALIZED: 'active',
  SUPERSEDED: 'stopped',
});

const DURATION_UNIT_MAP = Object.freeze({
  DAYS: 'd',
  WEEKS: 'wk',
  MONTHS: 'mo',
  // FHIR's `Timing.repeat.durationUnit` has no "ongoing" code — an
  // ongoing/ ONGOING duration is expressed by simply omitting
  // `duration`/`durationUnit` rather than inventing a non-standard
  // unit code.
  ONGOING: null,
});

const buildDosageInstruction = (item) => {
  const text = [item.timing, item.instructions].filter(Boolean).join(' — ') || undefined;

  const timing =
    item.durationValue && DURATION_UNIT_MAP[item.durationUnit]
      ? {
          repeat: {
            duration: item.durationValue,
            durationUnit: DURATION_UNIT_MAP[item.durationUnit],
          },
        }
      : undefined;

  return {
    ...(text ? { text } : {}),
    ...(timing ? { timing } : {}),
    ...(item.route ? { route: buildCodeableConcept({ text: item.route }) } : {}),
    ...(item.quantity ? { doseAndRate: [{ doseQuantity: { text: item.quantity } }] } : {}),
    additionalInstruction:
      item.notes && item.notes.trim().length > 0 ? [buildCodeableConcept({ text: item.notes })] : undefined,
  };
};

/**
 * @param {import('mongoose').Document} prescription - a `Prescription` document
 * @returns {object[]} an array of FHIR R4 MedicationRequest resources — one per `items` entry
 */
export const mapPrescriptionToFhir = (prescription) => {
  if (!prescription) {
    throw new TypeError('mapPrescriptionToFhir requires a Prescription document.');
  }
  if (!Array.isArray(prescription.items) || prescription.items.length === 0) {
    return [];
  }

  const status = STATUS_MAP[prescription.status] || 'unknown';
  const authoredOn = prescription.prescriptionDate
    ? new Date(prescription.prescriptionDate).toISOString()
    : undefined;

  const groupIdentifier = buildIdentifier({
    system: `${ASHSHAFI_BASE_URI}/identifier/prescription-group`,
    value: String(prescription.prescriptionGroupId || prescription._id),
  });

  return prescription.items.map((item, index) => ({
    resourceType: 'MedicationRequest',
    // FHIR resource `id` must be unique per resource; a prescription
    // with N items yields N ids by suffixing the item's own subdocument
    // _id (stable, already unique) rather than deriving a synthetic index.
    id: `${prescription._id}-${item._id}`,
    meta: fhirMeta(),
    status,
    intent: 'order',
    medicationCodeableConcept: buildCodeableConcept({
      text: [item.brandName, item.genericName].filter(Boolean).join(' / ') || item.genericName,
    }),
    subject: buildReference({ resourceType: 'Patient', id: String(prescription.patientProfile) }),
    encounter: prescription.encounter
      ? buildReference({ resourceType: 'Encounter', id: String(prescription.encounter) })
      : undefined,
    requester: buildReference({ resourceType: 'Practitioner', id: String(prescription.provider) }),
    ...(authoredOn ? { authoredOn } : {}),
    ...(groupIdentifier ? { groupIdentifier } : {}),
    dosageInstruction: [buildDosageInstruction(item)],
    // `medicineRef` deliberately not carried through — per
    // `prescription.model.js`'s own docstring, the reference-data
    // `Medicine` record can change or be deactivated later and must
    // never silently alter what a historical order actually said;
    // only the point-in-time `genericName`/`brandName`/`strength`
    // snapshot on the item itself is trustworthy here.
    ...(item.strength
      ? {
          dispenseRequest: {
            quantity: item.quantity ? { text: item.quantity } : undefined,
          },
        }
      : {}),
    priorPrescription:
      index === 0 && prescription.previousVersion
        ? buildReference({ resourceType: 'MedicationRequest', id: String(prescription.previousVersion) })
        : undefined,
  }));
};

export const MEDICATION_REQUEST_STATUS_CODE_SYSTEM = FHIR_CODE_SYSTEMS.MEDICATION_REQUEST_STATUS;
