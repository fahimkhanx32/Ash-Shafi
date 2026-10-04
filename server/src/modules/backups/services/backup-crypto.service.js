/**
 * BET-18 — Backup encryption.
 *
 * `security/encryption.js` (BET-02-era) already does AES-256-GCM
 * keyed off `DATA_ENCRYPTION_KEY`, but only for `string` plaintext —
 * it base64url-encodes IV/authTag/ciphertext into a single delimited
 * string, which is the right shape for a database field, not for a
 * multi-megabyte backup archive Buffer (base64 inflates size by
 * ~33% for no benefit here, and the delimiter format doesn't apply
 * to binary data). This module reuses the *same* key
 * (`env.encryption.dataKey`, same SHA-256 derivation) and the same
 * `aes-256-gcm` algorithm, but operates on Buffers directly, with a
 * small fixed binary header instead of string delimiters — the
 * backup file and a database field are encrypted with the same key
 * material either way, just framed differently for their own shape.
 * Nothing in `security/encryption.js` was changed.
 */

import crypto from 'node:crypto';

import env from '../../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
// 4-byte magic header so `decryptBackupBuffer` can fail fast and
// clearly on a corrupt/foreign file instead of a cryptic GCM auth
// failure with no context.
const MAGIC = Buffer.from('NMBK'); // "Ash-Shāfī Backup"

const backupKey = () => {
  const secret = env.encryption.dataKey;
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('DATA_ENCRYPTION_KEY is not configured — cannot encrypt backups.');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
};

/** @returns {boolean} whether backup encryption is actually usable right now. */
export const isBackupEncryptionConfigured = () => {
  try {
    backupKey();
    return true;
  } catch {
    return false;
  }
};

/**
 * @param {Buffer} plainBuffer
 * @returns {Buffer} MAGIC(4) + IV(12) + authTag(16) + ciphertext
 */
export const encryptBackupBuffer = (plainBuffer) => {
  if (!Buffer.isBuffer(plainBuffer)) {
    throw new TypeError('encryptBackupBuffer expects a Buffer.');
  }

  const key = backupKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, iv, authTag, encrypted]);
};

/**
 * @param {Buffer} encryptedBuffer
 * @returns {Buffer} the original plaintext buffer
 */
export const decryptBackupBuffer = (encryptedBuffer) => {
  if (!Buffer.isBuffer(encryptedBuffer) || encryptedBuffer.length < MAGIC.length + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Backup file is too short or malformed.');
  }

  const magic = encryptedBuffer.subarray(0, 4);
  if (!magic.equals(MAGIC)) {
    throw new Error('Not a recognized encrypted backup file (bad magic header).');
  }

  const iv = encryptedBuffer.subarray(4, 4 + IV_LENGTH);
  const authTag = encryptedBuffer.subarray(4 + IV_LENGTH, 4 + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(4 + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = backupKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};
