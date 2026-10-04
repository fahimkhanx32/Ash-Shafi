# BET-23 Checkpoint 23.6 — Deployment

_2026-08-15_

Covers: production configuration, deployment readiness, environment
documentation, infrastructure documentation. **Containerization is out of
scope for this checkpoint by explicit instruction** — the operator is
deploying via their own Docker setup, so no `Dockerfile`/`docker-compose`
files were created. This document instead covers everything a Docker (or
any other) deployment needs to know about the application itself: how to
configure it, how to verify it's ready, what every environment variable
does, and what infrastructure it depends on.

## 1. Production configuration

What "production mode" actually changes in this application, all driven
by `NODE_ENV=production`:

| Behavior | Where | Detail |
|---|---|---|
| Fail-closed secrets/config guard | `config/env.js` | Refuses to boot if `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`MONGODB_URI`/`DATA_ENCRYPTION_KEY`/`FIELD_ENCRYPTION_KEY` are missing, too short, look like placeholders, or are reused between secrets that must be independent (BET-23 checkpoint 23.5); also requires `COOKIE_SECURE=true`, `ENABLE_DEV_ROUTES` not `true`, and `SERVER_URL`/`CLIENT_WEB_URL` to use HTTPS. |
| Mongoose `autoIndex` disabled | `config/database.js` | Indexes are built explicitly via `npm run indexes` (see §2) as a controlled deploy step, not implicitly on every process boot — avoids competing with live traffic for collection locks. |
| Structured (non-pretty) logging | `config/logger.js` | `pino-pretty` is only used outside production; production logs stay machine-parseable JSON. `LOG_PRETTY=true` in production produces a boot-time warning, not a hard block. |
| Error responses omit stack traces | `middlewares/error.middleware.js` | `err.stack` is only included in the JSON error body outside production — production responses never leak internals to a client, while still logging the full stack server-side at `error`/`fatal` level. |
| Test-database guard | `config/env.js` | Inverse direction: if `NODE_ENV=test`, boot refuses to start if `MONGODB_URI` looks like it references a production database — protects production data from an accidental test run, not the other way around. |

Everything else (rate limiting, CORS allow-list, Helmet headers, RBAC,
audit logging, etc.) is environment-agnostic — already correctly
configured for production use regardless of `NODE_ENV`, per BET-21's full
security review.

## 2. Deployment readiness checklist

Steps an operator should follow for a first deploy or a redeploy,
independent of whatever container/orchestration layer wraps them:

1. **Install dependencies**: `npm ci` (not `npm install`) in `server/` for
   a reproducible, lockfile-exact install in any deploy environment.
2. **Configure `.env`**: copy `.env.example` to `.env` and fill in every
   value under §3 marked "Required in production". Generate `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY`, `FIELD_ENCRYPTION_KEY`
   fresh per environment — never reuse a development secret in production,
   and never reuse the same value across the two JWT secrets or the two
   encryption keys (enforced by the boot guard in §1, but should be
   correct before that guard is even relied on).
3. **Build indexes**: `npm run indexes` (`src/database/indexes.js`)
   against the target database, ideally during a maintenance window or
   before the first instance starts serving traffic — `autoIndex` is
   disabled in production (§1) specifically so this is a deliberate,
   controlled step rather than an implicit one.
4. **Seed required accounts**: `npm run seed` (`src/database/seed.js`) —
   idempotent (safe to re-run; only creates what's missing), provisions
   the Owner/Director/initial-admin accounts and the fixed system roles.
   Requires `OWNER_*`/`DIRECTOR_*`/`INITIAL_ADMIN_*` variables to be set
   first (§3).
5. **Start the process**: `npm start` (`node src/server.js`). Startup logs
   (structured, via the `logger`) report the port, environment, and health
   check URL once listening — confirm these before considering the deploy
   live.
6. **Verify liveness and readiness**: `GET /health` should return `200`
   almost immediately (liveness — the process is up). `GET /health/ready`
   should return `200` once MongoDB (and Redis, if `REDIS_ENABLED=true`)
   are actually reachable — this now includes a real database ping, not
   just a cached connection flag (BET-23 checkpoint 23.4). A `503` here
   after startup has had time to settle means a dependency is
   unreachable — check `checks.database.ping.error`/`checks.redis` in the
   response body before assuming the deploy itself is broken.
7. **Point orchestrator health checks at the right endpoints**: liveness
   probe → `GET /health`; readiness probe → `GET /health/ready`. Do not
   use the same endpoint for both — a liveness probe pointed at
   `/health/ready` would restart a perfectly healthy process during a
   transient database blip that `GET /health/ready` correctly reports as
   temporarily not-ready but that the process itself would have recovered
   from on its own (BET-23 checkpoint 23.4's connection-retry/reconnect
   behavior — see `docs/reliability/RECOVERY_PROCEDURES.md`).
8. **Confirm graceful shutdown works** in the target environment: send
   `SIGTERM` to the process and confirm it exits cleanly (exit code `0`)
   within `SHUTDOWN_TIMEOUT_MS` (default 10s) — this is what an
   orchestrator does on every rolling deploy/scale-down, so it needs to be
   verified once per deployment target, not assumed.
9. **Confirm backup credentials are configured** (`GOOGLE_DRIVE_*`,
   `BACKUP_ENABLED`) if off-host backups are wanted — see
   `docs/backup/DISASTER_RECOVERY.md`. No scheduler exists in this
   codebase (§4); a periodic `POST /api/v1/backups` call needs to be
   triggered by something outside the application itself (cron, an
   orchestrator's scheduled job, etc.).

## 3. Environment documentation

`server/.env.example` is the authoritative, always-current reference (137
variables as of this checkpoint, every one validated by `config/env.js`'s
Joi schema with an explicit default where one is safe to have) — this
section is a navigable map of it, not a duplicate. Grouped by the
section headers already in `.env.example`:

| Section | Purpose | Required in production? |
|---|---|---|
| Application | Port, URLs, app name/version, shutdown timeout (BET-23) | `SERVER_URL`/`CLIENT_WEB_URL` must be HTTPS |
| MongoDB | Connection string, DB name, DNS resolvers, startup-retry tuning (BET-23) | `MONGODB_URI` required always |
| JWT / Authentication | Access/refresh token secrets and lifetimes | Both secrets required, strength-checked (BET-23 checkpoint 23.5) |
| Password security | Argon2 tuning, password policy | Has safe defaults |
| Cookie security | `COOKIE_SECURE`, `SameSite`, domain | `COOKIE_SECURE=true` required |
| CORS | Allow-listed origins | Set to real frontend origin(s), not `*` |
| Cloudinary | Media/document storage provider | Required if file upload features are used |
| File upload limits | Per-mime-type size caps | Has safe defaults |
| OCR / medical document extraction | Tesseract/pdftoppm binary paths, timeouts | Optional — OCR degrades to manual review if unset |
| Email (SMTP) | Transactional email | Optional — mailer fails soft (logs, doesn't throw) if unset |
| SMS | SMS provider credentials | Optional integration |
| WhatsApp | WhatsApp Business API + inbound webhook verification | Optional integration |
| Google / Google Drive | OAuth login + backup off-host upload | Optional — backups still work locally without it |
| Payment gateway | Provider credentials + webhook secret | Required if online payments are used; manual payment recording works without it |
| Email verification / Password reset / Account security / OTP | Token TTLs, attempt limits | Has safe defaults |
| Rate limiting | Window/max-request tuning | Has safe defaults |
| Socket.IO | CORS origins for the realtime layer | Set to real frontend origin(s) |
| Messaging | Attachment limits | Has safe defaults |
| Redis | `REDIS_ENABLED` + connection details | Optional — most features work with it disabled; recommended for multi-instance deployments (see §4) |
| Encryption | `DATA_ENCRYPTION_KEY`/`FIELD_ENCRYPTION_KEY` | Required, strength-checked (BET-23 checkpoint 23.5) |
| Backup | Schedule intent, retention | Optional — no scheduler exists (§4), so this only configures manually-triggered backups |
| Audit logging | Retention | Has safe defaults |
| Data lifecycle / retention | Purge policy | Has safe defaults |
| Logging | Level, pretty-print toggle | `LOG_PRETTY=true` warns (not blocks) in production |
| Medical record settings | Domain-specific tuning | Has safe defaults |
| FHIR | Version string | Has safe defaults |
| Telemedicine | Feature toggles | Has safe defaults |
| Video consultation | Provider selection, ICE servers, join-window timing | `VIDEO_PROVIDER=native` requires no external credentials; a non-native provider needs its own credentials |
| Application owner / Main doctor / Initial admin / Initial passwords | Seed-time account provisioning (§2 step 4) | Required before first `npm run seed` |
| System | Misc | Has safe defaults |
| Development | Dev-only toggles (`ENABLE_DEV_ROUTES`, etc.) | Must be unset/`false` in production (enforced, §1) |

Every variable's exact accepted type/format/range is enforced by the Joi
schema in `config/env.js` — that file, not this document, is the source of
truth if the two ever disagree (this document should be updated to match
if that happens, not the other way around).

## 4. Infrastructure documentation

What this application needs to run, independent of how it's packaged:

- **Node.js** `>= 20.0.0`, **npm** `>= 10.0.0` (`server/package.json`
  `engines`). ESM-native (`"type": "module"`) — no build/transpile step is
  required to run it.
- **MongoDB** — any deployment MongoDB can reach via `MONGODB_URI`
  (Atlas or self-hosted; `config/database.js` doesn't assume Atlas
  specifically, though DNS resolvers default to public resolvers to work
  around SRV-record resolution issues some networks have with Atlas). No
  requirement that it be a replica set for ordinary operation; a replica
  set is required only for the one video-session flow that uses
  `session.withTransaction()` (per `SESSION_HANDOFF.md`'s BET-22 notes) —
  confirm replica-set status if that flow needs to be exercised.
- **Redis** — optional (`REDIS_ENABLED=false` by default). Recommended if
  running more than one API process/instance behind a load balancer,
  since some in-process behavior (documented in
  `docs/performance/BET-23-PERFORMANCE.md`'s "Known limitation" notes) is
  per-process without it. Not required for a single-instance deployment.
- **Outbound network access** required for: the configured MongoDB host;
  Cloudinary (if used); SMTP host (if used); any configured third-party
  API (SMS/WhatsApp/Google/payment gateway) actually enabled via its
  respective env vars; Google Drive (if backup off-host upload is
  configured).
- **Inbound network access** required on `PORT` (default `5000`) for the
  single HTTP server that serves both the REST API and the Socket.IO
  realtime layer (they share one port/process — see `src/server.js`; no
  separate realtime port to expose).
- **Local disk** — `server/storage/` is used for local backup archives
  (`storage/backups/`, per BET-18) before/regardless of any Google Drive
  upload. If running in an ephemeral container filesystem, this directory
  is lost on every restart — either mount a persistent volume for it or
  treat Google Drive as the only durable backup copy (see
  `docs/backup/DISASTER_RECOVERY.md`'s "Where backups actually live").
- **No task scheduler exists in this codebase.** Automated backups,
  retention purges, and any other periodic job need to be triggered from
  outside the application (a cron job calling the relevant authenticated
  endpoint, an orchestrator's scheduled-job feature, etc.) — this is a
  standing gap flagged consistently since BET-17/BET-18, not new to this
  checkpoint, restated here because it's directly relevant to
  infrastructure planning.
- **Process supervision** — this application does not daemonize or manage
  its own restarts; see `docs/reliability/RECOVERY_PROCEDURES.md` §3 for
  what's expected of whatever wraps it (Docker restart policy, PM2,
  systemd, or an orchestrator's own pod-restart behavior).
- **TLS termination** — this application does not terminate TLS itself;
  `SERVER_URL`/`CLIENT_WEB_URL` being HTTPS (enforced in production, §1)
  describes the externally-visible URL, not a certificate this process
  manages. `app.js` sets `trust proxy: 1`, so it expects to sit behind a
  reverse proxy/load balancer that terminates TLS and forwards
  `X-Forwarded-*` headers correctly (required for `express-rate-limit`
  and `req.ip` to see the real client IP rather than the proxy's).

## Verification performed this checkpoint

- Cross-checked every claim above against the actual source
  (`config/env.js`, `config/database.js`, `config/logger.js`,
  `middlewares/error.middleware.js`, `src/server.js`, `package.json`
  scripts) rather than describing intended behavior from memory.
- `node --check` full-tree sweep — zero syntax errors (no source was
  changed this checkpoint beyond this documentation).
- Confirmed `npm run indexes`/`npm run seed` script names against
  `package.json`'s actual `scripts` block before referencing them.
- Could not perform a live deploy dry-run in this sandbox (standing
  network-egress limitation) — this document was verified by source
  review, not by actually executing the checklist in §2 end-to-end. A
  session with a real deployment target should walk §2 once, start to
  finish, before this is treated as field-verified rather than
  document-reviewed.
