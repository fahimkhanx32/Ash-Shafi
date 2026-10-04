# `modules/audit-logs/` — self-service slice (FET-20 minimal slice, 2026-08-20) + admin viewer (FET-20 prerequisite backend, 2026-08-21)

## Self-service slice (unchanged from 2026-08-20)

`GET /api/v1/audit-logs/me` (`routes/audit-log.routes.js` →
`controllers/audit-log.controller.js` → `listMyAuditLogs` in
`services/audit-log-query.service.js`). Requires only `authenticate`
(no `AUDIT_READ`) and returns exclusively the calling user's own
`AuditLog` entries — the same self-service boundary
`GET /notifications/me` already uses. Narrow filters: `category`,
`action`, `from`/`to`, `page`/`limit`.

## Admin viewer (new, 2026-08-21)

This folder was previously reserved scaffolding for a future admin
audit-log viewer. That viewer is now built, as prerequisite backend
work for FET-20's frontend (the admin Audit screens need a real
endpoint to call — they never got fake/mocked data instead):

- `GET /api/v1/audit-logs` — cross-user list. `authenticate` +
  `authorize(PERMISSIONS.AUDIT_READ)` (today: DIRECTOR, ADMIN,
  SOFTWARE_OWNER, SUPER_ADMIN — see `security/permissions.js`). This
  is what "Audit data must respect backend permissions" (the
  client's own FET-20 wording) means in practice: the permission
  check happens here, at the route layer, not in the frontend.
  Filters: `actor`, `actorRole`, `category`, `action`, `resourceType`,
  `resourceId`, `patientId`, `outcome`, `search` (matches `action`/
  `resourceType` only), `from`/`to`, `page`/`limit`.
- `GET /api/v1/audit-logs/:id` — single-entry "Audit details"
  drill-down. Same `AUDIT_READ` gate.

Both reuse the existing `AuditLog` model/collection — no new writer,
no parallel schema. `oldValue`/`newValue` (rarely populated — see
`audit/audit.model.js`) are excluded from both responses' projection;
this stays a *log of what happened*, not a channel for record
contents.

### What this admin viewer does NOT cover (by design, not oversight)

- **Authentication/security events** (`LOGIN_SUCCESS`, `LOGIN_FAILED`,
  `ACCOUNT_LOCKED`, session lifecycle, etc.) live in the separate
  `security_events` collection (`auth/security-event.model.js`,
  BET-03) — never mirrored into `audit_logs` (see `audit/
  audit.model.js`'s own docstring). The admin-tier equivalent for
  that collection is `listSecurityEventsAdmin` in
  `auth/security-event.service.js`, exposed via
  `GET /api/v1/security-admin/events` (see
  `modules/security-admin/README.md`) — not this module.
- **Sensitive-record access** (gynecology/obstetrics) and **medical
  report access** already have their own dedicated, purpose-built
  logs (`modules/gynecology/models/sensitive-record-access-log.model.js`,
  `modules/reports/models/report-access-log.model.js`) with their own
  existing access-control services. This admin viewer does not query
  either — a future checkpoint that specifically needs to surface
  those in one combined admin screen should add an explicit,
  separately-reviewed endpoint for each, not fold sensitive
  reproductive-health access records into the general-purpose
  `audit_logs` viewer.
- **Backup management** — that's `modules/backups` (BET-18), already
  complete, with its own `SYSTEM_ADMIN`-gated routes.

The `repositories/`, `schemas/`, `types/` subfolders remain empty —
not needed here, since this reuses `AuditLog` from `src/audit/`
directly rather than introducing a parallel model.

The actual audit-writing infrastructure remains at the project root
under `src/audit/`:

- `audit/audit.model.js` — the `AuditLog` model (`audit_logs`
  collection).
- `audit/audit.constants.js` — the fixed `AUDIT_ACTIONS` list.
- `audit/audit.service.js` — `recordAuditEvent` and the
  `recordUserAction`/`recordAdministrativeAction`/
  `recordClinicalAccess`/`recordCreation`/`recordExport` convenience
  wrappers that controllers across the project call.

Building the frontend admin screens against these endpoints is the
remaining, still-unbuilt part of FET-20 — this checkpoint is backend
only.
