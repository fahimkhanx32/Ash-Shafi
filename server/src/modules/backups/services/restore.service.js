/**
 * BET-18 — Restore procedure & restore testing.
 *
 * Two distinct operations, deliberately never sharing a code path
 * with different guard rails bolted on afterward — the risk profile
 * is too different to safely factor together:
 *
 *  - `runRestoreTest(backupId)` — proves a backup archive is
 *    genuinely restorable by actually inserting it into a disposable,
 *    isolated scratch MongoDB *database* (a different database name
 *    on the same cluster/connection, never the live one), verifying
 *    document counts, then dropping the scratch database. Safe to run
 *    at any time, including automatically after every backup if
 *    desired — it can never touch production data because it never
 *    connects to the production database name.
 *
 *  - `restoreToProduction(backupId, options)` — the real, destructive
 *    recovery operation: drops and replaces production collections
 *    with the archive's contents. Gated with the exact same
 *    "explicit privileged operation" confirmation contract
 *    `data-lifecycle.service.js#purgeExpiredData` already established
 *    for irreversible actions (own current password + `confirm: true`
 *    + a written `reason` + `SYSTEM_ADMIN` permission at the route
 *    layer) — reused here rather than inventing a second contract
 *    shape for a second irreversible operation. This is deliberately
 *    the only place in the codebase, alongside that purge, that can
 *    delete whole collections of clinical/financial data — and it
 *    only ever runs against the exact contents of a verified backup
 *    archive, never an ad-hoc filter.
 */

import mongoose from 'mongoose';

import { logger } from '../../../config/logger.js';
import env from '../../../config/env.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { verifyPassword } from '../../../security/password.js';
import { User } from '../../../users/user.model.js';
import { readZipEntries } from '../../reports/services/spreadsheet-extraction.service.js';
import { decryptBackupBuffer } from './backup-crypto.service.js';
import { Backup } from '../models/backup.model.js';
import fs from 'node:fs/promises';

const loadArchiveEntries = async (backup) => {
  if (!backup.localFilePath) {
    throw new AppError('This backup has no local file available to restore from (it may have been purged).', 409, {
      code: 'BACKUP_FILE_UNAVAILABLE',
    });
  }

  const onDisk = await fs.readFile(backup.localFilePath);
  const archiveBuffer = backup.encrypted ? decryptBackupBuffer(onDisk) : onDisk;
  const entries = readZipEntries(archiveBuffer);

  const manifestBuffer = entries.get('manifest.json');
  if (!manifestBuffer) {
    throw new AppError('Backup archive is missing manifest.json — cannot restore from it.', 422, {
      code: 'BACKUP_ARCHIVE_INVALID',
    });
  }
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));

  return { entries, manifest };
};

/**
 * Restore testing (BET-18) — inserts the archive's contents into a
 * throwaway database, never the live one, purely to prove the
 * archive round-trips through a real MongoDB insert.
 *
 * @param {string} backupId
 * @returns {Promise<{ passed: boolean, collectionsChecked: number, error?: string }>}
 */
export const runRestoreTest = async (backupId) => {
  const backup = await Backup.findById(backupId);
  if (!backup) {
    throw new AppError('Backup not found.', 404, { code: 'BACKUP_NOT_FOUND' });
  }

  const scratchDbName = `ashshafi_restore_test_${backupId}_${Date.now()}`;
  // A separate *database name* on the same MongoDB connection URI —
  // deliberately not the production `env.database.name` — so this
  // can never touch a live collection regardless of what happens
  // inside the try block below.
  const scratchConnection = mongoose.createConnection(env.database.uri, {
    dbName: scratchDbName,
  });

  try {
    await scratchConnection.asPromise();

    const { entries, manifest } = await loadArchiveEntries(backup);

    let collectionsChecked = 0;
    for (const collection of manifest.collections || []) {
      const entryBuffer = entries.get(`collections/${collection.name}.json`);
      if (!entryBuffer) {
        throw new Error(`Archive is missing dump file for collection "${collection.name}".`);
      }
      const documents = JSON.parse(entryBuffer.toString('utf8'));

      if (documents.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await scratchConnection.collection(collection.name).insertMany(documents, { ordered: false });
      }
      // eslint-disable-next-line no-await-in-loop
      const insertedCount = await scratchConnection.collection(collection.name).countDocuments();
      if (insertedCount !== documents.length) {
        throw new Error(
          `Restore-test insert mismatch for "${collection.name}": expected ${documents.length}, got ${insertedCount}.`,
        );
      }
      collectionsChecked += 1;
    }

    backup.restoreTestedAt = new Date();
    backup.restoreTestPassed = true;
    backup.restoreTestError = '';
    await backup.save();

    logger.info({ backupId, collectionsChecked }, 'BET-18 restore test: passed');

    return { passed: true, collectionsChecked };
  } catch (error) {
    backup.restoreTestedAt = new Date();
    backup.restoreTestPassed = false;
    backup.restoreTestError = error?.message || 'Unknown restore-test error';
    await backup.save();

    logger.warn({ err: error, backupId }, 'BET-18 restore test: failed');

    return { passed: false, collectionsChecked: 0, error: backup.restoreTestError };
  } finally {
    // Always tear down the scratch database, pass or fail — it must
    // never linger as a stray database on the cluster.
    try {
      await scratchConnection.dropDatabase();
    } catch (dropError) {
      logger.warn({ err: dropError, backupId }, 'BET-18 restore test: scratch database cleanup failed');
    }
    await scratchConnection.close();
  }
};

/**
 * The real, destructive restore-to-production operation. Requires
 * the exact same confirmation contract as
 * `data-lifecycle.service.js#purgeExpiredData` (own password,
 * explicit `confirm: true`, written `reason`) — re-verified here,
 * not just at the route layer, so this function can never be called
 * safely by accident from anywhere else in the codebase either.
 *
 * @param {{ backupId: string, actorId: string, password: string, confirm: boolean, reason: string }} args
 */
export const restoreToProduction = async ({ backupId, actorId, password, confirm, reason }) => {
  if (confirm !== true) {
    throw new AppError('Restore requires an explicit confirm: true.', 400, { code: 'RESTORE_NOT_CONFIRMED' });
  }
  if (typeof reason !== 'string' || reason.trim().length < 10) {
    throw new AppError('Restore requires a written reason of at least 10 characters.', 400, {
      code: 'RESTORE_REASON_REQUIRED',
    });
  }

  const actor = await User.findById(actorId).select('+passwordHash');
  if (!actor) {
    throw new AppError('Acting account not found.', 401, { code: 'UNAUTHORIZED' });
  }
  const passwordOk = await verifyPassword(actor.passwordHash, password);
  if (!passwordOk) {
    throw new AppError('Password verification failed.', 401, { code: 'INVALID_PASSWORD' });
  }

  const backup = await Backup.findById(backupId);
  if (!backup) {
    throw new AppError('Backup not found.', 404, { code: 'BACKUP_NOT_FOUND' });
  }
  if (backup.status !== 'COMPLETED') {
    throw new AppError(`Backup is not in a restorable state (status: ${backup.status}).`, 409, {
      code: 'BACKUP_NOT_RESTORABLE',
    });
  }
  if (!backup.verified) {
    throw new AppError('This backup failed its own verification check and cannot be restored from.', 409, {
      code: 'BACKUP_NOT_VERIFIED',
    });
  }

  const { entries, manifest } = await loadArchiveEntries(backup);

  const results = [];
  for (const collection of manifest.collections || []) {
    const entryBuffer = entries.get(`collections/${collection.name}.json`);
    if (!entryBuffer) {
      results.push({ collection: collection.name, restored: false, error: 'Missing from archive.' });
      // eslint-disable-next-line no-continue
      continue;
    }
    const documents = JSON.parse(entryBuffer.toString('utf8'));

    // eslint-disable-next-line no-await-in-loop
    const nativeCollection = mongoose.connection.collection(collection.name);
    // eslint-disable-next-line no-await-in-loop
    await nativeCollection.deleteMany({});
    if (documents.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await nativeCollection.insertMany(documents, { ordered: false });
    }

    results.push({ collection: collection.name, restored: true, documentCount: documents.length });
    logger.warn(
      { collection: collection.name, documentCount: documents.length, backupId, actorId },
      'BET-18 restore: production collection replaced from backup',
    );
  }

  return { backupId, restoredAt: new Date().toISOString(), results };
};
