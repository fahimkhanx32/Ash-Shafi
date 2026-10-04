import env from '../../../config/env.js';

/**
 * BET-17 Checkpoint 4 — Data ownership / lifecycle rules (master
 * prompt §38, §83, §84, §95).
 *
 * This is the single source of truth for how every collection in the
 * system is allowed to be disposed of. It exists so "what's our
 * retention policy for X" and "is it ever safe to permanently delete
 * X" have one authoritative, reviewable answer instead of being
 * scattered/implicit across a dozen modules — the same "narrow,
 * purpose-built" philosophy this project's earlier BET-17 checkpoints
 * already established for their own logs.
 *
 * This file is a CATALOG, not an enforcement mechanism by itself.
 * `services/data-lifecycle.service.js` is what actually reads
 * `deletionMode` before running anything, and it hard-codes its own
 * purge handlers only for the two categories below flagged
 * `PURGE_ELIGIBLE` — a category being listed here does NOT mean a
 * generic deletion path exists for it. Master prompt §83/§84 are
 * explicit that nothing may ever "reset the database" or "silently
 * destroy medical history" — the only categories this project ever
 * physically deletes rows from are non-clinical, non-financial, and
 * already individually justified below.
 */

export const DELETION_MODES = Object.freeze({
  // Clinical, financial, or legally-required audit-trail record.
  // Retained indefinitely. An account/record can be deactivated or
  // anonymized (see the account-deletion workflow, BET-17 checkpoint
  // 3), but the underlying document is never physically removed by
  // any code path in this project.
  NEVER_DELETE: 'NEVER_DELETE',

  // A "delete" in the product sense only ever flips a status/flag
  // (isActive, isDeleted, patientStatus, etc.) — the row itself is
  // retained forever. Already implemented by the owning module; this
  // module does not add a second deletion path for these.
  SOFT_DELETE_ONLY: 'SOFT_DELETE_ONLY',

  // Already expires and is removed automatically by a MongoDB TTL
  // index on the owning model — not something this module needs to
  // (or should) purge manually.
  AUTO_TTL: 'AUTO_TTL',

  // Genuinely safe to physically delete once past its retention
  // window: non-clinical, non-financial, and not itself a system-of-
  // record for any other module's foreign key. This is the ONLY
  // deletionMode `data-lifecycle.service.js`'s purge operation will
  // ever act on.
  PURGE_ELIGIBLE: 'PURGE_ELIGIBLE',

  // Retention/rotation for this category belongs to a different,
  // already-numbered task in the master prompt's own roadmap
  // (BET-18 — Backup, Recovery & Data Protection) — listed here only
  // so this catalog gives a complete data-ownership picture. This
  // module does not touch backup files.
  DEFERRED_TO_BACKUP_MODULE: 'DEFERRED_TO_BACKUP_MODULE',
});

/**
 * `retentionDays` is either a fixed number, `null` (indefinite / not
 * applicable), or a zero-arg function when the true value is only
 * known at runtime (driven by `.env`, per master prompt §38's
 * "exact retention policy must be configurable"). Callers should use
 * `getRetentionPolicy()` below rather than reading this array
 * directly, so function-valued entries are always resolved.
 */
export const RETENTION_POLICY = Object.freeze([
  {
    key: 'PATIENT_CLINICAL_RECORDS',
    label: 'Patient demographics & medical history',
    owner: 'modules/patients',
    collections: ['patient_profiles'],
    deletionMode: DELETION_MODES.NEVER_DELETE,
    retentionDays: null,
    rationale:
      'Clinical record integrity (master prompt §84 — "never allow a UI operation to accidentally destroy patient history"). Account closure only deactivates via deactivatePatientProfile (BET-06), never deletes.',
  },
  {
    key: 'GYNECOLOGY_OBSTETRIC_RECORDS',
    label: 'Gynecology, obstetric/pregnancy records & their access log',
    owner: 'modules/gynecology, modules/obstetrics',
    collections: [
      'gynecology_records',
      'pregnancy_records',
      'sensitive_record_access_logs',
    ],
    deletionMode: DELETION_MODES.NEVER_DELETE,
    retentionDays: null,
    rationale:
      'Sensitive reproductive/sexual-health history (master prompt §16) and its dedicated BET-07 access log — access is permission- and audit-gated, never deleted.',
  },
  {
    key: 'CLINICAL_ENCOUNTERS_AND_ORDERS',
    label: 'Consultations, prescriptions, investigations & medical reports',
    owner:
      'modules/encounters, modules/prescriptions, modules/investigations, modules/reports',
    collections: [
      'encounters',
      'prescriptions',
      'investigations',
      'medical_reports',
      'report_access_logs',
    ],
    deletionMode: DELETION_MODES.NEVER_DELETE,
    retentionDays: null,
    rationale:
      'Medical-data-model principle (master prompt §50) — clinical records preserve history via versioning/amendment, never overwrite or delete.',
  },
  {
    key: 'BILLING_FINANCIAL_RECORDS',
    label: 'Fees, invoices, payments & refunds',
    owner: 'modules/billing, modules/payments',
    collections: ['fees', 'invoices', 'payments', 'refunds'],
    deletionMode: DELETION_MODES.NEVER_DELETE,
    retentionDays: null,
    rationale:
      'Financial/accounting/audit record — an invoice can be cancelled (status change) but is never physically removed.',
  },
  {
    key: 'ACCOUNT_DELETION_REQUESTS',
    label: 'Account deletion requests',
    owner: 'modules/users (account-deletion)',
    collections: ['account_deletion_requests'],
    deletionMode: DELETION_MODES.NEVER_DELETE,
    retentionDays: null,
    rationale:
      'Master prompt §38 — "audit trail retained". This record IS that audit trail (its own append-only `history` array); it is never itself deleted, even after processing.',
  },
  {
    key: 'USER_ACCOUNTS',
    label: 'User accounts (staff, doctors, patients, administrators)',
    owner: 'modules/users',
    collections: ['users'],
    deletionMode: DELETION_MODES.SOFT_DELETE_ONLY,
    retentionDays: null,
    rationale:
      'A processed deletion request anonymizes and deactivates the account (BET-17 checkpoint 3) — the row survives so every clinical/financial/audit foreign key that references it (actor, patient, requestedBy, etc.) stays valid. Never physically deleted.',
  },
  {
    key: 'SESSIONS',
    label: 'Authentication sessions',
    owner: 'auth',
    collections: ['sessions'],
    deletionMode: DELETION_MODES.AUTO_TTL,
    retentionDays: null,
    rationale:
      'A MongoDB TTL index (`expireAfterSeconds: 0` on `expiresAt`) already removes expired sessions automatically — no manual purge needed or performed here.',
  },
  {
    key: 'AUDIT_TRAIL',
    label: 'General audit log & authentication security events',
    owner: 'audit, auth (security events)',
    collections: ['audit_logs', 'security_events'],
    deletionMode: DELETION_MODES.PURGE_ELIGIBLE,
    retentionDays: () => env.audit.retentionDays,
    rationale:
      'Configurable via AUDIT_LOG_RETENTION_DAYS (default 2555 days / ~7 years). Audit logs are otherwise protected (master prompt §45 — "audit logs must themselves be protected") — eligible for deletion only once an individual entry is older than this configured window, and only through this module\'s explicit, owner-tier, password-confirmed purge operation. Never automatic, never silent.',
  },
  {
    key: 'IN_APP_NOTIFICATIONS',
    label: 'In-app notifications (read only)',
    owner: 'modules/notifications',
    collections: ['notifications'],
    deletionMode: DELETION_MODES.PURGE_ELIGIBLE,
    retentionDays: () => env.dataLifecycle.notificationRetentionDays,
    rationale:
      'Ephemeral, deliberately non-clinical delivery records (master prompt §85 already keeps their content generic — "Your appointment has been updated", never clinical detail). Only notifications that have been READ and are older than the configured window are ever purge-eligible; unread notifications are never purged regardless of age.',
  },
  {
    key: 'MESSAGING',
    label: 'Patient-doctor conversations & messages',
    owner: 'modules/messaging',
    collections: ['conversations', 'messages', 'messaging_access_logs'],
    deletionMode: DELETION_MODES.SOFT_DELETE_ONLY,
    retentionDays: null,
    rationale:
      'Messages are soft-deleted only (BET-13, master prompt §84). A deleted message\'s Cloudinary attachment is physically removed at delete-time as its own already-controlled, already-audited operation (`MESSAGE_DELETE`); the message row itself is retained as a moderation/compliance trail.',
  },
  {
    key: 'WEBSITE_CMS_CONTENT',
    label: 'Public website pages, services, stats & media',
    owner: 'modules/cms',
    collections: [
      'website_pages',
      'website_services',
      'website_media',
    ],
    deletionMode: DELETION_MODES.SOFT_DELETE_ONLY,
    retentionDays: null,
    rationale:
      'Public, non-clinical marketing content. Create/update/publish/delete is already fully audited by BET-16\'s own controllers (`CMS_PAGE_DELETE`, `MEDIA_DELETE`, etc.) — a genuine, already-controlled deletion path that removes the specific record/asset the operator chose. Not part of this module\'s generic, retention-window-driven purge.',
  },
  {
    key: 'BACKUPS',
    label: 'Database backups',
    owner: 'backup (BET-18)',
    collections: ['(file storage / Google Drive — not a MongoDB collection)'],
    deletionMode: DELETION_MODES.DEFERRED_TO_BACKUP_MODULE,
    retentionDays: () => env.backup.retentionDays,
    rationale:
      'Backup retention/rotation is BET-18\'s own concern per the master prompt roadmap — listed here only so this catalog gives a complete data-ownership picture. This module never reads or deletes a backup file.',
  },
]);

/**
 * Resolves any function-valued `retentionDays` entries so callers
 * always get a plain, JSON-serializable catalog.
 */
export const getResolvedRetentionPolicy = () =>
  RETENTION_POLICY.map((entry) => ({
    ...entry,
    retentionDays:
      typeof entry.retentionDays === 'function'
        ? entry.retentionDays()
        : entry.retentionDays,
  }));

export const getPurgeEligibleKeys = () =>
  RETENTION_POLICY.filter(
    (entry) => entry.deletionMode === DELETION_MODES.PURGE_ELIGIBLE,
  ).map((entry) => entry.key);
