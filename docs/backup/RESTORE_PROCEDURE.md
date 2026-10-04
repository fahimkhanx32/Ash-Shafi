# Restore Procedure

This is the step-by-step runbook for `POST /backups/:id/restore` (BET-18). Read `DISASTER_RECOVERY.md` first if this is an actual incident, not a drill — it covers when to reach for this document versus a smaller/targeted fix.

## Before you start

1. **Confirm you actually need a full restore.** This operation deletes and replaces every collection named in the backup archive with that archive's contents. It is not a way to recover one accidentally-deleted record — for that, check whether the affected record has its own audit trail (`AuditLog`, or a module-specific access log) to reconstruct it by hand instead.
2. **Pick the right backup.** `GET /backups?status=COMPLETED` lists candidates, newest first. Only restore from a backup where `verified: true`. If the most recent backup is `verified: false`, walk backward to the newest verified one and accept the resulting data loss for anything created after it — or investigate why verification failed before trusting it.
3. **Run a restore test first, every time**, even under time pressure: `POST /backups/:id/restore-test`. This proves the exact archive you're about to restore from is actually readable and inserts cleanly, using a disposable scratch database — it can never affect production, so there's no reason to skip it. If the restore test fails, do not proceed to the real restore with that backup; pick an older one and re-test.

## Running the restore

4. Call `POST /backups/:id/restore` with:
   - `password` — your own current account password (re-verified server-side)
   - `confirm: true` — explicit, not inferred
   - `reason` — a written explanation, at least 10 characters, for the audit trail
5. The endpoint requires `system:admin` (`SOFTWARE_OWNER`/`SUPER_ADMIN` only). It refuses to run if the backup isn't `COMPLETED` or isn't `verified`.
6. For each collection recorded in the backup's manifest, the operation deletes all existing documents in that collection and inserts the archive's copies in their place. This happens collection-by-collection, not inside a single multi-document transaction spanning the whole database — see "Known limitation" below.
7. The response lists every collection restored and its document count. Cross-check this against what you expected before considering the incident resolved.
8. Every restore attempt — success or denial — is written to `AuditLog` (`RESTORE_EXECUTED` / `RESTORE_DENIED`). Review it afterward as part of your incident write-up.

## After the restore

9. Spot-check a handful of records the way a real user would (log in as a test/admin account and view a patient record, an appointment, a recent invoice) rather than trusting the count-based response alone.
10. Notify whoever depends on the data that a restore occurred and from what point in time, so they know what activity since that backup was lost.
11. If the restore was needed because of a bug (not an infrastructure failure), file that separately — restoring data doesn't fix whatever caused the loss.

## Known limitation: no cross-collection transaction

Each collection is restored independently (`deleteMany` then `insertMany`), not wrapped in a single MongoDB multi-document transaction spanning every collection in the archive. A restore interrupted partway through (process crash, connection loss) can leave some collections restored to the backup's point-in-time and others still on whatever data was live before the restore started. This project's MongoDB deployment is not guaranteed to be a replica set (see `config/database.js` — it connects to whatever `MONGODB_URI` points at), and Mongoose transactions require one, so a transaction-wrapped restore isn't reliably available in every environment this code runs in. If the restore is interrupted, the safe recovery is to re-run `POST /backups/:id/restore` with the same backup — every collection's `deleteMany`+`insertMany` step is naturally idempotent against that same archive, so re-running it to completion converges on the same end state.
