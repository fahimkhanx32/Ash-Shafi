# `modules/data-lifecycle` — BET-17 Checkpoint 4

Implements the four remaining BET-17 roadmap items: **permanent
deletion where appropriate**, **retention policies**, **controlled
deletion**, and **data ownership/lifecycle rules** (master prompt
§38/§45/§83/§84).

## What lives here

- `policy/retention-policy.js` — the catalog. Every collection in the
  system, classified as `NEVER_DELETE`, `SOFT_DELETE_ONLY`,
  `AUTO_TTL`, or `PURGE_ELIGIBLE`, with its owning module and the
  reasoning behind that classification. This is the "data
  ownership/lifecycle rules" deliverable.
- `services/data-lifecycle.service.js` — `getRetentionPolicy()`
  (read the catalog), `previewExpiredData()` (dry-run counts, no
  deletion), and `purgeExpiredData()` (the actual controlled,
  permanent-deletion operation).
- `controllers/`, `validators/`, `routes/` — `GET
  /api/v1/data-lifecycle/policy` (`audit:read`), `GET
  /api/v1/data-lifecycle/preview` (`system:admin`), `POST
  /api/v1/data-lifecycle/purge` (`system:admin`).

## Why only two categories are actually purge-eligible

Master prompt §83 ("Never reset the database... never delete all
patients... never delete all medical records") and §84 ("Never allow
a UI operation to accidentally destroy patient history... prescriptions
... reports... pregnancy records... billing history... audit
history") rule out physical deletion for every clinical, financial,
and audit-trail collection in this project. What's left, once every
clinical/financial/audit/account-identity collection is excluded, is
exactly two genuinely non-clinical, non-financial categories with no
other module's foreign key depending on the row surviving:

1. **The audit trail itself, past its own configured retention
   window** (`AUDIT_LOG_RETENTION_DAYS`, default ~7 years) —
   `audit_logs` + `security_events`.
2. **Read, non-clinical in-app notifications, past their configured
   retention window** (`NOTIFICATION_RETENTION_DAYS`, default 180
   days) — unread notifications are never touched regardless of age.

Every other collection — patients, gynecology/obstetric records,
encounters, prescriptions, investigations, medical reports, billing,
payments, user accounts, account-deletion requests, messages — is
`NEVER_DELETE` or `SOFT_DELETE_ONLY` in the catalog and this module
has no code path that can delete them. A request naming one of those
categories is rejected (`rejected` in the response), never silently
skipped or, worse, honored.

## Why this isn't a scheduled job

`jobs/` is empty scaffolding and no scheduler (`node-cron` or
similar) is installed anywhere in this project yet. Automating this
on a recurring schedule needs that infrastructure, which is
BET-18's concern (Backup, Recovery & Data Protection also needs a
scheduler) — not this checkpoint's, per master prompt §98 ("do not
implement unrelated features merely because they are visible in the
roadmap"). `POST /purge` is therefore an explicit, manually-triggered,
owner-tier operation today — which is also exactly the "explicit
privileged operation... confirmation... audit log... reason...
timestamp... actor" shape master prompt §10 asks for from any
irreversible privileged action, reused here for a different one.

## The confirmation contract

`POST /purge` requires all of:

- `system:admin` permission (today: `SOFTWARE_OWNER`, `SUPER_ADMIN`
  only — see `security/permissions.js`)
- the caller's own current account password (re-verified server-side,
  the same bar `account-deletion.service.js#requestAccountDeletion`
  already set for another irreversible account-security action)
- `confirm: true`, explicit, never defaulted
- a written `reason` of at least 10 characters

Every call — success or rejection — is recorded via
`recordAdministrativeAction` (`DATA_RETENTION_PURGE_EXECUTED` /
`DATA_RETENTION_PURGE_DENIED`) in the general `AuditLog`. There is no
MFA gate — this project has not built MFA yet (see
`users/user.model.js`'s and `modules/users/services/user.service.js`'s
own notes on this), so this module does not claim one it doesn't
have.
