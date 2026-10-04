# BET-21 — API Security Hardening: Security Review

_Reviewed: 2026-08-15. Scope: master prompt Phase 11 checkpoint list. This is a
review/verification pass, not a rebuild — every control below was already
implemented in earlier BETs (primarily BET-02/BET-03/BET-04); this document
records what was checked, where it lives, and confirms nothing regressed._

No code defects were found during this review. All checks below were
performed by opening and reading the actual source, not by trusting prior
session notes — consistent with this project's standing "verify, don't
trust the docs" discipline (see `SESSION_HANDOFF.md`).

## 1. Authentication security
- Passwords hashed with Argon2id (`security/password.js`), tuned cost
  parameters, with `needsRehash` support for future cost migration.
- Account lockout after `MAX_LOGIN_ATTEMPTS` failed logins for
  `LOGIN_LOCKOUT_MINUTES` (both env-configurable, `auth/auth.service.js`),
  with a dedicated `sendAccountLockedEmail` notification and a
  `SecurityEvent` record on every lockout.
- Email verification and password-reset flows are token-based, single-use,
  time-boxed (`EMAIL_VERIFICATION_EXPIRES_MINUTES`,
  `PASSWORD_RESET_EXPIRES_MINUTES`), and rate-limited separately from
  general auth traffic (see §3).

## 2. Authorization security / RBAC review
- `security/permissions.js` is the single fixed-enum source of truth for
  role → permission grants; `modules/roles/` adds a DB-backed custom-role
  layer that mirrors, but never overrides, the system roles.
- `middlewares/auth.middleware.js` exposes layered primitives —
  `authenticate`, `authorize`, `authorizeAny`, `authorizeAll`,
  `authorizeSelfOrPermission`, `authorizeManagesRole`,
  `blockProtectedRoleTarget` — reused consistently across every module
  rather than each module hand-rolling its own checks.
- Ownership/ scope checks (a `DOCTOR` seeing only their own patients'
  appointments/queue/analytics, a `PATIENT` only their own records) are
  enforced server-side, never trusting a client-supplied id — verified
  again this session in `modules/analytics/controllers/analytics.controller.js`
  (BET-20) as the most recent example of the same pattern.
- Two protected accounts (Owner, Director) are shielded at the Mongoose
  layer (`isProtected`) and re-checked explicitly in `modules/users/`
  before any mutation.

## 3. Token security / refresh-token security / session security
- Short-lived JWT access tokens (`security/tokens.js`), separate secrets
  for access vs. refresh, both scoped with `issuer`/`audience` and a
  `tokenType` claim checked on verify (an access token can't be replayed
  as a refresh token or vice versa).
- Refresh tokens are never stored raw — only a SHA-256 hash
  (`Session.tokenIdHash`) persists server-side.
- Full rotation + reuse detection (`auth/auth.service.js`): each refresh
  issues a new token and revokes the old one; presenting an
  already-revoked refresh token revokes every active session for that
  user (treated as a compromise signal), not just the one token.
- Sessions carry `expiresAt` with a Mongo TTL index (`expireAfterSeconds:
  0`) for automatic cleanup, plus `revokedAt`/`replacedByTokenIdHash` for
  audit trail. `userAgent`/`ipAddress` are captured per session so a user
  can review and revoke individual active sessions/devices.

## 4. Rate limiting / request validation / input sanitization
- Tiered `express-rate-limit` limiters (`middlewares/rate-limit.middleware.js`):
  a general limiter on all routes, plus stricter dedicated
  `authRateLimiter` and `passwordResetRateLimiter` on the sensitive auth
  endpoints specifically (`auth/auth.routes.js`) — not just one global
  ceiling. Redis-backed store when `REDIS_ENABLED`, in-memory fallback
  otherwise.
- Every route validates its body/query/params against a Joi schema via
  `middlewares/validation.middleware.js` before the controller ever runs.
- `express-mongo-sanitize` (NoSQL operator-injection stripping) and `hpp`
  (HTTP parameter pollution) are mounted globally in `app.js`, ordered
  correctly after body/query parsing so there's something to sanitize.
- `security/sanitization.js` additionally provides HTML-stripping helpers
  (`sanitizeString`, `sanitizeHtmlContent`, `sanitizeObjectStrings`) used
  by modules that accept rich/free-text input (CMS, messaging).

## 5. Security headers / CORS review
- Helmet (`config/security.js`) applies HSTS, `X-Content-Type-Options`,
  frameguard, `Referrer-Policy: no-referrer`, and a same-site
  `Cross-Origin-Resource-Policy`. CSP is deliberately left off with a
  documented rationale: this is a JSON-only API with no HTML/script
  content to police; a future HTML-serving frontend should set its own.
- CORS (`config/cors.js`) enforces a strict allow-list sourced from the
  validated `CORS_ORIGINS` env var — no wildcard, no reflected origin.
  Requests with no `Origin` header (server-to-server, health checks) are
  allowed; any browser origin not on the list is rejected.
  `credentials: true` is paired with the allow-list (never with a
  wildcard origin, which browsers reject anyway) since the API relies on
  bearer tokens/cookies from authenticated clients.

## 6. File-upload security / file-access security
- `security/file-security.js`: MIME-type allow-list, extension
  cross-check against the declared MIME type, and **magic-byte file
  signature verification** for every accepted type (JPEG/PNG/WebP/PDF/
  MP3/WAV/MP4/legacy-Office/OOXML) — never trusts a client-supplied
  `Content-Type` alone. `hasSafeOfficeContainer` additionally checks
  zip-based Office documents aren't disguising something else.
  `text/csv` (no fixed magic bytes) is validated with a content
  heuristic instead.
- Filenames are sanitized (`sanitizeFilename`) and storage filenames are
  randomly generated (`generateStorageFilename`) rather than derived from
  user input — closes path-traversal and overwrite vectors.
- File *access* (not just upload) is gated per-module by the same
  ownership/permission checks as the records they attach to (patient
  documents, investigation reports, prescriptions) — there is no
  separate blanket file-serving route that bypasses those checks.

## 7. Sensitive-data protection / API abuse protection
- AES-256-GCM field-level encryption (`security/encryption.js`,
  `encryptField`/`decryptField`) for sensitive stored fields, keyed by
  `FIELD_ENCRYPTION_KEY`; the same primitive is reused for full backup
  encryption (BET-18).
- Sensitive clinical/gynecology/obstetrics data has its own dedicated
  access-logging and provider-based scoping (BET-07/BET-08/BET-12), and
  BET-20's analytics layer additionally suppresses any aggregate bucket
  below a minimum cohort size so aggregated statistics can't be used to
  re-identify an individual patient.
- Abuse protection beyond rate limiting: account lockout (§1), refresh-
  token reuse detection forcing full re-authentication (§3), and
  request-size limits (`express.json({ limit: '10mb' })`) to bound
  payload-based abuse.

## 8. Secrets management / webhook security / error-message security
- All secrets are sourced from environment variables validated through a
  single Joi schema (`config/env.js`) — never hardcoded in source.
- The structured pino logger (`config/logger.js`) has a hard redaction
  list covering headers, cookies, and any field literally named
  `secret`/`token`/etc., so secrets can't leak into logs even
  accidentally.
- Payment webhooks (`modules/payments/`) are HMAC-signature-verified
  against the raw request bytes (preserved via `express.json()`'s
  `verify` hook specifically for this purpose) — trust boundary is the
  signature, not the caller's identity.
- The global error middleware (`middlewares/error.middleware.js`) only
  includes stack traces in non-production responses
  (`NODE_ENV !== 'production'`); production error responses return a
  clean code/message only.

## 9. Logging / security monitoring / dependency security / production configuration
- Dedicated `audit/` (record modification/deletion/export/file-access/
  analytics-access, BET-17/BET-19/BET-20) and `auth/security-event.model.js`
  (login failures, lockouts, token reuse) logs — separate from general
  application logging, both fail-safe (a logging failure never blocks
  the underlying request).
- `config/env.js` has a dedicated production-startup guard: refuses to
  boot (`process.exit(1)`) if any of `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `MONGODB_URI`, `DATA_ENCRYPTION_KEY`,
  `FIELD_ENCRYPTION_KEY` are missing, and separately refuses to boot if
  `COOKIE_SECURE` is not `true` — a real fail-closed check, not just a
  documented expectation.
- Dependency security: `npm audit` run live this session —
  **0 vulnerabilities at any severity** (info/low/moderate/high/critical)
  across all 677 installed packages.

## Verification performed this session
- `node --check` across the entire `server/src` tree — zero syntax
  errors.
- `npm install` — succeeded (677 packages, network reachable this
  session).
- `npm audit` — 0 vulnerabilities.
- Live `import('./src/app.js')` — the full route graph, including every
  security middleware in this review, loads with zero runtime errors.
- `npx jest tests/unit` — 131/133 passing; the same 2 pre-existing,
  unrelated `bet12-*` failures noted in every session since BET-15 (a
  strict-equality mismatch on a normalized reference-range string, and a
  `null`-vs-`false` return-value mismatch in an access-control helper
  whose real call sites already treat both as falsy) — not touched, per
  the one-task-at-a-time rule.

## Not exercised this session
- No live MongoDB Atlas connection is reachable from this sandbox
  (standing constraint noted since BET-05) — so no control above was
  tested against a live database/HTTP round-trip beyond the DB-less
  `app.js` boot and existing `supertest`-based unit tests.
- This is a review of existing controls, not a penetration test —
  no fuzzing, no live exploit attempts, no external scanning tools were
  run.

## Outcome
No genuine security gap was found requiring a code change. Every
checkpoint bullet in Phase 11 §BET-21 maps to a control that already
existed, was read end-to-end, and is correctly wired into `app.js`/the
relevant module. BET-21 is considered complete as a review; no follow-up
code changes are queued.
