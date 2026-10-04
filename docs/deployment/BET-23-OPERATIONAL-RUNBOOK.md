# BET-23 Checkpoint 23.8 — Operational Runbook

_2026-08-15_

A single, concise operator runbook for running this application in
production. This document is a **navigation layer over existing,
already-verified documentation** — it does not repeat detail that
already lives in `docs/reliability/RECOVERY_PROCEDURES.md`,
`docs/backup/{DISASTER_RECOVERY,RESTORE_PROCEDURE}.md`, or
`docs/deployment/BET-23-DEPLOYMENT.md`; it tells the operator which of
those to open for a given situation, plus the handful of steps not
already fully covered elsewhere.

## 1. Pre-deploy checks

- Confirm `server/.env` has every variable `docs/deployment/BET-23-DEPLOYMENT.md`
  §3 marks "Required in production" — `MONGODB_URI`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY`, `FIELD_ENCRYPTION_KEY`,
  `COOKIE_SECURE=true`, HTTPS `SERVER_URL`/`CLIENT_WEB_URL`.
- Confirm `NODE_ENV=production` — this single variable drives every
  production-only behavior (§1 of the deployment doc).
- Confirm the target MongoDB is reachable from wherever this process
  will run, and that Redis (if `REDIS_ENABLED=true`) is reachable too.

## 2. Environment validation

Boot itself is the validation step — `config/env.js`'s Joi schema
validates `process.env` on module load, before any other code runs, and
calls `process.exit(1)` with every problem listed at once
(`abortEarly: false`) if anything required is missing, too short, or
looks like a placeholder. There is no separate "validate config" command
to run first; if the process starts, config passed. See
`docs/security/BET-23-SECURITY-REVIEW.md` for the full list of what's
enforced.

## 3. Dependency installation

```
cd server
npm ci        # NOT npm install — reproducible, lockfile-exact
```

## 4. Index creation

```
npm run indexes
```

Run once per environment, ideally during a maintenance window or before
the first instance takes traffic (`autoIndex` is off in production —
see `docs/database/BET-23-DATABASE.md` §4). Exits non-zero if any
model's index build failed — treat that as a deploy-blocking failure,
not a warning.

## 5. Seed behavior

```
npm run seed
```

Idempotent — safe to re-run; only creates what's missing (Owner/Director/
initial-admin accounts, fixed system roles). Requires `OWNER_*`/
`DIRECTOR_*`/`INITIAL_ADMIN_*` env vars to already be set.

## 6. Startup

```
npm start        # node src/server.js
```

Startup order (verified against `src/server.js`): Socket.IO attaches →
`connectDatabase()` (retries transient failures with backoff, see §10) →
role sync (non-fatal if it fails) → `connectRedis()` → `server.listen()`.
A structured log line reports port, environment, and the health-check
URL once listening — confirm this line appears before considering the
deploy live.

## 7. Liveness / readiness checks

- **Liveness** — `GET /health`. Always `200` if the process is up. Use
  for the orchestrator's restart-on-failure probe.
- **Readiness** — `GET /health/ready`. Real MongoDB `ping()` (bounded by
  `DB_HEALTH_PING_TIMEOUT_MS`, default 3s) + Redis `isReady` if enabled.
  `503` means a dependency is down — use for the orchestrator's traffic-
  routing probe, not liveness.
- Full response shapes: `docs/api/BET-23-API.md` §2.

## 8. Metrics

`GET /health/metrics` — requires `system:admin` (today
`SOFTWARE_OWNER`/`SUPER_ADMIN`). Returns request volume, status-code
breakdown, 5xx error rate, p50/p95/p99 latency, top 20 busiest routes,
process memory. **In-process only** — restarts reset it, and it is not
aggregated across multiple Node instances. If running more than one
instance, `curl` each instance individually (e.g. through its
orchestrator's per-pod/per-container access), or treat this as a
stop-gap until a real metrics backend (Prometheus + `prom-client`, or an
APM agent) is stood up.

## 9. Graceful shutdown

Sends `SIGTERM` (or `SIGINT`) → stop new Socket.IO connections →
`server.close()` (drains in-flight HTTP requests) → disconnect Redis →
disconnect MongoDB → exit 0. Bounded by `SHUTDOWN_TIMEOUT_MS` (default
10s), past which the process force-exits regardless of what's still
in flight. Full detail, including the `uncaughtException`/
`unhandledRejection` safety net: `docs/reliability/RECOVERY_PROCEDURES.md`
§4.

**Operator action**: send `SIGTERM`, not `SIGKILL`, for a planned
restart/redeploy — `SIGKILL` skips this entire sequence and can drop
in-flight requests or leave a connection unclosed.

## 10. MongoDB failure response

- **Mid-run disconnect**: the driver reconnects automatically; watch for
  `'MongoDB connection re-established after a disconnect.'` in logs. No
  operator action needed unless `'MongoDB gave up attempting to
  reconnect...'` appears — that means the driver's own retry budget is
  exhausted and the process needs a manual restart.
- **Startup failure**: `connectDatabase()` retries with backoff
  (`DB_CONNECT_RETRY_ATTEMPTS`, default 5 additional attempts) before
  exiting non-zero. A crash-loop past that point means the database is
  genuinely unreachable — check `MONGODB_URI`, network path, and cluster
  status before re-deploying, not just restarting the process again.
- **Mid-request failure**: surfaces to the client as `503
  DATABASE_UNAVAILABLE` (`docs/api/BET-23-API.md` §5) rather than a
  generic 500 — check `GET /health/ready` immediately to confirm scope
  (one bad query vs. the whole database being down).
- Full detail: `docs/reliability/RECOVERY_PROCEDURES.md` §1–§2.

## 11. Redis failure behavior

Redis is optional (`REDIS_ENABLED=false` by default). If enabled and it
becomes unreachable:
- `GET /health/ready` reports `503` (Redis is included in the readiness
  check when enabled).
- The CMS-page cache (`utils/cache.util.js`) degrades to "always hit the
  database" — silently, by design; a Redis outage does not itself take
  the API down, only removes the cache's benefit.
- Rate limiting falls back to whatever `express-rate-limit`'s own
  behavior is without its Redis store configured — verify this doesn't
  silently disable rate limiting entirely before relying on it in an
  incident where Redis is down for an extended period.

## 12. Backup execution

```
POST /api/v1/backups          (system:admin)
```

Triggers a full JSON logical dump of every registered collection,
AES-256-GCM encrypted, verified automatically after write (SHA-256 +
re-parse + per-collection document-count check against the manifest),
optionally uploaded to Google Drive if configured (best-effort — a
failed upload never invalidates the local copy). Full detail:
`docs/backup/DISASTER_RECOVERY.md`.

## 13. Restore procedure

**Full step-by-step runbook**: `docs/backup/RESTORE_PROCEDURE.md` — read
it in full before acting, not just this summary. In short: confirm a
full restore is actually warranted (§1 of that doc) → pick a `verified:
true` backup → **always** run `POST /backups/:id/restore-test` first →
`POST /backups/:id/restore` (own password + `confirm: true` + written
`reason` ≥10 chars) → spot-check real records afterward, don't trust the
count-based response alone. Known limitation: not wrapped in a single
cross-collection transaction on a non-replica-set deployment — an
interrupted restore is safely resumable by re-running the same call
(idempotent per collection).

## 14. Log / incident investigation

- Every request has a `requestId`, present in both the structured log
  line (`pino-http`) and the JSON response body — use it to correlate a
  client-reported problem to a specific server log line.
- Every 5xx is logged at `error` level with full context (stack, error
  code, method, path, actor id) via `middlewares/error.middleware.js`;
  every 4xx at `warn` level with less detail, so error-level log
  filtering surfaces real incidents without high-volume validation
  noise.
- `AuditLog` (`GET` via whatever admin surface is authorized — `audit:read`)
  is the durable trail for privileged/administrative/clinical-access
  actions, independent of the ephemeral request logs above — check it
  for "who did what" questions, not just "what broke".
- Diagnosing a specific class of incident (crash-loop, memory growth,
  hung requests): `docs/reliability/RECOVERY_PROCEDURES.md` §5.

## 15. Rollback / redeploy guidance

- This application has no built-in rollback mechanism — rolling back a
  bad deploy means redeploying the previous known-good build via
  whatever deployment tooling wraps this process (the operator's own
  Docker/orchestration setup, out of scope here).
- If the bad deploy included an index change, confirm `npm run indexes`
  doesn't need to be re-run against the rolled-back schema shape before
  serving traffic on the reverted build.
- If the bad deploy wrote data in a shape the previous build can't read,
  a code rollback alone will not fix it — that scenario needs a data
  migration or, in the worst case, a restore (§13) to a pre-deploy
  backup. Decide this before rolling back, not after.

## 16. Common failure symptoms and where to inspect

| Symptom | Where to inspect |
|---|---|
| `GET /health` failing / process not responding | Process logs directly (stdout/orchestrator log capture) — this endpoint doesn't touch the database, so a failure here is the process itself, not a dependency |
| `GET /health/ready` returning 503 | The response body's `checks.database`/`checks.redis` — tells you which dependency and, for the database, the actual ping error message and latency |
| Spike in 5xx responses | `GET /health/metrics` (`http.requestsByStatusClass`, `topRoutes`) for scope, then `error`-level log lines for the specific `requestId`s/stack traces |
| Slow responses / high p95-p99 | `GET /health/metrics` (`http.latencyMs`), then `docs/performance/BET-23-PERFORMANCE.md` for known unbounded-query/pagination gaps already reviewed |
| A specific client says a request failed | Ask for the `requestId` from their response body; grep logs for it directly |
| Backup failures | `Backup` document's own `status`/`error` fields (`GET /api/v1/backups/:id`); `AuditLog` `BACKUP_FAILED` entries |
| Data appears lost/corrupted | Do **not** jump straight to restore — check `AuditLog`/module-specific access logs first (§1 of `docs/backup/RESTORE_PROCEDURE.md`) |

## 17. Secret / config rotation precautions

- Rotating `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` invalidates every
  currently-issued token immediately on the next verification — plan for
  a forced re-login of every active session, not a silent rotation.
- Rotating `DATA_ENCRYPTION_KEY`/`FIELD_ENCRYPTION_KEY` does **not**
  retroactively re-encrypt already-stored data — data encrypted under
  the old key becomes unreadable unless a migration re-encrypts it
  first. Do not rotate either of these without a planned migration step.
- The two JWT secrets, and the two encryption keys, must each be
  distinct from one another and from any development value — enforced
  at boot in production (§2 above), but should be correct before that
  guard is even relied on.
- Never place a live secret value in this repository, in a ticket, or in
  documentation — generate fresh values per environment
  (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
  for the JWT secrets, per `.env.example`'s own guidance).

## Verification performed this checkpoint

- Every step above cross-checked against `src/server.js`,
  `src/config/{env,database,redis}.js`, `src/health/health.routes.js`,
  `src/middlewares/error.middleware.js`, `server/package.json` scripts,
  and the existing `docs/reliability/RECOVERY_PROCEDURES.md`/
  `docs/backup/{DISASTER_RECOVERY,RESTORE_PROCEDURE}.md` — not written
  from general operational knowledge disconnected from this codebase.
- Deliberately reuses, rather than duplicates, the step-by-step detail
  already correct in `RECOVERY_PROCEDURES.md` and
  `RESTORE_PROCEDURE.md` — this document is the index/summary layer per
  the continuation handoff's explicit instruction not to re-author
  those.
