# Disaster Recovery Procedure

This document covers what BET-18 actually built, its real limitations, and the decision process for an incident — not an idealized recovery plan for infrastructure this project doesn't have.

## What "disaster recovery" means for this project today

Ash-Shāfī runs as a single Node/Express application against a single MongoDB deployment (`MONGODB_URI` in `.env` — may or may not be a replica set; `config/database.js` doesn't assume one). There is no multi-region failover, no standby database, and no automated backup schedule (no task scheduler dependency exists in this codebase — see `modules/backups/services/database-backup.service.js` and `modules/data-lifecycle/services/data-lifecycle.service.js`, both of which flag the same gap). Disaster recovery here means: **restoring from the most recent verified backup**, manually triggered, following `RESTORE_PROCEDURE.md`.

## What kind of disaster this backup format protects against, and what it doesn't

`runDatabaseBackup()` performs a **full logical dump** — every document in every registered Mongoose model's collection, serialized to JSON — not a binary/BSON `mongodump` snapshot (no `mongodump` binary is available in this environment). This is a deliberate, documented trade-off:

- **Protects against:** accidental mass deletion, a bad migration/script, data corruption from an application bug, a compromised admin account making destructive changes, loss of the database host itself (restore into a fresh MongoDB instance from the archive).
- **Does not protect against, on its own:** loss of anything created *after* the most recent backup (there is no continuous replication or point-in-time recovery — the recovery point objective is exactly "as of the last successful backup run"), or a compromise of the backup archives themselves if `DATA_ENCRYPTION_KEY` is also compromised (the same key that encrypts backups is used elsewhere in the app — rotate it as part of any credential-compromise response, not just as a backup-specific step).
- **Not preserved exactly:** MongoDB-specific binary type fidelity that a true `mongodump`/BSON snapshot would keep bit-for-bit. Every model's `.lean()` output is serialized the same way this application already serializes every API response (`JSON.stringify`), so anything already representable in an API response round-trips through a backup/restore cycle correctly — this has been true throughout the project (see BET-01 onward), so no new class of data-fidelity risk is introduced here specifically.

## Where backups actually live

- **Local disk**, always: `server/storage/backups/` on whatever host runs the backup. This is a single point of failure by itself — if that host's disk is what's destroyed, the local copy is destroyed with it. This is exactly why Google Drive upload exists as a second, off-host copy.
- **Google Drive**, when `GOOGLE_DRIVE_CLIENT_ID/SECRET` + `GOOGLE_DRIVE_REFRESH_TOKEN` are configured — best-effort, uploaded immediately after the local write succeeds. Check `GET /backups/:id`'s `googleDrive.uploaded` field; do not assume a backup reached Drive just because it completed locally.

**Operational recommendation** (not automated by this codebase): configure Google Drive credentials in every environment that matters, and periodically confirm (`GET /backups`) that recent backups actually show `googleDrive.uploaded: true`, not just `status: COMPLETED`.

## Incident decision tree

1. **Is data actually lost/corrupted, or is this a display bug?** Check the relevant module's own audit trail first (e.g. `AuditLog`, `SensitiveRecordAccessLog`) — many apparent "data loss" reports turn out to be a query or permission bug, not missing data. A full restore is the highest-cost, highest-risk response available; use it only when the data genuinely isn't there.
2. **Is the damage scoped to specific records, or the whole database?** A full restore (`RESTORE_PROCEDURE.md`) rolls back *every* collection to the backup's point in time, including collections that were fine. If only a handful of records are affected and their prior state exists elsewhere (an audit log, a paired collection, a user's own report of what it should say), fixing them directly is lower-risk than a full restore.
3. **If a full restore is genuinely warranted:** follow `RESTORE_PROCEDURE.md` exactly, including the mandatory restore-test step. Do not skip it under time pressure — a restore test costs seconds and runs against a disposable scratch database; a bad real restore costs the rest of the database.
4. **After recovery:** notify affected users/staff of the recovery point (what time period of activity, if any, was lost), and file a follow-up on the root cause separately from the recovery itself.

## Recovery Time Objective / Recovery Point Objective (stated, not enforced by code)

- **RPO:** up to `BACKUP_SCHEDULE`'s intended interval if a scheduler is later wired up (currently: however often someone manually calls `POST /backups`, since no scheduler exists yet — see the gap noted above).
- **RTO:** dominated by how quickly staff notice the incident, retrieve the right backup, and follow the runbook — not by the restore operation itself, which typically completes in seconds to low minutes depending on database size, since it's a direct `deleteMany`/`insertMany` per collection with no external tooling in the loop.

Neither RPO nor RTO is currently enforced or monitored by any code in this project — they are operational targets for whoever runs this system to hold themselves to, stated here so the gap is visible rather than assumed away.
