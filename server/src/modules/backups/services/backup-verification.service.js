/**
 * BET-18 — Backup verification.
 *
 * Deliberately distinct from "restore testing" (`restore.service.js`
 * — actually inserts into a scratch database to prove the archive is
 * restorable end-to-end): this is the cheaper, always-run check that
 * happens immediately after every backup — decrypt (if applicable),
 * re-read the ZIP, parse `manifest.json`, and confirm every
 * collection's document count inside the archive matches what
 * `database-backup.service.js` recorded at dump time, plus a
 * checksum sanity check on the file that was actually written to
 * disk. This catches truncation, a bad encryption round-trip, or a
 * corrupted write — the kind of failure a restore test run only
 * occasionally (it's much more expensive) would otherwise miss until
 * the day someone actually needs the backup.
 */

import fs from 'node:fs/promises';

import { readZipEntries } from '../../reports/services/spreadsheet-extraction.service.js';
import { decryptBackupBuffer } from './backup-crypto.service.js';
import { sha256Hex } from '../utils/zip-writer.util.js';

/**
 * @param {import('../models/backup.model.js').Backup} backup
 * @returns {Promise<{ verified: boolean, reason: string }>}
 */
export const verifyBackupArchive = async (backup) => {
  if (!backup.localFilePath) {
    return { verified: false, reason: 'No local backup file recorded.' };
  }

  const onDisk = await fs.readFile(backup.localFilePath);

  const actualChecksum = sha256Hex(onDisk);
  if (backup.checksumSha256 && actualChecksum !== backup.checksumSha256) {
    return {
      verified: false,
      reason: `Checksum mismatch: recorded ${backup.checksumSha256}, on-disk file hashes to ${actualChecksum}.`,
    };
  }

  let archiveBuffer = onDisk;
  if (backup.encrypted) {
    try {
      archiveBuffer = decryptBackupBuffer(onDisk);
    } catch (error) {
      return { verified: false, reason: `Failed to decrypt for verification: ${error.message}` };
    }
  }

  let entries;
  try {
    entries = readZipEntries(archiveBuffer);
  } catch (error) {
    return { verified: false, reason: `Failed to read archive for verification: ${error.message}` };
  }

  const manifestBuffer = entries.get('manifest.json');
  if (!manifestBuffer) {
    return { verified: false, reason: 'Archive is missing manifest.json.' };
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBuffer.toString('utf8'));
  } catch (error) {
    return { verified: false, reason: `manifest.json is not valid JSON: ${error.message}` };
  }

  for (const collection of manifest.collections || []) {
    const entryBuffer = entries.get(`collections/${collection.name}.json`);
    if (!entryBuffer) {
      return { verified: false, reason: `Archive is missing dump file for collection "${collection.name}".` };
    }

    let documents;
    try {
      documents = JSON.parse(entryBuffer.toString('utf8'));
    } catch (error) {
      return { verified: false, reason: `Collection "${collection.name}" dump is not valid JSON: ${error.message}` };
    }

    if (!Array.isArray(documents) || documents.length !== collection.documentCount) {
      return {
        verified: false,
        reason: `Collection "${collection.name}" document count mismatch: manifest says ${collection.documentCount}, archive contains ${Array.isArray(documents) ? documents.length : 'invalid'}.`,
      };
    }
  }

  return { verified: true, reason: '' };
};
