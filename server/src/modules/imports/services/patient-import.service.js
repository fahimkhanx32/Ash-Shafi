/**
 * BET-19 checkpoint 1 — CSV / Excel patient import.
 *
 * A deliberate, narrow exception to the "patients are self-service
 * only" rule `modules/users/services/user.service.js`'s
 * `ADMIN_ASSIGNABLE_ROLES` docstring establishes for the *general*
 * admin user-management endpoint. That rule exists to stop an
 * administrator from silently registering a patient through the
 * ordinary "create a user" screen. This is a different, purpose-
 * built tool: bulk migration of an existing patient roster from a
 * legacy system/spreadsheet, which is exactly what master prompt
 * Phase 9 ("Import/Export ... CSV import/export") asks for on a
 * patient-management platform, and it is deliberately its own
 * service rather than a widened `createUserByAdmin` — narrow blast
 * radius, and this file can carry its own audit trail/permission
 * gate (`DATA_IMPORT`, added in checkpoint 4) without touching that
 * endpoint's contract.
 *
 * Mirrors `createUserByAdmin`'s account-provisioning shape exactly:
 * a cryptographically random password is generated server-side
 * (never client-supplied, never persisted or logged in plaintext),
 * only its Argon2 hash is stored, and the new patient is emailed a
 * password-*set* link via the same `POST /auth/reset-password` flow
 * — never a parallel "set initial password" mechanism. Each row is
 * processed independently inside its own try/catch: one bad row
 * (duplicate email, invalid date) fails that row only and never
 * aborts the rest of the batch, the same "process what's valid,
 * report what wasn't" contract `restore.service.js`'s verification
 * pass and `data-lifecycle`'s preview/purge split already use
 * elsewhere in this project for a batch/irreversible operation.
 */

import Joi from 'joi';

import { User } from '../../../users/user.model.js';
import { ROLES } from '../../../security/permissions.js';
import { hashPassword } from '../../../security/password.js';
import { generateOpaqueToken, hashToken } from '../../../security/tokens.js';
import env from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { sendWelcomeSetPasswordEmail } from '../../../integrations/email/email.service.js';
import { createPatientProfile } from '../../patients/services/patient.service.js';
import {
  PATIENT_GENDERS,
  PATIENT_BLOOD_GROUPS,
} from '../../patients/models/patient-profile.model.js';

// Column headers this importer recognizes, matched case-insensitively
// against the file's header row — deliberately the same field names
// `PATIENT_EXPORT_COLUMNS` (`exports/services/entity-export.service.js`)
// produces, so a roster exported from this system and re-imported
// elsewhere (or a corrected export re-imported here) round-trips
// without a manual column-remapping step.
export const PATIENT_IMPORT_COLUMNS = Object.freeze([
  'firstName',
  'lastName',
  'email',
  'username',
  'gender',
  'dateOfBirth',
  'phone',
  'alternatePhone',
  'bloodGroup',
  'nationality',
]);

const rowSchema = Joi.object({
  firstName: Joi.string().trim().max(100).required(),
  lastName: Joi.string().trim().max(100).required(),
  email: Joi.string().trim().lowercase().email().max(254).required(),
  username: Joi.string().trim().lowercase().alphanum().min(3).max(50).required(),
  gender: Joi.string()
    .trim()
    .uppercase()
    .valid(...PATIENT_GENDERS)
    .required(),
  dateOfBirth: Joi.date().max('now').required(),
  phone: Joi.string().trim().max(30).allow('').default(''),
  alternatePhone: Joi.string().trim().max(30).allow('').default(''),
  bloodGroup: Joi.string()
    .trim()
    .uppercase()
    .valid(...PATIENT_BLOOD_GROUPS)
    .allow('')
    .default(null),
  nationality: Joi.string().trim().max(100).allow('').default(''),
});

/**
 * Maps a raw `{ headers, rows }` (from either `csvBufferToRows` or
 * `extractXlsx` — same shape) into an array of plain row objects
 * keyed by `PATIENT_IMPORT_COLUMNS`, matching header names
 * case-insensitively/whitespace-insensitively so "Date of Birth",
 * "dateOfBirth", and "DATEOFBIRTH" all resolve to the same field.
 */
export const mapRowsToPatientRecords = ({ headers, rows }) => {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  const columnIndex = {};
  for (const column of PATIENT_IMPORT_COLUMNS) {
    const target = column.toLowerCase();
    const index = normalizedHeaders.indexOf(target);
    columnIndex[column] = index;
  }

  return rows.map((row) => {
    const record = {};
    for (const column of PATIENT_IMPORT_COLUMNS) {
      const index = columnIndex[column];
      record[column] = index >= 0 && index < row.length ? String(row[index] ?? '').trim() : '';
    }
    return record;
  });
};

const generateUniquePassword = () => generateOpaqueToken(24);

/**
 * Creates one `User` (role `PATIENT`) + `PatientProfile` pair for a
 * single validated row. Not exported standalone — always called
 * through `importPatientRecords` below so every creation goes
 * through the same duplicate-check/error-handling contract.
 */
const createPatientFromRow = async (record, actorId) => {
  const normalizedEmail = record.email.toLowerCase();
  const normalizedUsername = record.username.toLowerCase();

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
  }).lean();

  if (existing) {
    const error = new Error('An account with this email or username already exists.');
    error.code = 'ACCOUNT_ALREADY_EXISTS';
    throw error;
  }

  const randomPassword = generateUniquePassword();
  const passwordHash = await hashPassword(randomPassword);
  const resetToken = generateOpaqueToken();

  const user = await User.create({
    name: `${record.firstName} ${record.lastName}`.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    passwordHash,
    role: ROLES.PATIENT,
    status: 'ACTIVE',
    emailVerifiedAt: new Date(),
    passwordResetTokenHash: hashToken(resetToken),
    passwordResetExpiresAt: new Date(
      Date.now() + env.verification.passwordResetExpiresMinutes * 60 * 1000,
    ),
  });

  const profile = await createPatientProfile(
    {
      firstName: record.firstName,
      lastName: record.lastName,
      gender: record.gender,
      dateOfBirth: record.dateOfBirth,
      phone: record.phone,
      alternatePhone: record.alternatePhone,
      bloodGroup: record.bloodGroup || null,
      nationality: record.nationality,
    },
    user._id,
    actorId,
  );

  // Best-effort, same fail-safe contract as every notification call
  // elsewhere in this project (e.g. `google-drive-backup.service.js`
  // — an unreachable mail provider must never invalidate the account
  // that was already successfully created).
  try {
    await sendWelcomeSetPasswordEmail(user, resetToken);
  } catch (error) {
    logger.error(
      { err: error, userId: user._id.toString() },
      'Failed to send welcome/set-password email for imported patient.',
    );
  }

  return { userId: user._id, patientProfileId: profile._id, patientId: profile.patientId };
};

/**
 * Processes an already-parsed set of row objects (see
 * `mapRowsToPatientRecords`) into created patient accounts.
 *
 * @returns {Promise<{
 *   totalRows: number,
 *   createdCount: number,
 *   failedCount: number,
 *   results: Array<{ rowNumber: number, status: 'CREATED'|'FAILED', patientId?: string, error?: string }>
 * }>}
 */
export const importPatientRecords = async (records, actorId) => {
  const results = [];
  let createdCount = 0;

  for (let i = 0; i < records.length; i += 1) {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    const raw = records[i];

    const { error, value } = rowSchema.validate(raw, { abortEarly: false, stripUnknown: true });

    if (error) {
      results.push({
        rowNumber,
        status: 'FAILED',
        error: error.details.map((d) => d.message).join('; '),
      });
      continue;
    }

    try {
      const created = await createPatientFromRow(value, actorId);
      createdCount += 1;
      results.push({ rowNumber, status: 'CREATED', patientId: created.patientId });
    } catch (rowError) {
      results.push({
        rowNumber,
        status: 'FAILED',
        error: rowError.message || 'Unknown error creating patient.',
      });
    }
  }

  return {
    totalRows: records.length,
    createdCount,
    failedCount: records.length - createdCount,
    results,
  };
};
