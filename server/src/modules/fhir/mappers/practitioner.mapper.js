/**
 * BET-19 — Practitioner mapping: `StaffProfile` (+ its populated
 * `user`) → FHIR R4 `Practitioner`.
 *
 * Unlike `PatientProfile`, `StaffProfile` has no `firstName`/
 * `lastName` fields of its own — the display name lives entirely on
 * the linked `User.name` (a single full-name string; see
 * `staff.service.js`'s `USER_SUMMARY_FIELDS`, which already
 * populates it on every `getStaffProfileById`/`getDoctorById` call).
 * `HumanName.text` is therefore the only reliable field here;
 * `family`/`given` are deliberately not guessed by splitting the
 * string, since a naive space-split is wrong for a meaningful
 * fraction of real names (multi-word family names, honorifics,
 * single-word names) and a wrong split is worse than no split.
 *
 * Applies to every `StaffProfile`, not only `designation: 'DOCTOR'`
 * ones — FHIR's `Practitioner` resource itself represents any
 * person performing a healthcare-related role, not only physicians
 * (a nurse or pharmacist is also a legitimate `Practitioner`). The
 * doctor-specific clinical fields (`qualification`,
 * `PRACTITIONER_LICENSE` identifier) are simply absent/empty for
 * non-doctor staff rather than the mapper branching on designation.
 */

import {
  buildIdentifier,
  buildHumanName,
  buildContactPoint,
  fhirMeta,
} from '../utils/fhir-builder.util.js';
import { FHIR_IDENTIFIER_SYSTEMS } from '../constants/fhir.constants.js';

/**
 * @param {import('mongoose').Document} staffProfile - a `StaffProfile` document with `user` already populated (`USER_SUMMARY_FIELDS`)
 * @returns {object} FHIR R4 Practitioner resource
 */
export const mapPractitionerToFhir = (staffProfile) => {
  if (!staffProfile) {
    throw new TypeError('mapPractitionerToFhir requires a StaffProfile document.');
  }

  const user = staffProfile.user || {};
  const doctorDetails = staffProfile.doctorDetails || {};

  const identifiers = [
    buildIdentifier({
      system: FHIR_IDENTIFIER_SYSTEMS.EMPLOYEE_ID,
      value: staffProfile.employeeId,
      use: 'usual',
    }),
    buildIdentifier({
      system: FHIR_IDENTIFIER_SYSTEMS.PRACTITIONER_LICENSE,
      value: doctorDetails.registrationNumber,
      use: 'official',
    }),
  ].filter(Boolean);

  const name = [buildHumanName({ text: user.name })];

  const telecom = [
    buildContactPoint({ system: 'phone', value: staffProfile.phone, use: 'work' }),
    buildContactPoint({ system: 'email', value: user.email, use: 'work' }),
  ].filter(Boolean);

  const qualification =
    Array.isArray(doctorDetails.qualifications) && doctorDetails.qualifications.length > 0
      ? doctorDetails.qualifications
          .filter(Boolean)
          .map((q) => ({ code: { text: q } }))
      : undefined;

  return {
    resourceType: 'Practitioner',
    id: String(staffProfile._id),
    meta: fhirMeta(),
    active: staffProfile.employmentStatus === 'ACTIVE',
    ...(identifiers.length > 0 ? { identifier: identifiers } : {}),
    name,
    ...(telecom.length > 0 ? { telecom } : {}),
    gender: staffProfile.gender ? staffProfile.gender.toLowerCase() : undefined,
    ...(qualification ? { qualification } : {}),
    // `designation`/`department`/`customDesignationLabel` describe
    // this person's *role within the organization*, which FHIR
    // models separately as `PractitionerRole` (a distinct resource
    // linking a Practitioner to an Organization + role + location) —
    // out of this checkpoint's scope, not force-fit onto
    // `Practitioner` itself.
  };
};
