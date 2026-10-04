# BET-23 Checkpoint 23.5 — Environment Validation, Secrets Validation, Production Security Configuration, Security Review Completion

_2026-08-15_

This is a **production-readiness** security pass, scoped narrower than
`docs/security/BET-21-SECURITY-REVIEW.md` (BET-21's full attack-surface
review — authentication, authorization/RBAC, tokens/sessions, rate
limiting, request validation/sanitization, headers/CORS, file security,
sensitive-data protection, API abuse protection, secrets *management*,
webhook security, error-message security, logging, dependency security,
and production configuration security, all already reviewed there and
found correctly implemented). This checkpoint specifically covers what
BET-21 did **not**: whether the secrets themselves, once present, are
actually *strong*, and a final confirmation pass on production boot
behavior.

## Environment validation

Reviewed `config/env.js` end-to-end (all ~1,470 lines, every `Joi` field)
rather than assuming BET-02's original implementation still matched the
roadmap:

- Every environment variable this project reads goes through a single
  `Joi.object()` schema with `.validate(process.env, { abortEarly: false,
  convert: true })` — malformed config fails at boot with every problem
  listed at once (`abortEarly: false`), not one-at-a-time across repeated
  restart attempts.
- A missing or malformed *required* variable (`MONGODB_URI`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) fails validation and calls
  `process.exit(1)` before the app ever reaches `server.js` — confirmed
  this is unconditional (not gated behind `isProduction`), so a broken
  `.env` fails the same way in every environment, not just production.
- Every other variable has an explicit, reasonable default (confirmed by
  reading each `.default(...)` against what the consuming module actually
  expects — e.g. `JWT_ACCESS_EXPIRES_IN` defaulting to `15m`, a sensible
  short-lived access token, not something accidentally long-lived).
- No code anywhere in `server/src` reads `process.env` directly outside
  `config/env.js` itself (confirmed by grep) — every module imports the
  validated `env` object, so there's no way for an unvalidated raw
  environment value to reach application logic.
- This checkpoint's own additions (`SHUTDOWN_TIMEOUT_MS`,
  `DB_CONNECT_RETRY_ATTEMPTS`, `DB_CONNECT_RETRY_DELAY_MS`,
  `DB_HEALTH_PING_TIMEOUT_MS` from 23.4) all have bounded `min`/`max`
  ranges, not unbounded numbers — a typo'd extra zero can't produce a
  nonsensical multi-hour shutdown timeout or a thousand-attempt retry loop.

No defects found; no changes made to the general validation mechanism.

## Secrets validation — real gap found and closed

**Finding**: the existing "PRODUCTION SECURITY CHECKS" block (added in an
earlier session, reviewed and confirmed correct by BET-21) verified that
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`,
`DATA_ENCRYPTION_KEY`, and `FIELD_ENCRYPTION_KEY` are *present and
non-empty* in production. It did not verify they are actually strong:

1. `DATA_ENCRYPTION_KEY`/`FIELD_ENCRYPTION_KEY` have no schema-level
   minimum length (unlike the JWT secrets, which already had `.min(32)`) —
   they're optional/empty outside production, so a hard `Joi.min()` would
   have broken non-production `.env` files that never set them.
   `security/encryption.js`'s `deriveKey()` runs whatever string it's
   given through SHA-256 unconditionally — a one-character
   `DATA_ENCRYPTION_KEY` would have passed the old presence check and
   silently produced a real, working (but trivially guessable) AES-256-GCM
   key.
2. Nothing checked whether a secret was an actual generated secret versus
   a forgotten placeholder like `changeme` or `your-secret-here` — a
   deploy that copy-pasted `.env.example` without filling in real values
   would have passed every existing check.
3. Nothing checked that `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`, or
   that `DATA_ENCRYPTION_KEY` ≠ `FIELD_ENCRYPTION_KEY`. Reusing one value
   for two secrets that are supposed to be independent means a compromise
   of one compromises both.

**Fixed** — added three new checks to `config/env.js`'s existing
production-guard block, same fail-closed `process.exit(1)` pattern already
established there (not a new mechanism):
- **Length floor**: all four secrets re-checked for `>= 32` characters at
  this point in the file (redundant with the JWT schema's `.min(32)` by
  design — keeps this block correct on its own even if the schema changes
  later, and is the only enforcement point at all for the two encryption
  keys).
- **Placeholder detection**: rejects any of the four secrets if it
  case-insensitively contains a common placeholder substring (`changeme`,
  `secret`, `password`, `example`, `test`, `default`, etc. — see the
  `WEAK_SECRET_PATTERNS` list in `config/env.js` for the full set).
- **Uniqueness**: rejects if `JWT_ACCESS_SECRET === JWT_REFRESH_SECRET` or
  `DATA_ENCRYPTION_KEY === FIELD_ENCRYPTION_KEY`.

All three are production-only (same `if (isProduction)` block as the
existing checks) — no impact on development/test `.env` files, which
routinely use short/simple values for convenience.

`.env.example` updated with a one-line comment above each of these four
variables noting the production requirement and a copy-pasteable
generation command.

**Deliberately not added**: strength checks on the various third-party
integration secrets (`CLOUDINARY_API_SECRET`, `SMS_API_SECRET`,
`WHATSAPP_APP_SECRET`, `GOOGLE_CLIENT_SECRET`, `PAYMENT_API_SECRET`,
`VIDEO_CALL_API_SECRET`, etc.) — these are issued by their respective
providers, not generated by this application, so "strength" isn't this
app's responsibility to enforce, and they're already correctly excluded
from the `productionRequiredSecrets` presence check (they're optional
integrations, not core security material). Also not added: strength
checks on `OWNER_INITIAL_PASSWORD`/`DIRECTOR_INITIAL_PASSWORD`/
`INITIAL_ADMIN_PASSWORD`/`DEFAULT_ADMIN_PASSWORD` — these are seed-time-only
values consumed directly by `database/seed.js`, not part of the running
app's request-time attack surface the way JWT/encryption secrets are;
flagging as a possible follow-up for whoever next touches `seed.js`, not
fixed here to avoid scope creep into an unrelated script this checkpoint
wasn't asked to touch.

## Production security configuration

Reviewed the existing production-only guard rails already in
`config/env.js` (all pre-existing, all confirmed still correct, no
changes needed beyond the secrets-validation additions above):
- `COOKIE_SECURE` must be `true` in production (blocks boot otherwise) —
  confirmed `auth/auth.service.js`'s cookie-setting code actually reads
  `env.jwt.cookie.secure` from this same validated value, not a separate
  hardcoded flag.
- `ENABLE_DEV_ROUTES` must not be `true` in production.
- `SERVER_URL`/`CLIENT_WEB_URL` must use HTTPS in production.
- `LOG_PRETTY=true` in production produces a warning (not a hard block) —
  correct severity: human-readable logs in production are a
  machine-parseability inconvenience, not a security defect.

Also re-confirmed (per BET-21's original findings, spot-checked again
rather than trusted blindly): `config/security.js`'s CSP-disabled Helmet
configuration still has its documented rationale (JSON-only API, no HTML
content to police) and hasn't drifted since BET-21; `app.js`'s
`trust proxy` setting (`1`) is still present and required for `express-rate-limit`
and `req.ip` to work correctly behind a reverse proxy/load balancer in a
real deployment.

## Security review completion

No code defects were found in this checkpoint's environment-validation or
production-configuration review — the one real gap (secrets validated for
presence but not strength) has been closed, described above. Combined
with BET-21's full attack-surface review (unchanged, still accurate),
BET-23's Security section (environment validation, secrets validation,
production security configuration, security review completion) is
considered complete as of this checkpoint.

## Verification performed this checkpoint

- `node --check src/config/env.js` — clean.
- Full-tree `node --check` sweep — zero syntax errors.
- Manually traced `security/encryption.js`'s `deriveKey()` to confirm
  exactly how `DATA_ENCRYPTION_KEY`/`FIELD_ENCRYPTION_KEY` are consumed
  before writing the length-floor rationale above, rather than assuming.
- Grepped every `_SECRET`/`_KEY`/`_TOKEN`/`_PASSWORD` field in the schema
  to confirm which are core security material (JWT/encryption, now
  strength-checked) versus third-party-issued integration credentials
  (correctly left alone, per the "Deliberately not added" note above).
- Confirmed via grep that no module in `server/src` reads `process.env`
  directly, bypassing the validated `env` object.
- Could not exercise the new production-guard checks against a live
  process boot in `NODE_ENV=production` this checkpoint (no `npm install`
  possible in this sandbox — standing limitation, see
  `SESSION_HANDOFF.md`) — verified by careful manual trace of the logic
  (variable references, comparison operators, the `WEAK_SECRET_PATTERNS`
  substring-match logic) instead. A session with a working `npm install`
  should boot with `NODE_ENV=production` and a deliberately weak/reused
  secret to confirm the new checks fire as intended before this is treated
  as field-verified.
