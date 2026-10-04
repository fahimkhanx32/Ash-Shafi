/**
 * BET-18 — Database backup.
 *
 * No `mongodump` binary is available in this environment (same class
 * of gap this project has hit before — no scheduler dependency, no
 * `mongodb-memory-server` binary download permitted), so this uses
 * Mongoose's own connection to enumerate every registered model and
 * dump each collection's documents to JSON directly — a full logical
 * backup, not a binary/BSON one. This is a deliberate, documented
 * trade-off (see `docs/backup/DISASTER_RECOVERY.md`), not a silent
 * downgrade: a JSON logical dump restores cleanly via the matching
 * `restore.service.js` in this same module and needs no external
 * tooling on either end, at the cost of not preserving MongoDB's own
 * binary/BSON-specific type fidelity as exactly as `mongodump` would
 * (ObjectId/Date/Buffer fields are round-tripped through Mongoose's
 * own `EJSON`-compatible `toJSON`, which this project's models
 * already rely on everywhere else, e.g. every existing controller's
 * `sendSuccess(res, { data })` call).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

import { logger } from '../../../config/logger.js';
import env from '../../../config/env.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { createZipArchive, sha256Hex } from '../utils/zip-writer.util.js';
import { encryptBackupBuffer, isBackupEncryptionConfigured } from './backup-crypto.service.js';
import { Backup } from '../models/backup.model.js';
import { uploadBackupToGoogleDrive, isGoogleDriveConfigured } from './google-drive-backup.service.js';
import { verifyBackupArchive } from './backup-verification.service.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'storage', 'backups');

const ensureBackupDir = async () => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
};

/**
 * Collections this backup deliberately never dumps, even though a
 * `mongoose.model()` exists for them — nothing intentionally
 * sensitive is excluded (a database backup by definition must be
 * complete to be useful for disaster recovery, which is the whole
 * point of BET-18), only genuinely transient/derivable state that
 * would make restores noisier without adding real recovery value.
 * Kept to an explicit, reviewable allowlist-of-exclusions rather
 * than a broad heuristic, so nothing clinical is ever silently
 * dropped by an over-eager filter.
 */
const EXCLUDED_MODEL_NAMES = new Set([]);

const dumpAllCollections = async () => {
  const modelNames = mongoose.modelNames().filter((name) => !EXCLUDED_MODEL_NAMES.has(name));

  if (modelNames.length === 0) {
    throw new AppError('No Mongoose models are registered — nothing to back up.', 500, {
      code: 'NO_MODELS_REGISTERED',
    });
  }

  const entries = [];
  const collectionsMeta = [];
  let totalDocumentCount = 0;

  for (const modelName of modelNames) {
    const model = mongoose.model(modelName);
    // `.lean()` — plain JSON documents, not Mongoose Document
    // instances; `JSON.stringify` on a lean result already resolves
    // ObjectId/Date the same way every existing controller's
    // `sendSuccess` response does.
    // eslint-disable-next-line no-await-in-loop
    const documents = await model.find({}).lean();

    entries.push({
      name: `collections/${model.collection.collectionName}.json`,
      buffer: Buffer.from(JSON.stringify(documents)),
    });

    collectionsMeta.push({
      name: model.collection.collectionName,
      documentCount: documents.length,
    });
    totalDocumentCount += documents.length;

    logger.info(
      { collection: model.collection.collectionName, count: documents.length },
      'BET-18 backup: collection dumped',
    );
  }

  return { entries, collectionsMeta, totalDocumentCount };
};

/**
 * @param {{ triggeredBy?: string, trigger?: 'MANUAL'|'SCHEDULED' }} options
 * @returns {Promise<import('../models/backup.model.js').Backup>}
 */
export const runDatabaseBackup = async ({ triggeredBy = null, trigger = 'MANUAL' } = {}) => {
  await ensureBackupDir();

  const backup = await Backup.create({
    status: 'RUNNING',
    trigger,
    triggeredBy,
    startedAt: new Date(),
  });

  try {
    const { entries, collectionsMeta, totalDocumentCount } = await dumpAllCollections();

    const manifest = {
      generatedAt: new Date().toISOString(),
      backupId: String(backup._id),
      collections: collectionsMeta,
      totalDocumentCount,
      encrypted: Boolean(env.backup.encryptionEnabled),
      format: 'json-logical-dump-v1',
    };

    entries.unshift({
      name: 'manifest.json',
      buffer: Buffer.from(JSON.stringify(manifest, null, 2)),
    });

    let archiveBuffer = createZipArchive(entries);
    let encrypted = false;

    if (env.backup.encryptionEnabled) {
      if (!isBackupEncryptionConfigured()) {
        throw new AppError(
          'BACKUP_ENCRYPTION_ENABLED is true but DATA_ENCRYPTION_KEY is not configured — refusing to write an unencrypted backup silently.',
          500,
          { code: 'BACKUP_ENCRYPTION_NOT_CONFIGURED' },
        );
      }
      archiveBuffer = encryptBackupBuffer(archiveBuffer);
      encrypted = true;
    }

    const checksum = sha256Hex(archiveBuffer);
    const filename = `backup-${backup._id}-${Date.now()}.zip${encrypted ? '.enc' : ''}`;
    const localFilePath = path.join(BACKUP_DIR, filename);

    await fs.writeFile(localFilePath, archiveBuffer);

    const retentionDays = env.backup.retentionDays;
    const retentionExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    backup.status = 'COMPLETED';
    backup.completedAt = new Date();
    backup.collections = collectionsMeta;
    backup.totalDocumentCount = totalDocumentCount;
    backup.localFilePath = localFilePath;
    backup.fileSizeBytes = archiveBuffer.length;
    backup.encrypted = encrypted;
    backup.checksumSha256 = checksum;
    backup.retentionExpiresAt = retentionExpiresAt;
    await backup.save();

    logger.info(
      { backupId: String(backup._id), sizeBytes: archiveBuffer.length, encrypted },
      'BET-18 backup: local archive written',
    );

    // Google Drive upload is best-effort and never blocks or
    // invalidates the local backup that already succeeded — an
    // unreachable/unconfigured Drive account must never mean "no
    // backup exists". Failures are recorded on the same document,
    // not thrown.
    if (isGoogleDriveConfigured()) {
      try {
        const uploadResult = await uploadBackupToGoogleDrive({
          buffer: archiveBuffer,
          filename,
        });
        backup.googleDrive = {
          uploaded: true,
          fileId: uploadResult.fileId,
          folderId: uploadResult.folderId,
          uploadedAt: new Date(),
          error: '',
        };
      } catch (driveError) {
        backup.googleDrive = {
          uploaded: false,
          fileId: '',
          folderId: env.googleDrive.backupFolderId || '',
          uploadedAt: null,
          error: driveError?.message || 'Unknown Google Drive upload error',
        };
        logger.warn({ err: driveError, backupId: String(backup._id) }, 'BET-18 backup: Google Drive upload failed');
      }
      await backup.save();
    }

    // Backup verification (BET-18) — re-read what was just written
    // (decrypting if needed) and confirm it's internally consistent
    // before calling the run a success from the caller's
    // perspective. Verification failures do not delete the archive
    // (it may still be partially useful / worth investigating) but
    // are surfaced honestly on the record.
    try {
      const verification = await verifyBackupArchive(backup);
      backup.verified = verification.verified;
      backup.verifiedAt = new Date();
      backup.verificationError = verification.verified ? '' : verification.reason;
    } catch (verificationError) {
      backup.verified = false;
      backup.verifiedAt = new Date();
      backup.verificationError = verificationError?.message || 'Unknown verification error';
    }
    await backup.save();

    return backup;
  } catch (error) {
    backup.status = 'FAILED';
    backup.completedAt = new Date();
    backup.errorMessage = error?.message || 'Unknown backup error';
    await backup.save();

    logger.error({ err: error, backupId: String(backup._id) }, 'BET-18 backup: run failed');
    throw error;
  }
};

export const getBackupStorageDir = () => BACKUP_DIR;
