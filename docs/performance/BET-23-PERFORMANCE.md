# BET-23 — Backend Production Readiness: Performance

This document records the Performance section of BET-23 (query optimization,
database indexes, API performance, pagination, caching, and load
considerations). Written incrementally as each checkpoint's work is done —
see the dated entries below.

## Checkpoint 23.1 — Query optimization, database indexes, API performance
_2026-08-15_

### Audit approach
Per this project's standing "verify, don't trust a filename or prior note"
discipline (see `PROJECT_PROGRESS.md`), every high-traffic list/read path
was opened and read before deciding whether it needed a change, rather than
assuming index/pagination coverage from a module's completeness elsewhere.

### Database indexes
- **Finding**: Mongoose's default `autoIndex: true` was left unset (i.e.
  active) for every environment, including production. This means every
  process boot in production would attempt to build every schema-declared
  index against the live cluster — a real production-readiness risk: index
  builds can compete with live traffic for collection locks, and there was
  no controlled, reviewable step where index changes actually happened.
  **Fixed**: `config/database.js` now sets `autoIndex: env.app.nodeEnv !== 'production'`.
  Non-production environments keep the convenient auto-build behavior;
  production requires indexes to be built through an explicit, auditable
  step.
- **Finding**: `src/database/indexes.js` (the explicit index-build script,
  `npm run indexes`) only called `.createIndexes()` on two models (`User`,
  `Role`) — a leftover from early in the project. With `autoIndex` now
  disabled in production, this script becomes the *only* thing that builds
  indexes there, so covering just two of the project's models would have
  been a regression, not an improvement. **Fixed**: rewritten to
  recursively discover every `*.model.js` file under `src/`, dynamically
  import each one (registering its schema with Mongoose regardless of
  which module owns it), then call `.createIndexes()` on every registered
  model — currently all of them. Every model's outcome (success/failure,
  duration) is reported independently; one model failing (e.g. a unique
  index colliding with pre-existing duplicate data) does not stop the run
  or hide other models' results, and the script exits non-zero if anything
  failed, so it fails loud in a CI/deploy pipeline rather than silently.
- **Finding, no fix needed**: spot-checked index coverage on the
  highest-traffic clinical/administrative models (`PatientProfile`,
  `Appointment`, `Encounter`, `Prescription`, `MedicalReport`, `AuditLog`,
  `Notification`, `Message`) against the actual query shapes their list/
  search service functions build. Every one already has compound indexes
  matching its real query patterns (e.g. `{ doctor: 1, appointmentDate: 1,
  status: 1 }` on `Appointment`, matching `listAppointments`'s filter
  shape). No missing index was found on any of these — this was true
  before this session and remains true; recorded here so a future session
  doesn't re-do this audit from scratch.

### Query optimization (`.lean()`)
Audited service functions backing the highest-traffic list/read endpoints
for whether they hydrate full Mongoose documents when the caller only
displays the data (no `.save()`/instance method called on the result
downstream). Two real gaps were found and fixed:
- `modules/appointments/services/appointment.service.js#listAppointments`
  (the admin appointment list) — added `.lean()`.
- `modules/appointments/services/appointment.service.js#getMyAppointments`
  (a patient's own appointment history) — added `.lean()` **and** fixed a
  real unbounded-query bug, see below.
- `modules/encounters/services/encounter.service.js` —
  `listEncountersByPatientProfileId` and `getMyEncounters` — added
  `.lean()`.
- `modules/prescriptions/services/prescription.service.js` —
  `listPrescriptionsByPatientProfileId` and `getMyPrescriptions` — added
  `.lean()`.

`patient.service.js` and `user.service.js`'s list functions were already
using `.lean()` — confirmed, not re-done.

### Pagination
- **Real bug found and fixed**: `getMyAppointments` (`GET
  /appointments/me`) returned a patient's *entire* appointment history,
  unbounded, on every call — no `page`/`limit`, no cap. Over a multi-year
  patient relationship this list only grows; the query and the JSON
  payload both degrade linearly with account age, for a single-user
  self-service endpoint that is likely to be called on nearly every
  session. Fixed to accept `page`/`limit` the same way the admin
  `listAppointments` already does, with a hard `limit` ceiling of 100
  regardless of what a caller requests (protects against a client that
  never sends `limit` at all). The controller
  (`getMyAppointmentsController`) now returns the standard paginated
  envelope (`sendPaginated`) instead of a bare array — this is a response
  **shape change** for `GET /appointments/me`; any existing frontend
  consumer must be updated to read `data`/`meta.pagination` instead of
  treating the response body's `data` as the full array. No frontend
  currently exists that had been built against this endpoint's old shape
  (per `SESSION_HANDOFF.md`'s frontend note, only auth + a doctor
  dashboard exist so far), so this is judged safe to change now rather
  than needing a versioned/additive migration.
- **Audited, deliberately left unpaginated**: seven list endpoints were
  found without `sendPaginated` (`modules/encounters`,
  `modules/prescriptions`, `modules/cms`, `modules/billing/fee`,
  `modules/roles`, `modules/appointments/schedule` (blocked dates),
  `modules/obstetrics`). Each was individually checked against its real
  query, not assumed safe by category:
  - `listEncountersByPatientProfileId` / `listPrescriptionsByPatientProfileId`
    / pregnancy records-by-patient — these are per-patient clinical
    timelines. Deliberately **not** paginated: a clinician reviewing a
    patient's history needs continuity of care from the complete record,
    not a page-1-of-N view that could silently omit an older but
    clinically relevant encounter or prescription. This is a clinical-
    safety judgment, not an oversight — `.lean()` was still added (see
    above) since the *hydration* cost is avoidable even though the
    *pagination* is intentionally not applied.
  - CMS services list (`listActiveServices`/`listAllServices`), fee
    catalog (`listFees`), roles list (`listRoles`), blocked dates
    (`listBlockedDates`) — all are small, admin/staff-managed reference
    catalogs (a handful to a few dozen rows in realistic operation, not
    open-ended user-generated data), so pagination would add complexity
    without a real performance benefit. Left as-is.

### API performance
- `compression()` is already applied globally in `app.js` — confirmed,
  unchanged.
- Structured, low-overhead request logging (`pino`/`pino-http`) is already
  in place — confirmed, unchanged.
- No N+1 query patterns were found in the audited list endpoints — every
  list function uses `.populate()` (a single additional query per
  populated path, not one query per document) rather than looping and
  querying per-item.

### Verification performed this checkpoint
- `node --check` across every `.js` file under `server/src` — zero syntax
  errors, including all files touched this checkpoint.
- Read every call site of `getMyAppointments` (controller +
  `appointment.routes.js`) to confirm the response-shape change is fully
  threaded through and not left half-migrated.
- Could not run a live server or `npx jest` this checkpoint (see
  `SESSION_HANDOFF.md`'s standing network-egress note) — verified
  statically only, consistent with the verification basis most sessions in
  this project have had to use.

### Not done in this checkpoint
Per the client's checkpoint-boundary rule, pagination/caching/load-
considerations (the remaining Performance bullets) are checkpoint 23.2,
not addressed here.

## Checkpoint 23.2 — Pagination, caching, load considerations
_2026-08-15_

### Pagination
Covered as part of checkpoint 23.1's audit (the `getMyAppointments` fix and
the seven-endpoint review) — see above. No further pagination gaps found
this checkpoint; every admin/staff-facing list endpoint that queries an
open-ended, user-generated collection already paginates via
`sendPaginated`.

### Caching
- **New**: `utils/cache.util.js` — a generic Redis-backed read-through
  cache (`getOrSetCache`) plus prefix-based invalidation
  (`invalidateCachePrefix`). Deliberately built as a **safe no-op** when
  Redis is disabled (`REDIS_ENABLED=false`, the current default per
  `SESSION_HANDOFF.md`'s Current Architecture section) or unreachable —
  every read/write is wrapped so a Redis failure degrades to "always hit
  the database" rather than throwing or blocking the request, the same
  fail-safe convention this project's audit/security-event logging
  already established.
- **Where it was applied — and where it deliberately was not**: the only
  endpoints wired to this cache are the two **public, unauthenticated**
  CMS page reads (`GET /cms/pages/public`, `GET /cms/pages/public/:slug`,
  `modules/cms/services/page.service.js#listPublishedPages` /
  `getPublishedPageBySlug`) — public marketing content, already readable
  by anyone without a permission check, read-heavy relative to how often
  an admin edits a page, and safe to serve a few minutes stale. Every
  other list/read endpoint in this project is either permission-gated
  (clinical/financial/administrative data, where a cached response could
  serve stale authorization-relevant data or leak across a permission
  boundary) or already cheap (in-memory RBAC catalog lookups with no
  database round-trip at all) — neither is an appropriate caching target,
  and this was a deliberate scope decision, not an oversight. 5-minute TTL
  (`PUBLIC_PAGE_CACHE_TTL_SECONDS`), plus explicit invalidation on every
  page mutation (`createPage`/`updatePage`/`deletePage`/`publishPage`/
  `unpublishPage`/`archivePage`) so a content edit is visible immediately
  rather than waiting out the TTL.
- `.lean()` was also added to the two now-cached queries while touching
  this code — the cached value is serialized to JSON either way, so
  hydrating a full Mongoose document first was pure waste.

### Load considerations
- **Connection pool**: `config/database.js`'s Mongoose pool
  (`maxPoolSize: 20`, `minPoolSize: 5`) was reviewed against this
  project's request pattern (a single Node process, no cluster/worker
  fan-out configured yet) — reasonable as a starting point for one
  process; if horizontal scaling (multiple Node instances behind a load
  balancer) is introduced later, `maxPoolSize` should be reconsidered
  relative to MongoDB Atlas's own per-cluster connection ceiling
  (`total connections ≈ maxPoolSize × process count`), not left
  unchanged — flagged here for whoever provisions that.
- **Rate limiting**: `middlewares/rate-limit.middleware.js` (reviewed,
  unchanged — already covered by BET-21's security review) is the
  project's actual defense against a single client overwhelming the API;
  this checkpoint did not change its limits.
- **Horizontal scale-readiness**: Socket.IO (`socket/index.js`) currently
  runs in-process with no Redis adapter configured — fine for a single
  Node process, but a real constraint if this is ever deployed as more
  than one instance (a client connected to instance A wouldn't receive a
  broadcast triggered on instance B). Documented here as a known
  limitation of running more than one instance; not something this
  session's scope required fixing (Redis is currently disabled by
  default in this project's own `.env.example`, so multi-instance
  Socket.IO isn't reachable configuration yet) — flag for whoever
  actually stands up more than one API process.
- **Stateless API design**: confirmed the REST layer itself holds no
  in-process session/request state beyond the process-local cache added
  this checkpoint (which is itself Redis-backed and safely reconstructible
  from the database on a cache miss) — the API can already run as
  multiple stateless instances behind a load balancer today, modulo the
  Socket.IO caveat above.

### Verification performed this checkpoint
- `node --check` across every `.js` file under `server/src` — zero syntax
  errors.
- Read every call site of the six `page.service.js` mutation functions to
  confirm `invalidateCachePrefix` was added to each one, not just a
  subset — a missed mutation path would have meant stale public content
  for up to the 5-minute TTL after an edit.
- Confirmed `getRedisClient`/`logger` export names against
  `config/redis.js`/`config/logger.js`'s real exports before importing
  them in the new cache utility.
- Could not run a live server or exercise this against a real Redis
  instance this checkpoint (same standing network-egress caveat as most
  sessions in this project) — the no-op path (Redis disabled, the current
  `.env.example` default) is what every other endpoint in this project
  already exercises implicitly, so this is the lower-risk code path to
  ship unverified live; the Redis-enabled path should get a real
  integration pass once a session has Redis reachability.

