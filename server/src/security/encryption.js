import crypto from 'node:crypto';

import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const deriveKey = (secret, label) => {
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error(`${label} is not configured.`);
  }

  return crypto
    .createHash('sha256')
    .update(secret, 'utf8')
    .digest();
};

const dataKey = () =>
  deriveKey(env.encryption.dataKey, 'DATA_ENCRYPTION_KEY');

const fieldKey = () =>
  deriveKey(env.encryption.fieldKey, 'FIELD_ENCRYPTION_KEY');

const encryptWithKey = (plaintext, key) => {
  if (typeof plaintext !== 'string') {
    throw new TypeError('Plaintext must be a string.');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
};

const decryptWithKey = (value, key) => {
  if (typeof value !== 'string' || !value) {
    throw new TypeError('Encrypted value must be a non-empty string.');
  }

  const parts = value.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value.');
  }

  const [ivEncoded, authTagEncoded, encryptedEncoded] = parts;

  const iv = Buffer.from(ivEncoded, 'base64url');
  const authTag = Buffer.from(authTagEncoded, 'base64url');
  const encrypted = Buffer.from(encryptedEncoded, 'base64url');

  if (
    iv.length !== IV_LENGTH ||
    authTag.length !== AUTH_TAG_LENGTH
  ) {
    throw new Error('Invalid encrypted value.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

export const encryptData = (plaintext) => {
  return encryptWithKey(plaintext, dataKey());
};

export const decryptData = (ciphertext) => {
  return decryptWithKey(ciphertext, dataKey());
};

export const encryptField = (plaintext) => {
  return encryptWithKey(plaintext, fieldKey());
};

export const decryptField = (ciphertext) => {
  return decryptWithKey(ciphertext, fieldKey());
};