import mongoose from 'mongoose';

/**
 * BET-18 — one document per backup run, doubling as the "backup
 * monitoring" data source (master prompt: "Backup monitoring") and
 * the record `restore.service.js` reads to locate/decrypt/verify a
 * specific backup. Deliberately its own narrow collection
 * (`backup_runs`), mirroring the `SecurityEvent`/
 * `SensitiveRecordAccessLog`/`IntegrationLog` convention already
 * established in BET-03/BET-07/BET-16 — a monitoring/audit trail for
 * one subsystem, not folded into the general `AuditLog` (which still
 * separately records the *administrative action* of triggering a
 * backup/restore via `recordAdministrativeAction`, same split BET-03
 * drew for authentication events).
 */

const BACKUP_STATUSES = Object.freeze([
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'PURGED', // retention-expired; file(s) removed, record kept for history
]);

const BACKUP_TRIGGERS = Object.freeze(['MANUAL', 'SCHEDULED']);

const backupSchema = new mongoose.Schema(
  {
    status: { type: String, enum: BACKUP_STATUSES, default: 'RUNNING', index: true },
    trigger: { type: String, enum: BACKUP_TRIGGERS, default: 'MANUAL' },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },

    // What actually got dumped.
    collections: [
      {
        name: { type: String, trim: true },
        documentCount: { type: Number, default: 0 },
      },
    ],
    totalDocumentCount: { type: Number, default: 0 },

    // Local, on-disk artifact (this sandbox/host's filesystem —
    // see `database-backup.service.js` for why local storage is
    // always written even when Google Drive upload also succeeds:
    // an unreachable Drive account must never mean "no backup
    // exists at all").
    localFilePath: { type: String, trim: true, default: '' },
    fileSizeBytes: { type: Number, default: 0 },
    encrypted: { type: Boolean, default: false },
    checksumSha256: { type: String, trim: true, default: '' },

    // Google Drive (BET-18 "Google Drive backup") — populated only
    // when `env.googleDrive` is actually configured and the upload
    // succeeded. Never fabricated when not configured.
    googleDrive: {
      uploaded: { type: Boolean, default: false },
      fileId: { type: String, trim: true, default: '' },
      folderId: { type: String, trim: true, default: '' },
      uploadedAt: { type: Date, default: null },
      error: { type: String, trim: true, default: '' },
    },

    // Backup verification (BET-18) — set by
    // `backup-verification.service.js` right after creation:
    // decrypts (if applicable), re-reads the archive, and confirms
    // every collection's document count in the archive matches what
    // was recorded above.
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verificationError: { type: String, trim: true, default: '' },

    // Restore testing (BET-18) — set by `restore.service.js`'s
    // `runRestoreTest`, which restores into a disposable, isolated
    // scratch database (never the live one) purely to prove the
    // archive is actually restorable, then drops the scratch
    // database. Independent of `verified` above (verification only
    // checks the archive's internal consistency; a restore test
    // proves it round-trips through a real `mongoose`/MongoDB
    // insert).
    restoreTestedAt: { type: Date, default: null },
    restoreTestPassed: { type: Boolean, default: null },
    restoreTestError: { type: String, trim: true, default: '' },

    // Retention (BET-18) — computed at creation time from
    // `env.backup.retentionDays`; `backup-retention.service.js`
    // reads this rather than recomputing it, so changing the env
    // var later doesn't retroactively change the expiry of backups
    // already taken.
    retentionExpiresAt: { type: Date, default: null, index: true },

    errorMessage: { type: String, trim: true, default: '' },

    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

backupSchema.index({ status: 1, startedAt: -1 });

export const BACKUP_STATUS_VALUES = BACKUP_STATUSES;
export const BACKUP_TRIGGER_VALUES = BACKUP_TRIGGERS;

export const Backup = mongoose.model('Backup', backupSchema, 'backup_runs');
