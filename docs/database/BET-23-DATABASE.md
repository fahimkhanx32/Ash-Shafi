# BET-23 Checkpoint 23.7 — Database Documentation

_2026-08-15_

Documents the actual MongoDB/Mongoose data layer: collections, real
relationships (verified via `ref:` fields in the schemas, not assumed),
key indexes, production index-build process, data ownership/isolation,
and how this connects to the backup/restore system. No ERD is claimed —
relationships below are read directly from schema `ref:` declarations.

## 1. Connection & configuration

`src/config/database.js` — single Mongoose connection, `mongoose.connect(env.database.uri, mongooseOptions)`:

| Option | Value | Why |
|---|---|---|
| `autoIndex` | `false` in production, `true` otherwise | Explicit index builds via `npm run indexes` in production — see §4 |
| `maxPoolSize` / `minPoolSize` | 20 / 5 | Reviewed for a single-process deployment (`docs/performance/BET-23-PERFORMANCE.md`) |
| `serverSelectionTimeoutMS` / `connectTimeoutMS` | 10,000 | Bounds initial connection attempts |
| `socketTimeoutMS` | 45,000 | Bounds per-operation hangs |
| `retryWrites` | `true` | MongoDB driver-level retry for transient write failures |
| `family` | 4 | Prefer IPv4 |

Connection retry (BET-23): `DB_CONNECT_RETRY_ATTEMPTS` (default 5) additional
attempts with exponential backoff (`DB_CONNECT_RETRY_DELAY_MS`, default
2000ms, doubling, capped at 30s) before the process exits non-zero. DNS
resolvers are pinned to `DNS_PRIMARY`/`DNS_SECONDARY` (default
`1.1.1.1`/`8.8.8.8`) to work around SRV-record resolution issues some
networks have with Atlas.

## 2. Collections

`server/src/database/indexes.js` recursively discovers every
`*.model.js` file under `src/` and registers it with Mongoose — the
authoritative live list is `mongoose.modelNames()` at runtime, not a
hand-maintained document. As of this snapshot there are **39 model
files**: 4 at the project root (`User`, `Session`, `SecurityEvent`,
`AuditLog`) and 35 under `modules/*/models/`.

| Model | Collection concern | Module |
|---|---|---|
| `User` | Account identity, role, credentials (Argon2 hash) | `src/users/user.model.js` |
| `Session` | Refresh-token/session tracking & rotation | `src/auth/session.model.js` |
| `SecurityEvent` | Auth-security event log (BET-03) | `src/auth/security-event.model.js` |
| `AuditLog` | Central audit trail (BET-17) | `src/audit/audit.model.js` |
| `Role` | System role catalog | `modules/roles/` |
| `StaffProfile` | Staff/doctor profile | `modules/staff/` |
| `PatientProfile` | Patient demographic/clinical-summary record | `modules/patients/` |
| `GynecologyRecord`, `SensitiveRecordAccessLog` | Sensitive clinical record + its own access log | `modules/gynecology/` |
| `PregnancyRecord` | Obstetric record (reuses `SensitiveRecordAccessLog`) | `modules/obstetrics/` |
| `Encounter` | Clinical consultation record | `modules/encounters/` |
| `Appointment`, `DoctorSchedule`, `BlockedDate` | Scheduling | `modules/appointments/` |
| `QueueEntry` | Same-day visit queue | `modules/queue/` |
| `Medicine` | Reference-data drug catalog | `modules/medicines/` |
| `Prescription` | Versioned prescriptions | `modules/prescriptions/` |
| `Investigation` | Ordered lab/imaging investigation | `modules/investigations/` |
| `MedicalReport`, `ReportAccessLog` | Uploaded/generated report + its own access log | `modules/reports/` |
| `Conversation`, `Message`, `MessagingAccessLog` | Messaging | `modules/messaging/` |
| `Notification` | In-app notifications | `modules/notifications/` |
| `Fee`, `Invoice` | Billing (both live under `modules/billing/` — see architecture doc §3) | `modules/billing/` |
| `Payment`, `Refund` | Payment gateway records | `modules/payments/` |
| `VideoSession`, `VideoSessionAuditLog` | Video consultation + its own audit log | `modules/video-calls/` |
| `Backup` | Backup run records | `modules/backups/` |
| `IntegrationLog` | Webhook/outbound-integration event log | `modules/integrations/` |
| `Page`, `Service`, `Media`, `AboutContent`, `HomepageStat` | Public-website CMS | `modules/cms/` |
| `ExportRequest` | Controlled-export single-use token | `modules/exports/` |
| `AccountDeletionRequest` | Self-service account-deletion request | `modules/users/` |

## 3. Key relationships (verified via `ref:` fields)

Not exhaustive — the high-traffic clinical/scheduling/financial graph:

```
User (patient) ──< PatientProfile
User (doctor)  ──< DoctorSchedule, Appointment.doctor, Encounter.provider

PatientProfile ──< Appointment.patientProfile
PatientProfile ──< Encounter.patientProfile
PatientProfile ──< Prescription.patientProfile
PatientProfile ──< MedicalReport.patientProfile
PatientProfile ──< Invoice.patientProfile / Payment.patientProfile
PatientProfile ──< GynecologyRecord.patient (1:1)
PatientProfile ──< PregnancyRecord (1:many — one document per pregnancy)

Appointment ──< QueueEntry.appointment (1:1, unique)
Appointment ──< Encounter.appointment
Appointment ──1 VideoSession (video-consultation appointments only)
Appointment.rescheduledFrom / .rescheduledTo ── Appointment (self-referential, reschedule chain)

Encounter.relatedInvestigations[] ──> Investigation
Encounter.relatedPrescriptions[]  ──> Prescription

Invoice.fee ──> Fee
Invoice ──< Payment.invoice

Conversation(patient, doctor) ──< Message.conversation  (unique on {patient, doctor} pair)

ExportRequest.patientProfile ──> PatientProfile
```

Every clinical/financial write also carries `createdBy`/`updatedBy` (or
an equivalent actor field) `ref: 'User'` — the audit-attribution pattern
is consistent across modules, confirmed by grep rather than assumed.

## 4. Indexes and the production build process

**Production index-build process (BET-23)**: `autoIndex: false` in
production (§1) — indexes must be built explicitly via `npm run indexes`
(`src/database/indexes.js`), which:

1. Recursively discovers every `*.model.js` file under `src/`.
2. Dynamically imports each so its schema registers with Mongoose.
3. Calls `.createIndexes()` on every registered model, reporting each
   one's success/failure/duration independently — one model's failure
   (e.g. a duplicate-key collision on a partial unique index against
   pre-existing data) does not hide or block any other model's result.
4. Exits non-zero (`process.exitCode = 1`) if any model failed to
   import or failed to build — a CI/deploy pipeline should treat this
   script's exit code as a gate.

Run this once per environment as a controlled deploy step (ideally
during a maintenance window or before the first instance starts
serving traffic) — never rely on it happening implicitly at boot in
production.

**Representative compound/unique indexes** (audited against real query
shapes as part of checkpoint 23.1, re-confirmed here by reading the
actual schema files):

| Model | Index | Purpose |
|---|---|---|
| `PatientProfile` | `{ patientId: 1 }`, `{ firstName: 1, lastName: 1 }`, `{ phone: 1 }`, `{ patientStatus: 1, isActive: 1 }` | Lookup by id/name/phone; active-patient filtering |
| `Appointment` | `{ doctor: 1, appointmentDate: 1, status: 1 }`, `{ patientProfile: 1, appointmentDate: -1 }` | Doctor's schedule view; a patient's appointment history |
| `Encounter` | `{ patientProfile: 1, encounterDate: -1 }`, `{ provider: 1, encounterDate: -1 }` | Patient clinical timeline; a doctor's encounter list |
| `Prescription` | `{ patientProfile: 1, prescriptionDate: -1 }`, `{ prescriptionGroupId: 1, versionNumber: 1 }` | Patient prescription history; versioned-prescription lookup |
| `MedicalReport` | `{ patientProfile: 1, status: 1, uploadDate: -1 }`, `{ isSensitive: 1, patientProfile: 1, uploadDate: -1 }`, `{ 'originalDocument.fileHash': 1 }` | Report listing/filtering; duplicate-file detection |
| `QueueEntry` | `{ appointment: 1 }` (unique), `{ doctor: 1, queueDate: 1, tokenNumber: 1 }` (unique) | One queue entry per appointment; unique token per doctor per day |
| `Conversation` | `{ patient: 1, doctor: 1 }` (unique) | One conversation per patient–doctor pair |
| `Invoice` | `{ patientProfile: 1, status: 1 }`, `{ status: 1, issuedDate: -1 }` | Patient billing view; outstanding-invoice queries |
| `AuditLog` | `{ createdAt: -1 }`, `{ category: 1, createdAt: -1 }`, `{ actor: 1, createdAt: -1 }`, `{ patientId: 1, createdAt: -1 }` | Time-ordered audit review by category/actor/patient |
| `Notification` | `{ recipient: 1, createdAt: -1 }`, `{ recipient: 1, readAt: 1 }` | A user's notification list; unread-count queries |

This is a representative subset, not the complete index list — the
full, authoritative set is whatever `npm run indexes` reports as
built for each model; this document should not be treated as a
substitute for that script's own output.

## 5. Data ownership, isolation & sensitive records

- **Patient data isolation**: every clinical/financial query that
  isn't role-wide is scoped by `patientProfile`/`patient` and further
  gated by the ownership check in the service layer (§4 of the
  architecture doc) — a `PATIENT` actor can only ever resolve their own
  records; a mismatch returns `404`, not `403`.
- **Sensitive clinical records**: `GynecologyRecord` and
  `PregnancyRecord` reads/writes are gated through
  `enforceSensitiveRecordAccess` and independently logged to
  `SensitiveRecordAccessLog`, separate from the general `AuditLog` —
  every access (not just writes) is recorded, per master-prompt
  sensitive-data requirements (BET-07/08).
- **Field-level encryption**: `security/encryption.js` (`FIELD_ENCRYPTION_KEY`)
  encrypts select sensitive fields at rest, independent of the backup
  archive's own AES-256-GCM (different key/format — see
  `docs/backup/DISASTER_RECOVERY.md`).
- **Audit history**: `AuditLog` (`src/audit/`) is `NEVER_DELETE`/
  `SOFT_DELETE_ONLY` per `modules/data-lifecycle/policy/retention-policy.js`'s
  catalog — see §6.

## 6. Retention policy & backup/restore implications

`modules/data-lifecycle/policy/retention-policy.js` classifies every
collection as `NEVER_DELETE`, `SOFT_DELETE_ONLY`, `AUTO_TTL`, or
`PURGE_ELIGIBLE`. Every clinical, financial, audit-trail, and
account-identity collection is `NEVER_DELETE` or `SOFT_DELETE_ONLY`.
Only two categories are ever `PURGE_ELIGIBLE`: the audit trail past its
own configured retention window, and read non-clinical notifications
past theirs — unread notifications are never purged regardless of age.
`POST /api/v1/data-lifecycle/purge` rejects any collection outside
`PURGE_ELIGIBLE` outright.

**Backup implication**: `modules/backups/services/database-backup.service.js`
dumps every registered `mongoose.modelNames()` collection via
`.find({}).lean()` into a JSON logical archive (no `mongodump` binary
available in this environment — a deliberate, documented trade-off, not
a silent downgrade; see `docs/backup/DISASTER_RECOVERY.md`). Restore
(`services/restore.service.js`) is per-collection
`deleteMany`+`insertMany`, **not** wrapped in a single multi-collection
MongoDB transaction unless run against a replica set — the "restore is
not fully transactional on a standalone instance" limitation is
documented in `docs/backup/RESTORE_PROCEDURE.md` and repeated here
because it's a direct consequence of this database layer's own
connection topology, not a bug in the restore code.

## 7. Verification performed this checkpoint

- Model inventory (§2) built by `find server/src/modules -name "*.model.js"`
  plus the 4 root-level model files, cross-checked against
  `src/database/indexes.js`'s own recursive-discovery logic — not typed
  from memory.
- Every relationship in §3 traced from an actual `ref: 'ModelName'`
  field via `grep -rn "ref:"` across every model file, not inferred
  from naming convention.
- Every index in §4's table read directly from the owning model's
  `.index(...)` call, not carried over from the checkpoint 23.1 prior
  summary without re-checking.
- Cross-checked the retention-policy claim in §6 against
  `modules/data-lifecycle/policy/retention-policy.js`'s actual
  classification, and the backup-implication claim against
  `database-backup.service.js`/`restore.service.js`.
- Did not enumerate every field of every schema — this document
  describes structure and relationships at the level needed for
  operational/architectural understanding, not a full field-by-field
  schema reference.
