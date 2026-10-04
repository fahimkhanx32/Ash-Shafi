import { runDatabaseBackup } from '../services/database-backup.service.js';
import { purgeExpiredBackups } from '../services/backup-retention.service.js';
import { runRestoreTest, restoreToProduction } from '../services/restore.service.js';
import { Backup } from '../models/backup.model.js';

import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordAdministrativeAction } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

const summarize = (backup) => ({
  id: backup._id.toString(),
  status: backup.status,
  trigger: backup.trigger,
  startedAt: backup.startedAt,
  completedAt: backup.completedAt,
  collections: backup.collections,
  totalDocumentCount: backup.totalDocumentCount,
  fileSizeBytes: backup.fileSizeBytes,
  encrypted: backup.encrypted,
  checksumSha256: backup.checksumSha256,
  googleDrive: backup.googleDrive,
  verified: backup.verified,
  verifiedAt: backup.verifiedAt,
  verificationError: backup.verificationError,
  restoreTestedAt: backup.restoreTestedAt,
  restoreTestPassed: backup.restoreTestPassed,
  restoreTestError: backup.restoreTestError,
  retentionExpiresAt: backup.retentionExpiresAt,
  errorMessage: backup.errorMessage,
});

// Trigger a backup right now (master prompt "Database backup"). No
// scheduler runs this automatically (see database-backup.service.js
// docstring); every call is `trigger: 'MANUAL'` today.
export const triggerBackupController = async (req, res, next) => {
  try {
    const backup = await runDatabaseBackup({ triggeredBy: req.user._id, trigger: 'MANUAL' });

    await recordAdministrativeAction(req, {
      action: backup.status === 'COMPLETED' ? AUDIT_ACTIONS.BACKUP_COMPLETED : AUDIT_ACTIONS.BACKUP_FAILED,
      resourceType: 'Backup',
      resourceId: backup._id,
      metadata: {
        status: backup.status,
        totalDocumentCount: backup.totalDocumentCount,
        verified: backup.verified,
        googleDriveUploaded: backup.googleDrive?.uploaded || false,
      },
    });

    return sendSuccess(res, {
      statusCode: 201,
      message:
        backup.status === 'COMPLETED'
          ? 'Backup completed successfully.'
          : 'Backup run failed. See errorMessage for detail.',
      data: summarize(backup),
      requestId: req.requestId,
    });
  } catch (error) {
    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.BACKUP_FAILED,
      resourceType: 'Backup',
      outcome: 'DENIED',
      reason: error?.code || error?.message || 'UNKNOWN_ERROR',
    });
    return next(error);
  }
};

// Backup monitoring (master prompt "Backup monitoring").
export const listBackupsController = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;

    const filter = status ? { status } : {};
    const total = await Backup.countDocuments(filter);
    const backups = await Backup.find(filter)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return sendPaginated(res, {
      message: 'Backup history retrieved successfully.',
      items: backups.map(summarize),
      page,
      limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getBackupController = async (req, res, next) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) {
      return next(Object.assign(new Error('Backup not found.'), { statusCode: 404, code: 'BACKUP_NOT_FOUND' }));
    }

    return sendSuccess(res, {
      message: 'Backup retrieved successfully.',
      data: summarize(backup),
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// Backup retention (master prompt "Backup retention") — explicit,
// manually/administratively triggered, same reasoning as
// `data-lifecycle`'s purge: no scheduler exists in this project yet.
export const purgeExpiredBackupsController = async (req, res, next) => {
  try {
    const result = await purgeExpiredBackups();

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.BACKUP_RETENTION_PURGE_EXECUTED,
      resourceType: 'Backup',
      metadata: result,
    });

    return sendSuccess(res, {
      message: 'Expired backups purged per the configured retention policy.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// Restore testing (master prompt "Restore testing") — always safe:
// restores into a disposable scratch database, never production.
export const runRestoreTestController = async (req, res, next) => {
  try {
    const result = await runRestoreTest(req.params.id);

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.RESTORE_TEST_EXECUTED,
      resourceType: 'Backup',
      resourceId: req.params.id,
      metadata: result,
    });

    return sendSuccess(res, {
      message: result.passed
        ? 'Restore test passed — this backup archive restores cleanly.'
        : 'Restore test failed. See error for detail.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// The one genuinely destructive endpoint in this module. See
// `restore.service.js#restoreToProduction` for the full confirmation
// contract (password + explicit confirm + written reason +
// SYSTEM_ADMIN permission, on top of this route's own authorization
// gate) — deliberately the same shape as
// `data-lifecycle.controller.js#purgeExpiredDataController`.
export const restoreToProductionController = async (req, res, next) => {
  const { password, confirm, reason } = req.body;

  try {
    const result = await restoreToProduction({
      backupId: req.params.id,
      actorId: req.user._id,
      password,
      confirm,
      reason,
    });

    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.RESTORE_EXECUTED,
      resourceType: 'Backup',
      resourceId: req.params.id,
      metadata: { reason, results: result.results },
    });

    return sendSuccess(res, {
      message: 'Production data restored from the selected backup.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    await recordAdministrativeAction(req, {
      action: AUDIT_ACTIONS.RESTORE_DENIED,
      resourceType: 'Backup',
      resourceId: req.params.id,
      outcome: 'DENIED',
      reason: error?.code || error?.message || 'UNKNOWN_ERROR',
    });
    return next(error);
  }
};
