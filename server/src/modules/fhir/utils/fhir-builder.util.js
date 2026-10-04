/**
 * BET-19 — FHIR-ready architecture: shared resource-building
 * primitives.
 *
 * Every mapper in `modules/fhir/mappers/` builds its resource out of
 * these same small functions rather than hand-assembling FHIR JSON
 * shapes inline — the same "one shared primitive, not N ad-hoc
 * copies" discipline this project already applies elsewhere (e.g.
 * `security/sanitization.js`'s single `sanitizeHtmlContent` used by
 * every CMS content block). Each function returns exactly the FHIR
 * R4 datatype shape it's named for (HumanName, Identifier,
 * ContactPoint, Address, CodeableConcept, Reference) — nothing here
 * is Ash-Shāfī-specific except where explicitly noted.
 */

import { FHIR_VERSION } from '../constants/fhir.constants.js';

/** @param {{ system: string, value: string, use?: string }} args */
export const buildIdentifier = ({ system, value, use }) => {
  if (!value) return null;
  return {
    ...(use ? { use } : {}),
    system,
    value: String(value),
  };
};

/**
 * @param {{ text?: string, family?: string, given?: string[], use?: string }} args
 */
export const buildHumanName = ({ text, family, given, use = 'official' }) => {
  const name = { use };
  if (text) name.text = text;
  if (family) name.family = family;
  if (Array.isArray(given) && given.length > 0) name.given = given.filter(Boolean);
  return name;
};

/**
 * @param {{ system: 'phone'|'email'|'fax'|'url'|'sms'|'other', value: string, use?: string }} args
 */
export const buildContactPoint = ({ system, value, use = 'home' }) => {
  if (!value) return null;
  return { system, value, use };
};

/**
 * @param {{ line?: string[], city?: string, state?: string, postalCode?: string, country?: string, use?: string }} args
 */
export const buildAddress = ({ line, city, state, postalCode, country, use = 'home' }) => {
  const hasAny = (line && line.some(Boolean)) || city || state || postalCode || country;
  if (!hasAny) return null;

  const address = { use };
  if (line && line.some(Boolean)) address.line = line.filter(Boolean);
  if (city) address.city = city;
  if (state) address.state = state;
  if (postalCode) address.postalCode = postalCode;
  if (country) address.country = country;
  return address;
};

/** @param {{ system: string, code: string, display?: string, text?: string }} args */
export const buildCodeableConcept = ({ system, code, display, text }) => ({
  ...(system && code
    ? { coding: [{ system, code, ...(display ? { display } : {}) }] }
    : {}),
  ...(text ? { text } : {}),
});

/** @param {{ resourceType: string, id: string, display?: string }} args */
export const buildReference = ({ resourceType, id, display }) => ({
  reference: `${resourceType}/${id}`,
  ...(display ? { display } : {}),
});

/**
 * FHIR's `OperationOutcome` — the standard error/diagnostic resource
 * shape, used for every FHIR-facing error response in this module
 * instead of this project's normal `AppError`-driven JSON error body
 * (see `middlewares/error.middleware.js`), so a FHIR-consuming client
 * gets a shape it actually knows how to parse.
 *
 * @param {{ severity: 'fatal'|'error'|'warning'|'information', code: string, diagnostics: string }} args
 */
export const buildOperationOutcome = ({ severity = 'error', code = 'not-found', diagnostics }) => ({
  resourceType: 'OperationOutcome',
  issue: [{ severity, code, diagnostics }],
});

/**
 * @param {{ type: 'searchset'|'collection'|'batch-response', resources: object[], total?: number }} args
 */
export const buildBundle = ({ type = 'collection', resources = [], total }) => ({
  resourceType: 'Bundle',
  type,
  ...(typeof total === 'number' ? { total } : {}),
  entry: resources.map((resource) => ({ resource })),
});

export const fhirMeta = () => ({ versionId: '1', lastUpdated: new Date().toISOString() });

export { FHIR_VERSION };
