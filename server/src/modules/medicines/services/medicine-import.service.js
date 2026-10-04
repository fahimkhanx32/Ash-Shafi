import { Medicine, DOSAGE_FORMS, ROUTES, MEDICINE_STATUSES } from '../models/medicine.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { ROLES } from '../../../security/permissions.js';

/**
 * Bangladesh medicine-database import pipeline (spec item 4).
 *
 * Deliberately NOT wired to any specific live "official DGDA/DGHS API"
 * endpoint: at the time this was written, DGDA (dgda.gov.bd) publishes
 * an application portal (ADLRS) for drug-license submissions, not a
 * documented public bulk-download, FHIR terminology server, or OCL
 * feed for the full registered-drug list, and this server's network
 * egress allowlist does not include dgda.gov.bd or any other .gov.bd
 * host regardless. Inventing an endpoint here would silently point a
 * medical-safety-relevant import at a URL nobody verified — instead
 * this module accepts a JSON array or CSV text (however it was
 * obtained — an official export, a DGHS-provided extract, a partner
 * dataset) and imports it exactly as the spec's "server-side importer/
 * sync pipeline supporting JSON/CSV ingestion" describes. If/when a
 * real official machine-readable source is confirmed, only
 * `normalizeRow()`'s field-mapping below needs to change — the
 * validation/upsert/index/versioning machinery is already the general
 * shape DGHS Core FHIR R4 MedicationKnowledge resources would map onto
 * (code → dgdaCode, ingredient → genericName, doseForm → dosageForm,
 * manufacturer → manufacturer).
 */

const REQUIRED_IMPORT_ROLES = new Set([ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN]);

export const assertCanImportMedicines = (actor) => {
  if (!actor || !REQUIRED_IMPORT_ROLES.has(actor.role)) {
    throw new AppError('Only Software Owner or Super Admin can import the medicine database.', 403, {
      code: 'FORBIDDEN',
    });
  }
};

/**
 * Minimal, dependency-free CSV parser. Handles quoted fields (RFC
 * 4180 style: "" as an escaped quote, commas/newlines inside quotes),
 * CRLF or LF line endings, and a header row. Deliberately not a
 * streaming parser — bulk imports here are validated/report-generated
 * as one in-memory batch (bounded by `importMedicinesBodySchema`'s
 * 50,000-row cap), consistent with this project's other bulk-import
 * surfaces.
 */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      // swallow — paired \n (if present) triggers pushRow above
    } else {
      field += char;
    }
  }
  // final field/row if the file doesn't end with a newline
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== '')).map((r) => {
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = (r[idx] ?? '').trim();
    });
    return obj;
  });
};

const normalizeEnum = (value, allowed, fallback) => {
  if (!value) return fallback;
  const upper = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return allowed.includes(upper) ? upper : fallback;
};

/**
 * Maps one loosely-shaped import row (CSV cells are always strings;
 * JSON rows may already be typed) onto the subset of `Medicine`
 * fields a bulk import is allowed to touch. Never writes clinical
 * fields (indications/contraindications/warnings/interactions/price)
 * from an import — those stay doctor/admin-curated in the app, not
 * overwritten by a registry sync that doesn't carry that data.
 */
const normalizeRow = (row) => ({
  dgdaCode: (row.dgdaCode || row.DGDA_CODE || row.registrationNo || row.dgda_reg_no || '').trim() || null,
  genericName: (row.genericName || row.generic_name || row.generic || '').trim(),
  brandName: (row.brandName || row.brand_name || row.brand || '').trim(),
  manufacturer: (row.manufacturer || row.company || row.manufacturer_name || '').trim(),
  strength: String(row.strength || '').trim(),
  unit: String(row.unit || '').trim(),
  dosageForm: normalizeEnum(row.dosageForm || row.dosage_form || row.form, DOSAGE_FORMS, 'OTHER'),
  route: normalizeEnum(row.route, ROUTES, 'ORAL'),
  packSize: String(row.packSize || row.pack_size || row.pack || '').trim(),
  status: normalizeEnum(row.status, MEDICINE_STATUSES, 'UNKNOWN'),
});

/**
 * Idempotent bulk upsert. Match key priority:
 *   1. dgdaCode, when the row has one — the true stable identity for
 *      an officially-registered drug, so re-running an import (or
 *      importing a newer source version) always updates the same
 *      document rather than creating a duplicate.
 *   2. Otherwise a composite of genericName+brandName+manufacturer+
 *      strength+dosageForm — the best available near-unique key for
 *      sources that don't carry a registration code.
 * Rows failing basic validation (no genericName at minimum) are
 * counted and reported, never thrown — a bad row in a 30,000-row file
 * should not abort the other 29,999.
 */
export const upsertMedicineRecords = async (rawRecords, { origin, sourceVersion, actor }) => {
  const stats = {
    totalRows: rawRecords.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const now = new Date();
  const ops = [];

  rawRecords.forEach((raw, index) => {
    const row = normalizeRow(raw);
    if (!row.genericName) {
      stats.skipped += 1;
      if (stats.errors.length < 200) {
        stats.errors.push({ row: index + 1, reason: 'Missing genericName.' });
      }
      return;
    }

    const filter = row.dgdaCode
      ? { dgdaCode: row.dgdaCode }
      : {
          genericName: row.genericName,
          brandName: row.brandName,
          manufacturer: row.manufacturer,
          strength: row.strength,
          dosageForm: row.dosageForm,
        };

    ops.push({
      updateOne: {
        filter,
        update: {
          $set: {
            ...row,
            sourceVersion: sourceVersion || '',
            lastSyncedAt: now,
            source: {
              origin: origin || 'DGDA import',
              version: sourceVersion || '',
              importDate: now,
              country: 'Bangladesh',
            },
            updatedBy: actor?._id || null,
          },
          $setOnInsert: {
            isActive: true,
            isDeleted: false,
            verificationStatus: 'UNVERIFIED',
            createdBy: actor?._id || null,
          },
        },
        upsert: true,
      },
    });
  });

  if (ops.length === 0) {
    return stats;
  }

  // Chunked to keep any single bulkWrite call reasonably sized.
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const result = await Medicine.bulkWrite(chunk, { ordered: false });
    stats.inserted += result.upsertedCount || 0;
    stats.updated += result.modifiedCount || 0;
  }

  logger.info(
    {
      event: 'medicine_bulk_import',
      totalRows: stats.totalRows,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      origin,
      sourceVersion,
    },
    'Medicine database bulk import completed.',
  );

  return stats;
};

export const importMedicines = async (records, { origin, sourceVersion }, actor) => {
  assertCanImportMedicines(actor);
  if (!Array.isArray(records) || records.length === 0) {
    throw new AppError('No records provided to import.', 400, { code: 'EMPTY_IMPORT' });
  }
  return upsertMedicineRecords(records, { origin, sourceVersion, actor });
};
