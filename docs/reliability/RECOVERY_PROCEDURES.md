# Recovery Procedures

This document covers **process-level and dependency-level recovery** — what
happens when the Node process itself crashes, restarts, or loses a
dependency, and what an operator should do about it. It deliberately does
**not** duplicate `docs/backup/DISASTER_RECOVERY.md` /
`docs/backup/RESTORE_PROCEDURE.md` (BET-18), which cover **data-level**
recovery (restoring a MongoDB backup after data loss/corruption) — read
those for anything involving actually-lost data. This document is about
keeping the running process itself healthy and self-recovering, and what
to do when it isn't.

## 1. What recovers automatically, with no operator action

- **A dropped MongoDB connection mid-run.** The MongoDB Node driver
  (underneath Mongoose) reconnects on its own once the network path is
  restored — nothing in this codebase needs to detect this and reconnect
  manually. `config/database.js` logs `'MongoDB connection re-established
  after a disconnect.'` (the driver's `reconnected` event) when this
  happens, and `'MongoDB gave up attempting to reconnect (driver-level
  retries exhausted).'` (`reconnectFailed`) in the rare case the driver's
  own retry budget is exhausted — that second case is not self-healing and
  needs the process restarted (see §3).
- **A transient failure at process startup** (DNS not yet warm, a brief
  network blip, a cluster maintenance window at the exact moment the
  container starts). `connectDatabase()` retries the initial connection
  with exponential backoff — `DB_CONNECT_RETRY_ATTEMPTS` additional
  attempts (default 5) beyond the first, `DB_CONNECT_RETRY_DELAY_MS`
  starting delay (default 2s, doubling each attempt, capped at 30s) — before
  giving up. A boot that would previously have crash-looped on a two-second
  blip now recovers on its own within the retry window.
- **In-flight requests during a graceful shutdown.** `SIGTERM`/`SIGINT`
  triggers `server.js`'s `shutdown()`, which stops accepting new
  connections but lets requests already being handled finish naturally
  before closing Redis/MongoDB and exiting — a rolling deploy or
  orchestrator-initiated restart does not need to drop in-flight requests.

## 2. What does *not* recover automatically, by design

- **An uncaught synchronous exception or unhandled promise rejection
  anywhere in the process.** `server.js` logs it at `fatal` level with full
  context and then deliberately shuts the process down (via the same
  graceful-shutdown path, still time-bounded — see §4) rather than trying
  to keep running. This is intentional, not a gap: Node's own guidance is
  that arbitrary in-process state may be inconsistent after an uncaught
  exception, and this application handles PHI/PII — continuing to serve
  requests from a process in an unknown state is a worse outcome than a
  clean, fast restart. **A process manager must be configured to restart
  the process immediately after it exits** (see §3) or this "recovery"
  is just an outage.
- **`reconnectFailed`** (§1) — the MongoDB driver's own retry budget is
  exhausted, not something `config/database.js` can retry further from
  inside the same process. Restart the process (§3); if the underlying
  cluster itself is down, restarting will just repeat the startup-retry
  behavior in §1 until the cluster is actually reachable again.
- **Data loss or corruption.** Nothing in this document restores lost
  data — see `docs/backup/DISASTER_RECOVERY.md` instead.

## 3. Process manager / restart policy (operational — not code in this repo)

This codebase deliberately contains no process manager, supervisor, or
container orchestration config of its own (per this session's scope — the
user is deploying via their own Docker setup). What it guarantees on its
side: the process exits cleanly and promptly (§4) on a fatal error or a
termination signal, with a **non-zero** exit code on failure and a **zero**
exit code on a clean shutdown, so any standard process manager can tell the
two apart and act accordingly. Whoever operates this deployment should
configure one of:

- **Docker / `docker run --restart unless-stopped`** (or `always`) — the
  simplest option; restarts the container whenever the process inside it
  exits, honoring the exit code above to avoid restart-looping a
  deliberately-stopped container.
- **Docker Compose** — `restart: unless-stopped` on the service definition.
- **A container orchestrator (Kubernetes, ECS, etc.)** — rely on
  `GET /health` (liveness) and `GET /health/ready` (readiness, BET-23) as
  the probe endpoints; both already exist and behave correctly (§5).
- **PM2 / systemd**, if not running under a container — PM2's default
  restart-on-crash behavior, or a systemd unit with `Restart=on-failure`,
  serve the same purpose.

Whichever is chosen, **verify it actually restarts the process after a
deliberate crash** (e.g. `kill -9` the process, or trigger `SIGTERM` twice
in immediate succession) before relying on it in production — this is an
infrastructure choice made outside this codebase and cannot be verified by
`node --check` or a static read of the source the way the rest of this
checkpoint's work was.

## 4. Graceful shutdown — what actually happens, in order

`server.js`'s `shutdown()` (triggered by `SIGTERM`, `SIGINT`,
`uncaughtException`, or `unhandledRejection`):

1. A repeat signal/error while already shutting down is a no-op (a
   module-level flag prevents two shutdown sequences racing each other —
   this used to be a real gap: an impatient double `Ctrl-C` previously
   re-entered the whole sequence a second time).
2. A force-exit timer starts (`SHUTDOWN_TIMEOUT_MS`, default 10s,
   `unref()`'d so it never itself keeps the process alive). If everything
   below hasn't finished by the time this fires, the process exits `1`
   immediately regardless of what's still in progress.
3. Socket.IO stops accepting new connections (`io.close()`).
4. The HTTP server stops accepting new connections and waits for requests
   already in flight to finish (`server.close()`).
5. Redis disconnects (`disconnectRedis()`), then MongoDB
   (`disconnectDatabase()`).
6. The force-exit timer is cleared and the process exits `0`.

If any step in 3–5 throws, the error is logged and the process exits `1` —
the force-exit timer (step 2) is the backstop for the case where a step
hangs instead of throwing (e.g. a client holding a keep-alive connection
open indefinitely, which would otherwise mean `server.close()`'s callback
never fires).

## 5. Diagnosing a specific incident

| Symptom | Where to look | Likely cause |
|---|---|---|
| `GET /health` fails or times out | The process itself is down or the event loop is blocked | Process crash (check logs for the `fatal`-level line written just before it, per §2) — restart policy (§3) should already be handling this |
| `GET /health` is `200` but `GET /health/ready` returns `503` | `checks.database.ping` / `checks.redis` in the response body | The database or Redis dependency is unreachable *from this process*, not a bug in this process — see §1 (should self-heal) or escalate to the dependency's own on-call/provider if it doesn't |
| Repeated `'MongoDB connection attempt failed; retrying.'` log lines at startup, eventually `'MongoDB connection failed; no attempts remaining.'` | Startup logs | `MONGODB_URI` misconfigured, or the cluster is down for longer than the full retry window (`DB_CONNECT_RETRY_ATTEMPTS` × backoff) — this is a startup failure, not a runtime one; the process exits `1` and the restart policy (§3) will keep retrying the whole boot sequence, which is safe but will not succeed until the underlying cause is fixed |
| A single request returns `503 DATABASE_UNAVAILABLE` | That request's structured error log (`middlewares/error.middleware.js`, BET-23) | A `MongoNetworkError`/`MongooseServerSelectionError` surfaced mid-request — same underlying cause as the row above, scoped to one request instead of the whole boot; should recover on its own per §1 |
| Process restarts repeatedly (crash loop) | `fatal`-level log lines immediately preceding each exit | An `uncaughtException`/`unhandledRejection` recurring on every boot (e.g. a bug triggered by every request of a certain shape, not a transient dependency issue) — this needs a code fix, not another restart; restarting alone will not resolve it |
| `GET /health/metrics` (admin-only, BET-23) shows an elevated 5xx rate without a process restart | `errorMiddleware`'s `error`-level log lines for the affected window | An application-level bug that isn't fatal enough to crash the process — investigate via the structured error logs, which include `requestId`/`code`/stack for every 5xx |

## 6. What this checkpoint deliberately did not add

- **No task scheduler** exists in this codebase (the same gap
  `modules/backups`/`modules/data-lifecycle` already flagged) — there is no
  automatic periodic health self-check, no automatic backup trigger, no
  automatic retention purge. All of those remain explicit/manual
  operations today.
- **No circuit breaker / bulkhead pattern** around the MongoDB or Redis
  clients — the driver's own connection pooling and retry behavior (§1) is
  relied on directly rather than adding a second layer of retry/backoff
  logic on top of it, which would risk fighting the driver's own recovery
  behavior rather than complementing it.
- **No multi-instance/multi-region failover** — see
  `docs/backup/DISASTER_RECOVERY.md`'s "What disaster recovery means for
  this project today" section; this remains a single-process,
  single-database deployment, and this document's recovery procedures are
  scoped accordingly.
