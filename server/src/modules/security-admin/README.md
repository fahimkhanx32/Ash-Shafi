# `modules/security-admin/` — FET-20 prerequisite backend (2026-08-21)

Built as prerequisite backend for FET-20's frontend "Security
Administration" section (dashboard, active sessions, account
security, security/authentication events, alerts). Before this, no
admin-tier endpoint existed for viewing or acting on *another* user's
session/account security — only self-service `/auth/sessions` and
`/auth/change-password` existed. Building the frontend against
nothing would have meant either fabricated data or frontend-only
security, both explicitly against this project's rules — so this
module exists first.

All routes mounted at `/api/v1/security-admin`, all require
`authenticate` plus one of two permission tiers:

- **`AUDIT_READ`** (today: DIRECTOR, ADMIN, SOFTWARE_OWNER,
  SUPER_ADMIN) — every read endpoint: `GET /dashboard`,
  `GET /sessions`, `GET /accounts/:userId/security`, `GET /events`,
  `GET /alerts`. Same tier that can already browse the general audit
  log (`modules/audit-logs`).
- **`SYSTEM_ADMIN`** (today: SOFTWARE_OWNER, SUPER_ADMIN only) — the
  two mutating endpoints: `DELETE /sessions/:sessionId` (revoke
  another user's session) and `POST /accounts/:userId/unlock`
  (clear an account lockout). Same owner-tier bar `modules/backups`
  uses for its own high-impact operations.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Aggregated counts: active sessions, locked accounts (now / last 24h), protected accounts, users by status, login success/failure last 24h, refresh-token-reuse signals last 7d. |
| GET | `/sessions` | Cross-user active-session list. Filters: `userId`, `search` (matches user name/email/username), `page`/`limit`. |
| DELETE | `/sessions/:sessionId` | Revoke any user's session. Body: `{ reason }` (min 10 chars, required — same confirmation-reason shape as `modules/backups`' restore endpoint). |
| GET | `/accounts/:userId/security` | One user's security posture: lock state, failed-attempt count, last login, password-changed date, active session count, recent security-event count, `isProtected` flag. |
| POST | `/accounts/:userId/unlock` | Clears `failedLoginAttempts`/`lockedUntil`. Body: `{ reason }`. Deliberately allowed even for protected (Owner/Director) accounts — unlocking is protective, not a demotion, and those two fields are not in `users/user.model.js`'s `GUARDED_PROTECTED_FIELDS`. |
| GET | `/events` | Cross-user authentication/security-event feed (`security_events` collection). Filters: `userId`, `type`, `ipAddress`, `from`/`to`, `page`/`limit`. |
| GET | `/alerts` | Derived alerts from real, already-recorded signals only: accounts currently locked, `ACCOUNT_LOCKED` events in the last 24h, `REFRESH_TOKEN_REUSE_DETECTED` events in the last 7d. No new anomaly-detection logic invented — this reads existing fields/events, it does not add a new detection pipeline. |

## What this deliberately does NOT do

- **No force-lock endpoint.** Only *unlocking* is exposed. Giving an
  admin the power to lock out an arbitrary account (including a
  protected one) is a meaningfully different, higher-risk capability
  than clearing an existing lockout, and wasn't part of what was
  asked for — adding it later should be its own explicit, reviewed
  decision, not a side effect of this checkpoint.
- **No MFA administration.** This project's `User` model has no MFA
  fields today; nothing here fabricates an MFA status the backend
  doesn't actually track.
- **No emergency ownership transfer.** Master prompt §10 describes
  that as its own explicit, MFA-gated, fully-audited privileged
  operation — out of scope here; `unlockAccountAdmin` never touches
  `role`/`status`/`isProtected` (all three remain guarded by
  `users/user.model.js`'s protected-account hooks regardless of
  which route calls into Mongoose).
- **No new audit-log category.** Mutating actions here
  (`SESSION_REVOKED_BY_ADMIN`, `ACCOUNT_UNLOCKED_BY_ADMIN`) are
  recorded in *both* `security_events` (added to
  `SECURITY_EVENT_TYPES` in `auth/security-event.model.js`) and the
  general `audit_logs` administrative-action trail (via
  `recordAdministrativeAction`, new `AUDIT_ACTIONS` entries in
  `audit/audit.constants.js`) — same dual-recording pattern
  `modules/backups`' controllers already use for their own
  administrative actions.

Building the frontend screens against these endpoints remains the
actual FET-20 frontend work — this checkpoint is backend only.
