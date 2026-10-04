/**
 * BET-19 checkpoint 2 — "Controlled export": the generic single-use,
 * time-limited download token mechanism.
 *
 * Deliberately generic over `exportType`/`format` — today only the
 * medical-record package (checkpoint 2's other item) uses it, but
 * any future sensitive, single-record export this project adds
 * should request a controlled-export token the same way rather than
 * inventing its own token/expiry scheme. See `export-request.model.js`
 * for why the token is hashed at rest and the record is
 * TTL-expiring, and why the file itself is stored inline for now.
 */

import { ExportRequest } from '../models/export-request.model.js';
import { generateOpaqueToken, hashToken } from '../../../security/tokens.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { CONTROLLED_EXPORT_TOKEN_TTL_MINUTES } from '../constants/export.constants.js';

/**
 * Stores `buffer` behind a fresh single-use download token and
 * returns the token (plaintext — only ever returned once, here;
 * only its hash is persisted) plus its expiry.
 *
 * @param {{
 *   requestedBy: string,
 *   patientProfileId: string,
 *   exportType: string,
 *   format: 'PDF'|'JSON',
 *   filename: string,
 *   mimeType: string,
 *   buffer: Buffer,
 * }} args
 * @returns {Promise<{ token: string, expiresAt: Date, sizeBytes: number }>}
 */
export const createControlledExport = async ({
  requestedBy,
  patientProfileId,
  exportType,
  format,
  filename,
  mimeType,
  buffer,
}) => {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + CONTROLLED_EXPORT_TOKEN_TTL_MINUTES * 60 * 1000);

  await ExportRequest.create({
    tokenHash: hashToken(token),
    requestedBy,
    patientProfileId,
    exportType,
    format,
    filename,
    mimeType,
    sizeBytes: buffer.length,
    fileBuffer: buffer,
    expiresAt,
  });

  return { token, expiresAt, sizeBytes: buffer.length };
};

/**
 * Redeems a controlled-export download token exactly once. Throws a
 * 404-shaped `AppError` for an unknown, expired, or already-consumed
 * token — deliberately the same error for all three cases (never
 * distinguishing "expired" from "already used" from "never
 * existed") so a caller probing tokens learns nothing about which
 * failure mode occurred.
 *
 * @param {string} token
 * @returns {Promise<{ buffer: Buffer, filename: string, mimeType: string, requestedBy: string, patientProfileId: string }>}
 */
export const consumeControlledExport = async (token) => {
  const tokenHash = hashToken(token);

  // Atomic find-and-mark-consumed: a token can only ever be
  // successfully redeemed by exactly one of two concurrent requests
  // racing on the same token, not both (`consumedAt: null` in the
  // filter means the second request's `findOneAndUpdate` simply
  // matches nothing).
  const exportRequest = await ExportRequest.findOneAndUpdate(
    { tokenHash, consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );

  if (!exportRequest) {
    throw new AppError('This export link is invalid, expired, or has already been used.', 404, {
      code: 'EXPORT_TOKEN_INVALID',
    });
  }

  return {
    buffer: exportRequest.fileBuffer,
    filename: exportRequest.filename,
    mimeType: exportRequest.mimeType,
    requestedBy: String(exportRequest.requestedBy),
    patientProfileId: String(exportRequest.patientProfileId),
  };
};
