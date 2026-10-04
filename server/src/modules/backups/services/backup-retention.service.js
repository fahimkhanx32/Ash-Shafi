/**
 * BET-18 — Backup retention.
 *
 * Deliberately mirrors `modules/data-lifecycle/services/
 * data-lifecycle.service.js`'s shape (BET-17 checkpoint 4) rather
 * than reinventing a second retention pattern: read a fixed,
 * documented policy (`env.backup.retentionDays`), act only on
 * exactly what that policy names, record every action, and never run
 * as a silent background sweep — no scheduler exists in this project
 * (see that module's own note; the same gap applies here), so this
 * is an explicit, manually/administratively triggered operation.
 *
 * A hard safety floor: this never deletes the single most recent
 * `COMPLETED` backup, even if it is technically past its retention
 * window (e.g. the schedule/retention env vars were misconfigured, or
 * no newer backup has run since) — leaving the system with zero
 * recoverable backups is a worse failure mode than keeping one
 * slightly-stale one past its nominal window.
 */

import fs from 'node:fs/promises';

import { logger } from '../../../config/logger.js';
import { Backup } from '../models/backup.model.js';
import { deleteBackupFromGoogleDrive, isGoogleDriveConfigured } from './google-drive-backup.service.js';

/**
 * @returns {Promise<{ purged: number, kept: number, errors: { backupId: string, error: string }[] }>}
 */
export const purgeExpiredBackups = async () => {
  const now = new Date();

  const mostRecentCompleted = await Backup.findOne({ status: 'COMPLETED' })
    .sort({ startedAt: -1 })
    .select('_id');

  const candidates = await Backup.find({
    status: 'COMPLETED',
    retentionExpiresAt: { $lte: now },
    ...(mostRecentCompleted ? { _id: { $ne: mostRecentCompleted._id } } : {}),
  });

  let purged = 0;
  const errors = [];

  for (const backup of candidates) {
    try {
      if (backup.localFilePath) {
        // eslint-disable-next-line no-await-in-loop
        await fs.rm(backup.localFilePath, { force: true });
      }

      if (isGoogleDriveConfigured() && backup.googleDrive?.uploaded && backup.googleDrive?.fileId) {
        // eslint-disable-next-line no-await-in-loop
        await deleteBackupFromGoogleDrive(backup.googleDrive.fileId);
      }

      backup.status = 'PURGED';
      backup.localFilePath = '';
      // eslint-disable-next-line no-await-in-loop
      await backup.save();
      purged += 1;

      logger.info({ backupId: String(backup._id) }, 'BET-18 backup retention: expired backup purged');
    } catch (error) {
      errors.push({ backupId: String(backup._id), error: error?.message || 'Unknown error' });
      logger.warn({ err: error, backupId: String(backup._id) }, 'BET-18 backup retention: purge failed for one backup');
    }
  }

  const kept = await Backup.countDocuments({ status: 'COMPLETED' });

  return { purged, kept, errors };
};
