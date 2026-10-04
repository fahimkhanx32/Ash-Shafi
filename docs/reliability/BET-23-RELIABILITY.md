# BET-23 — Backend Production Readiness: Reliability

Written incrementally as each checkpoint's work is done — see the dated
entries below.

## Checkpoint 23.3 — Logging, monitoring, health checks
_2026-08-15_

### Logging
Audited `config/logger.js` (pino, structured JSON, secret-redacting —
built in BET-02) against this checkpoint's requirements. Found solid, one
real gap fixed:
- **Finding**: `middlewares/error.middleware.js` — the single place every
  unhandled error in the entire API passes through — never wrote to the
  structured logger at all. A 5xx was only visible via the generic
  per-request completion line already emitted by `pino-http` and
  `middlewares/audit.middleware.js` (status code + duration, no stack
  trace, no error code, no actor). That's enough to notice *that*
  something failed; not enough to diagnose *what* failed from logs alone,
  which defeats the point of centralized structured logging for
  production incident response. **Fixed**: `errorMiddleware` now logs
  every 5xx at `error` level with full context (error name/stack, `code`,
  `requestId`, method, path, actor id) and every 4xx at `warn` level with
  less detail (4xx is expected, high-volume, not an incident — logging it
  at the same severity as a real server error would drown out actual
  incidents in the same stream).
- **Finding, fixed as a smaller correction**: neither `errorMiddleware`
  nor `notFoundMiddleware` included `requestId` in the JSON error response
  body, even though every *success* response (`sendSuccess`/
  `sendPaginated`) already does. This broke request tracing specifically
  for the error path — the one case where correlating a client-reported
  problem back to a specific structured log line matters most. Both now
  include `requestId`.
- `middlewares/audit.middleware.js`'s existing per-request `console.info`
  JSON line and `pino-http`'s own request logging were reviewed and left
  as-is — they serve their existing purpose (one line per request,
  request-scoped) and are not what this checkpoint's gap was about.

### Monitoring
- **Finding**: no monitoring surface existed anywhere in the project
  beyond logs themselves — no request-volume/error-rate/latency signal an
  operator could check without grepping raw log output. Standing up a
  real metrics backend (Prometheus + `prom-client`, or an APM vendor
  agent) is an infrastructure decision outside a single backend session's
  scope (no such dependency exists in `package.json`, and adding one
  un-requested would be exactly the kind of unrelated-feature scope creep
  the master prompt's §98 warns against). **Built instead**: a
  lightweight, dependency-free, in-process metrics counter
  (`monitoring/metrics.service.js`) fed by a new
  `middlewares/metrics.middleware.js`, exposed at `GET /health/metrics` —
  admin-only (`system:admin`, the same permission `modules/backups`/
  `modules/data-lifecycle` already gate on), never exposed publicly. It
  reports total requests, status-class breakdown (2xx/3xx/4xx/5xx), 5xx
  error rate, p50/p95/p99 latency over a bounded recent-sample window, the
  20 busiest routes by request count (keyed on the matched Express route
  *pattern* — e.g. `/:id` — never the raw URL, so per-resource-ID
  cardinality can't grow the tracked route set unbounded), and process
  memory (RSS/heap).
- **Explicitly documented limitation**: these counters are in-process and
  in-memory only — not persisted, not shared across processes. If this API
  is ever run as more than one Node instance, each process's
  `/health/metrics` reports only its own share of traffic, not an
  aggregate. This is an accepted trade-off for a same-session,
  dependency-free solution, not an oversight — a real multi-instance
  deployment should replace this with a proper metrics backend rather than
  trying to hand-aggregate these per-process counters.

### Health checks
- `GET /health` (liveness) and `GET /health/ready` (readiness — verifies
  MongoDB and, if enabled, Redis are actually reachable) already existed
  from BET-02 and were reviewed — both are correctly implemented
  (readiness returns `503` when a dependency is down, exactly the signal
  an orchestrator needs to stop routing traffic to an unhealthy instance).
  No changes made to either.
- Added `GET /health/metrics` (see Monitoring above) as the third route in
  this router.

### Verification performed this checkpoint
- `node --check` across every `.js` file under `server/src` — zero syntax
  errors.
- Confirmed `authenticate`/`authorize` export signatures against
  `middlewares/auth.middleware.js`'s real exports, and `PERMISSIONS`
  against `security/permissions.js`'s real export, before wiring the new
  route — the same "verify the import target before trusting it" habit
  this project's prior sessions established after past sessions caught
  real import-mismatch bugs this way.
- Confirmed `/health/metrics`'s auth middleware is reachable given
  `app.js`'s existing middleware order — `cookieParser()` and the general
  rate limiter are both mounted before `healthRoutes`, so `authenticate`
  has what it needs (cookies parsed) by the time a request reaches it.
- Could not exercise this against a live server this checkpoint (standing
  network-egress caveat, see `SESSION_HANDOFF.md`) — verified statically.

### Not done in this checkpoint
Database health, error handling beyond the logging gap above, graceful
shutdown, and recovery procedures are checkpoint 23.4, not addressed here.

## Checkpoint 23.4 — Database health, error handling, graceful shutdown, recovery procedures
_2026-08-15_

### Database health
- **Finding**: `GET /health/ready` (BET-02) determined database health purely
  from Mongoose's cached `connection.readyState` — `connected` was trusted
  at face value. `readyState` reflects Mongoose's own bookkeeping, which can
  briefly lag reality (a half-dead TCP connection that hasn't yet fired
  Mongoose's `disconnected` event still reads as `connected`), and it says
  nothing about whether the database server is actually responding to
  commands right now, only that a socket was open at some point.
- **Fixed**: added `pingDatabase()` to `config/database.js` — issues a real
  `admin().ping()` against the live connection, race d against a bounded
  timeout (`DB_HEALTH_PING_TIMEOUT_MS`, default 3s, new env var) so a
  database that hangs instead of erroring can't make the readiness probe
  itself hang. `GET /health/ready` now calls this (only when `readyState`
  is already `connected` — no point pinging a socket that isn't even open)
  and reports `{ healthy, latencyMs, error }` under `checks.database.ping`
  in the response body, alongside the existing `state`/`readyState`/`host`/
  `database` fields (kept, not replaced — still useful for a human glancing
  at the response).

### Error handling
- **Fixed, real bug**: `middlewares/error.middleware.js`'s status-code
  fallback only ever checked `err.statusCode`. Several error sources this
  app already depends on — notably `express.json()`/`express.urlencoded()`
  (body-parser/http-errors under the hood) for malformed JSON or an
  oversized payload — set `err.status`, not `err.statusCode`. Those errors
  were silently falling through to a generic `500 INTERNAL_ERROR` instead
  of the `400`/`413` the library itself intended. Fixed the fallback to
  check both (`err.statusCode ?? err.status ?? 500`).
- **Added dedicated branches** (previously all fell through to generic
  `INTERNAL_ERROR`/500, now report a stable client-facing `code` and the
  correct status):
  - `entity.parse.failed` (malformed JSON body) → `400 INVALID_JSON`
  - `entity.too.large` (oversized body) → `413 PAYLOAD_TOO_LARGE`
  - `MulterError` → `400 FILE_TOO_LARGE`/`FILE_UPLOAD_ERROR` — a safety net
    specifically for the upload routes that reuse the shared
    `middlewares/upload.middleware.js` but don't already catch `MulterError`
    locally (`modules/cms`, `modules/imports` — confirmed by grep;
    `modules/reports` and `modules/messaging`'s dedicated upload middleware
    already had their own local handling and are unaffected/unchanged)
  - `MongoNetworkError`/`MongooseServerSelectionError`/
    `MongoServerSelectionError` → `503 DATABASE_UNAVAILABLE` — distinguishes
    "a dependency is down" from "our code has a bug" (previously both
    reported identically as `500 INTERNAL_ERROR`), and gives callers a
    status code that's actually safe to retry against.
- Every new branch was added following the same one-`if`-per-case pattern
  the file already used for `ValidationError`/`CastError`/`JsonWebTokenError`/
  duplicate-key errors — no structural change to the middleware, just more
  cases recognized.

### Graceful shutdown
- **Finding**: the original `shutdown()` in `server.js` had three real gaps:
  1. No re-entrancy guard — a second `SIGINT`/`SIGTERM` (or one of each in
     quick succession, which some orchestrators send) re-entered the whole
     function, racing two independent `disconnectRedis`/`disconnectDatabase`/
     `process.exit` sequences against each other.
  2. No timeout — if `server.close()`'s callback never fired (a client
     holding a keep-alive connection open indefinitely is the common real-
     world cause), the process would hang forever: already removed from an
     orchestrator's routing (which triggers on the signal itself, not on
     this callback), but never actually exiting, so nothing ever restarted
     it either.
  3. Socket.IO was never explicitly closed — `initializeSocket` attaches it
     to the same HTTP server, but stopping the HTTP server from accepting
     new *HTTP* connections doesn't stop new *Socket.IO* handshakes from
     completing during the drain window.
- **Fixed**: rewrote `shutdown()` in `server.js` — a module-level
  `shuttingDown` flag makes every signal/error after the first a no-op; an
  `unref()`'d force-exit timer (`SHUTDOWN_TIMEOUT_MS`, default 10s, new env
  var) guarantees the process exits within a bounded window regardless of
  what's still draining; `getIo().close()` is awaited before `server.close()`
  so no new Socket.IO connection can complete after shutdown begins. Order
  preserved from the original: stop accepting new connections → let
  in-flight requests finish → disconnect Redis → disconnect MongoDB → exit.
- Switched `server.js`'s logging from `console.*` to the structured
  `logger` (pino, already used everywhere else in the app since BET-02) for
  consistency — shutdown/startup events are now real structured log lines
  (queryable, correlatable) rather than plain stdout text, matching this
  checkpoint's own logging-gap fix in 23.3.

### Recovery procedures
- **Startup connection retry**: `connectDatabase()` (`config/database.js`)
  previously failed fatally on the very first connection attempt — a
  perfectly healthy deploy could crash-loop on a two-second DNS/network blip
  at exactly the wrong moment. Now retries with exponential backoff
  (`DB_CONNECT_RETRY_ATTEMPTS`, default 5 additional attempts;
  `DB_CONNECT_RETRY_DELAY_MS`, default 2s starting delay, doubling each
  attempt, capped at 30s — both new env vars) before finally giving up and
  letting `server.js` exit non-zero, at which point the process manager's
  own restart policy takes over. Set `DB_CONNECT_RETRY_ATTEMPTS=0` to
  restore fail-immediately behavior (e.g. for CI).
- **Runtime reconnection**: the MongoDB driver underneath Mongoose already
  reconnects automatically on a dropped connection — nothing new needed
  there — but this was previously invisible in the logs. Added
  `reconnected`/`reconnectFailed` event listeners to `config/database.js`
  so recovery (or a driver giving up) is observable rather than silent.
- **New runbook**: `docs/reliability/RECOVERY_PROCEDURES.md` — covers what
  self-heals with no operator action (dropped connections, startup blips,
  in-flight requests during a graceful shutdown) vs. what deliberately does
  not (an uncaught exception/unhandled rejection now triggers a logged,
  bounded shutdown rather than trying to keep running in a possibly-
  inconsistent state — Node's own guidance, and especially relevant for an
  app handling PHI/PII); process-manager/restart-policy guidance (Docker/
  PM2/systemd — deliberately not implemented in this repo, since the user
  is deploying their own Docker setup); the exact shutdown sequence; and a
  symptom→likely-cause diagnostic table. Explicitly cross-referenced against
  (not duplicating) `docs/backup/DISASTER_RECOVERY.md`/`RESTORE_PROCEDURE.md`
  (BET-18), which cover data-level recovery — this document is process-level
  recovery only.
- **Process-level safety nets**: added `process.on('uncaughtException', ...)`
  and `process.on('unhandledRejection', ...)` to `server.js` — neither
  existed before. Both log at `fatal` level with full error context (name,
  message, stack) and then route through the same graceful-shutdown path
  above (not a bare `process.exit()`), so in-flight requests still get a
  chance to finish — but still bounded by the same force-exit timer, since
  whatever triggered the uncaught error may have left something unable to
  drain cleanly.

### New/changed environment variables
All optional, all with production-safe defaults — no `.env` changes are
required for existing deployments to keep working:
- `SHUTDOWN_TIMEOUT_MS` (default `10000`)
- `DB_CONNECT_RETRY_ATTEMPTS` (default `5`)
- `DB_CONNECT_RETRY_DELAY_MS` (default `2000`)
- `DB_HEALTH_PING_TIMEOUT_MS` (default `3000`)

Added to `config/env.js`'s Joi schema (validated, bounded with sensible
`min`/`max`) and documented in `.env.example`.

### Verification performed this checkpoint
- `node --check` on every new/modified file individually, then a full sweep
  of every `.js` file under `server/src` — zero syntax errors.
- Read `socket/index.js`'s actual `getIo`/`initializeSocket` exports before
  wiring `io.close()` into `server.js`'s shutdown path, rather than assuming
  the shape — confirmed `getIo()` returns the live instance (or `undefined`
  before initialization, handled with a guard).
- Confirmed `config/logger.js` exports `logger` with a `fatal` level
  (pino's default level set) before using it in `server.js`'s new
  process-level handlers.
- Traced every existing caller of `middlewares/upload.middleware.js` (via
  grep) to confirm which routes already have local `MulterError` handling
  (`modules/reports`, `modules/messaging`) vs. which don't
  (`modules/cms`, `modules/imports`) before describing the new error-
  middleware branch as a "safety net" rather than a duplicate.
- Could not exercise any of this against a live server or a live MongoDB
  instance this checkpoint (standing sandbox network-egress limitation —
  see `SESSION_HANDOFF.md`) — verified statically, plus manual trace-through
  of each new code path's logic (e.g. confirming the force-exit timer's
  `unref()` means it can never itself be the reason the process fails to
  exit on its own).

### Not done in this checkpoint
Environment validation, secrets validation, and production security
configuration are checkpoint 23.5, not addressed here.
