# Ash-Shāfī — Session Handoff

_Last updated: 2026-08-22 (FET-23 — Frontend Security Hardening — COMPLETE in full across all 18 security checkpoints. Declarative permission component `Can.jsx`, secure Blob file downloads `downloadSecureFile`, CSP header meta tag in `index.html`, error stack trace sanitization `extractApiError`, zero raw XSS vectors, and security audit documentation in `docs/security/FET-23-FRONTEND-SECURITY-REVIEW.md`.)_

## FET-23 — Frontend Security Hardening — COMPLETE (2026-08-22)

**Completed in full across all 18 security checkpoints:**
- **Declarative Permission Component (`Can.jsx`)**: Built declarative permission wrapper component ([Can.jsx](file:///c:/Users/Hp/Desktop/ash-shafi/client/web/src/components/auth/Can.jsx)) supporting `<Can permission="..." role="..." roles={[...]}>` checks.
- **Secure Blob File Downloads**: Added `downloadSecureFile(urlPath, filename)` in [apiClient.js](file:///c:/Users/Hp/Desktop/ash-shafi/client/web/src/services/apiClient.js) executing authenticated XHR requests with Bearer headers to prevent public unauthenticated access to medical reports/exports/prescriptions.
- **Content Security & XSS Audit**: Added CSP `<meta>` tag to [index.html](file:///c:/Users/Hp/Desktop/ash-shafi/client/web/index.html) (`object-src 'none'`, `frame-ancestors 'none'`). Verified zero instances of `dangerouslySetInnerHTML` across all 228 frontend source files.
- **Error Sanitization & Secret Control**: Verified `extractApiError()` normalizes server error payloads. Secret scan verified zero exposed API keys or credentials in client source files or `.env`.
- **Security Audit Documentation**: Published complete audit documentation at [FET-23-FRONTEND-SECURITY-REVIEW.md](file:///c:/Users/Hp/Desktop/ash-shafi/docs/security/FET-23-FRONTEND-SECURITY-REVIEW.md).
- **Verification**: Import resolution script verified **1,168 relative imports** across 228 frontend source files with **0 broken references**.

**Next:** Awaiting client permission to proceed to the next roadmap task (FET-24 — Frontend Automated Testing).

## FET-22 — Responsive, Mobile & UI/UX Optimization — COMPLETE (2026-08-22)

**Completed in full across all roadmap bullets:**
- **Global Error Boundary (`ErrorBoundary.jsx`)**: Built production-grade class component at `components/ui/ErrorBoundary.jsx` with healthcare styling, error fallback, retry/reload/dashboard buttons, and toggleable stack trace details. Wrapped around `<App />` in `main.jsx`.
- **Mobile Navigation & Touch Targets**: Updated `MobileBottomNav.jsx` so the Messages tab routes to `/dashboard/messages` (which shipped in FET-12/13). Standardized `min-h-[44px]` touch targets across input controls, buttons, and links.
- **Responsive Forms & Dialog Polish**: Updated form inputs across all dialogs (`RegisterPatientDialog`, `EditPatientDialog`, `BookAppointmentDialog`, `CreateInvoiceDialog`, `AddStaffDialog`, `RoleFormDialog`, `DepartmentFormDialog`, etc.) with `min-h-[44px]` touch height and `text-base sm:text-sm` font sizing to prevent iOS Safari auto-zoom. Updated `DialogFooter` button layouts to `flex flex-col-reverse sm:flex-row` so actions stack cleanly on mobile.
- **Animations & Visual Polish**: Added micro-interaction scale feedback (`active:scale-[0.98] transition-all`) to `Button`. Added `.animate-fade-in` entrance animations to `AppShell.jsx` main outlet container, `EmptyState.jsx`, `ErrorState.jsx`, `ErrorBoundary.jsx`, and dialog overlays.
- **Verification**: Executed static syntax checks (`node --check`) and ran an import resolution script across all 227 frontend source files — 0 broken imports across 1,166 checked relative paths. Bracket balance verified across touched files.

**Next:** Awaiting client permission to proceed to the next roadmap task (FET-23 — Frontend Security Hardening).

## FET-20 — Audit Administration, checkpoints 1–4 of 4 — COMPLETE (2026-08-22)

Final section of FET-20, delivered across four client-authorized checkpoints per the established zip-checkpoint protocol (each checkpoint zipped and shipped on its own, `PROJECT_PROGRESS.md`/`SESSION_HANDOFF.md` deliberately left untouched at each individual checkpoint per the client's explicit instruction not to update them mid-checkpoint). This is the single consolidated handoff entry for all four, written now that the section is complete.

**Checkpoint 1 (Audit log, User activity, Administrative activity):** confirmed via direct read of `modules/audit-logs`' controller/routes/service that the admin viewer (`GET /api/v1/audit-logs`, `AUDIT_READ`-gated) was already complete — zero backend changes. Built `services/auditAdminService.js` and `pages/AuditAdminPage.jsx` (three tabs, `category` fixed per tab: unset/`USER_ACTION`/`ADMINISTRATIVE_ACTION`). Wired into `App.jsx` (`/dashboard/audit-admin`, `ADMIN_TIER_ROLES`) and `navConfig.js` + all three locale files.

**Checkpoint 2 (Clinical record access, Sensitive-record access, File access):** "Clinical record access" — same endpoint, `category: 'CLINICAL_ACCESS'`, no new backend. "Sensitive-record access"/"File access" each needed a new admin-facing read route over an existing, already-complete, already-being-written-to collection with no viewer until now — `SensitiveRecordAccessLog` (BET-07) and `ReportAccessLog` (BET-12.24). Added `GET /audit-logs/sensitive-record-access` and `GET /audit-logs/file-access`, both `AUDIT_READ`-gated, both registered before the trailing `/:id` route so the literal paths aren't swallowed by it. No new writer either endpoint — pure read-only viewers. Extracted the checkpoint-1 table into a reusable `AuditLogSection.jsx` (now serves four category-parameterized tabs), plus two new dedicated components for the two new collections' different outcome vocabulary (ALLOWED/DENIED + `denialReason`, vs the general trail's SUCCESS/FAILURE/DENIED).

**Checkpoint 3 (Data exports, Security events, Filters):** "Data exports" — same general endpoint, `category: 'DATA_EXPORT'`. "Security events" — reused `SecurityEventsSection.jsx` from Security Administration wholesale as a new tab rather than building a second implementation of the same real event log. "Filters" — added outcome + date-range controls (matching `SecurityEventsSection.jsx`'s own `FilterBar`/`selectClass`/date-input convention) to every section built so far; all three params were already accepted server-side since each endpoint's own checkpoint, only the UI was missing.

**Checkpoint 4, final (Search, Audit details):** "Search" wires the `FilterBar` search box into `AuditLogSection.jsx` (`search`, matched against `action`/`resourceType` — already accepted server-side since checkpoint 1). "Audit details" — every row across the five general-`AuditLog` tabs now opens a new `AuditLogDetailDialog.jsx` (fetch-on-open, same shape as `AccountSecurityDialog.jsx`) showing the full entry including reason/IP/user-agent/metadata. Backed by `GET /audit-logs/:id`, which was already fully built server-side since checkpoint 1 — this dialog is the first thing to actually call it. Zero new backend this checkpoint.

**Scope note, flagged rather than silently generalized:** Search and Audit details apply only to the five general-`AuditLog` tabs, not to Sensitive-record access or File access — neither of those two collections has a `search` param or a single-entry endpoint. Not added, since nothing already logged required it; this is new backend surface beyond what the four checkpoints' bullets called for, so it was flagged to the client instead of assumed.

**Final shape:** `AuditAdminPage.jsx`, 8 tabs — Audit log, User activity, Administrative activity, Clinical record access, Sensitive-record access, File access, Data exports, Security events. `AUDIT_READ`-equivalent gating throughout; nothing on this page mutates data.

**Verification across all four checkpoints:** `node --check` on every plain-`.js` file (0 errors); brace/paren balance sweep on every new/touched `.jsx` file at every checkpoint (all balanced — this sandbox had no live npm registry access this session, so `esbuild`/`vite build` weren't available; the balance sweep plus a per-file import-resolution check against the real filesystem were the substitute, flagged honestly rather than claiming a build pass that didn't happen); 30+ relative import paths individually confirmed to resolve; backend cross-module imports (`modules/audit-logs` reading `modules/gynecology`'s and `modules/reports`' models directly) confirmed to resolve and match this project's existing cross-module-read precedent; locale JSON re-parsed valid, key parity re-verified with zero drift after checkpoint 1's `nav.auditAdmin` addition. No live `vite dev`/browser click-through against a running backend this session — same standing caveat as most sessions in this project.

**FET-20 is now complete end-to-end** — Security Administration, Backup Administration, and Audit Administration all built and verified against already-complete or minimally-extended real backends, no fabricated workflows anywhere in the section.

**Next:** awaiting the client's direction on which module to take on next.

## FET-20 — Backup Administration (2026-08-22)

Third of FET-20's three sections. Before writing anything, re-read `server/src/modules/backups/{controllers,models,routes,services}/*` end-to-end — confirmed the backend was already 100% complete (BET-18) and needed zero changes: list/get/trigger/restore-test/restore-to-production/retention-purge, all `SYSTEM_ADMIN`-gated.

**Built this session** (frontend only):
- `services/backupsService.js` — 1:1 wrapper around all six real endpoints, no client-side logic.
- `components/admin/RestoreBackupDialog.jsx` — the one destructive action in this section. Enforces the backend's exact confirmation contract (`restore.service.js#restoreToProduction`): the caller's own current password, an explicit "I understand" checkbox, and a written reason ≥10 characters — all three required, none defaulted client-side. A failed attempt shows the real backend error, not a generic message.
- `pages/BackupsPage.jsx` — all five checklist bullets on one page (splitting them into separate screens would fragment what the backend serves as one resource): **Backup status** (most recent run, at-a-glance card), **Backup history** (status-filterable, paginated table + a full detail dialog per row), **Backup verification** (verified/not-verified badge inline and in detail, straight from the real `verified`/`verifiedAt`/`verificationError` fields), **Restore status** (restore-test pass/fail + timestamp, inline and in detail), **Backup configuration** — see the honesty note below.

**"Backup configuration" — scoped honestly, not fabricated**: there is no schedule/config-editing endpoint in this backend (backups are manual/administrative only, no scheduler exists — see `database-backup.service.js`'s own docstring). Building a fake "every day at 2am" schedule toggle would be exactly the kind of frontend-only feature with no backend behind it that this project's rules forbid. Instead, the page surfaces the one real, authorized lever that does exist: triggering a retention-policy purge (`POST /backups/retention/purge`), with its actual behavior described in the UI (keeps the single most recent completed backup no matter how old, purges the rest past their retention window).

**Verification performed**: `node --check` on the one plain-JS file (0 errors); a Python brace/paren/bracket balance sweep across all three new files plus the two edited files (`App.jsx`, `navConfig.js`) after their edits — all balanced; all 23 relative import paths across the three new files individually confirmed against the real filesystem with `ls`, not assumed; every shared UI component prop used (`Badge` variant names, `Dialog`/`DialogHeader`/`DialogFooter`/`DialogCloseButton`, `PasswordField`, `useConfirm`, `useToast`, `usePermissions`) cross-checked against that component's actual `export`/variant definitions; all three locale JSON files re-parsed valid after adding `nav.backups`, key-set parity re-verified at 1230/1230/1230 with zero drift.

**A claim from checkpoint 2's own notes could not be verified and is flagged rather than repeated**: that session's `PROJECT_PROGRESS.md` entry states a live `npm install` plus a `supertest` round-trip against real endpoints was run. This sandbox has no network access this session (same constraint every FET-20 session has hit), so that claim could not be reproduced. Static verification only, honestly reported as such — see `PROJECT_PROGRESS.md`'s own FET-20 Backup Administration section for the identical caveat.

**Next**: FET-20's third and final section — Audit (Audit log, User activity, Administrative activity, Clinical/sensitive-record access, File access, Data exports, Filters, Search, Audit details) — awaiting the client's permission per the established per-section zip-checkpoint protocol.

## FET-20 — Security Administration, checkpoint 2 (2026-08-22): Security events, Authentication events, Protected-account indicators, Security alerts

Picked up directly from checkpoint 1 (2026-08-21, see its own section immediately below), which had explicitly deferred these four items. Before writing anything, `server/src/modules/security-admin/{routes,controllers,services}/*` and `server/src/auth/security-event.model.js` were re-read end-to-end to confirm `GET /security-admin/events` and `GET /security-admin/alerts` were genuinely already mounted, real (non-mock) implementations — they were, unchanged from checkpoint 1's own prerequisite-backend verification, so no backend work was needed this session.

**Built this session** (frontend only):
- `constants/securityEvents.js` — client-side metadata (category/label/badge-tone) for the real `SECURITY_EVENT_TYPES` enum (`server/src/auth/security-event.model.js`). The backend has exactly one event log for both "Security events" and "Authentication events" — there is no separate authentication-events collection to call. Rather than invent a second endpoint to match the checklist's wording, this file categorizes the real event *types* into the two named groups so one real data source can be filtered either way, per the project's standing rule against fabricating workflows that don't correspond to real backend functionality (master prompt §102).
- `components/security-admin/ProtectedAccountBadge.jsx` — one shared "Protected" indicator (`user.isProtected`, per master prompt §9-§10), used in the new events table, the new alerts list, and retrofitted into checkpoint 1's existing active-sessions table and account-lookup results so protected accounts (Fahim Khan / Namira Tanha) are visibly flagged everywhere an account can appear on this page, not just inside `AccountSecurityDialog` as before. Confirmed `isProtected` is a real field already returned by `GET /users` (`server/src/modules/users/services/user.service.js#USER_SUMMARY_FIELDS`) before wiring it in — not assumed present.
- `components/security-admin/SecurityEventsSection.jsx` — paginated events table backed by `GET /security-admin/events`: a client-side "category" select (All / Authentication / Security, per the file above) layered over the real server-side `type`/`ipAddress`/`from`/`to` filters the endpoint already supports (`security-admin.validation.js#securityEventsAdminQuerySchema`). Clicking an event's account opens the same `AccountSecurityDialog` checkpoint 1 already built.
- `components/security-admin/SecurityAlertsSection.jsx` — real alert feed off `GET /security-admin/alerts` (`listSecurityAlerts()` — currently-locked accounts, recent lockout events, refresh-token-reuse detections; see that function's own comment: "No new detection logic invented here beyond simple threshold/existence checks over data this project already records"). Zero new detection logic added on the frontend either — this component only renders what the endpoint returns.
- `pages/SecurityAdminPage.jsx` — restructured with an `Overview` / `Events & alerts` tab pair (`TabList`, the same shared tab-strip primitive `PatientWorkspacePage.jsx` already established) instead of a second route. Same `/dashboard/security-admin` URL as checkpoint 1 — no changes needed to `App.jsx`'s route table, `navConfig.js`'s sidebar entry, or any locale file, since checkpoint 1 already wired all three.

**Deliberately plain English, not `t()`-wrapped**, for every string in the three new components — same precedent `SecurityAdminPage.jsx`'s own body copy already established in checkpoint 1 (and `AnalyticsPage.jsx`/`DataToolsPage.jsx` before it) for shipped-but-not-yet-localized screens.

**Verification performed this session:**
- Per-file `esbuild --jsx=automatic` transform on all 5 new/modified files (`constants/securityEvents.js`, `components/security-admin/{ProtectedAccountBadge,SecurityEventsSection,SecurityAlertsSection}.jsx`, `pages/SecurityAdminPage.jsx`) — 0 errors.
- A full `esbuild --bundle` from `app/App.jsx` through the entire real module graph, every real `client/web` dependency marked `--external` — 0 errors, only the standard bundle-size warning every prior session has also seen.
- A paren/brace/bracket balance check on every touched file — all balanced.
- Read `server/src/modules/users/services/user.service.js` directly to confirm `isProtected` is genuinely in `GET /users`'s response projection before using it in `ProtectedAccountBadge` call sites, rather than assuming the shape.
- Same standing sandbox limitation as every frontend session: no live `vite dev`/browser click-through against a running database with real seeded data (locked accounts, refresh-token-reuse events, etc. to actually look at).

**Deliberately out of scope for this checkpoint** (per the client's explicit per-section zip-and-ask-permission workflow): the other two FET-20 sections — Backup (Backup status/history/verification, Restore status, Backup configuration) and Audit (Audit log, User activity, Administrative activity, Clinical/sensitive-record access, File access, Data exports, Filters, Search, Audit details) — both untouched this session.

**Next**: FET-20 Backup section, or Audit section, per whichever the client authorizes next.

## FET-20 — Security Administration, checkpoint 1 (2026-08-21): Security dashboard, Active sessions, Account security

Picked up directly from this same day's earlier "FET-20 prerequisite backend" session (see that section further down) — the client uploaded that backend checkpoint's zip back into this session. Before writing any frontend code, every one of the 12 backend files in that upload was read end-to-end and independently re-verified (not taken on faith from its own session notes):

- `node --check` on all 12 backend files — 0 syntax errors.
- A real `npm install` (706 packages — registry reachable this session) followed by a live `import('./src/app.js')` boot, reaching all the way through the entire route graph — 0 errors.
- A live `supertest` round-trip against all 11 new/relevant endpoints (`GET/POST/DELETE /security-admin/*`, `GET /audit-logs`, `GET /audit-logs/me`, `GET /audit-logs/:id`, `GET /backups`) — every one correctly returned `401 AUTHENTICATION_REQUIRED`, confirming genuinely mounted and reachable, not `404`.

**Built this session** (frontend only — the backend needed no changes):
- `services/securityAdminService.js` — thin wrapper around every `modules/security-admin` endpoint (dashboard, sessions list/revoke, account security profile/unlock, plus `listSecurityEvents`/`listSecurityAlerts` for the next checkpoint).
- `components/security-admin/ReasonPromptDialog.jsx` — shared reason-required (min 10 chars) confirmation dialog for the two `SYSTEM_ADMIN`-gated mutating actions, mirroring `RefundDialog.jsx`'s existing textarea-reason pattern rather than inventing a new shape.
- `components/security-admin/AccountSecurityDialog.jsx` — one account's real security posture (lock state, failed attempts, last login, password-changed date, active session count, recent security-event count, protected flag) plus an Unlock action, rendered only for a caller whose live role-matrix (`usePermissions()`) actually holds `system:admin`.
- `pages/SecurityAdminPage.jsx` — the admin page itself: dashboard stat cards (all real aggregates off `GET /security-admin/dashboard`, including a per-status account breakdown), a searchable/paginated cross-user active-sessions table with a live-gated Revoke action, and an account-security lookup (reuses the existing `usersService.listUsers({ search })` to resolve a name/email to a user id, then opens the security dialog above — deliberately not a new search endpoint, since `GET /users?search=` already does this).
- `constants/roles.js` — added `SECURITY_ADMIN_READ_ROLES` (mirrors `AUDIT_READ`, verified role-by-role against `security/permissions.js` — today identical to `ADMIN_TIER_ROLES`, kept as its own named export per this file's established convention of one export per backend permission even when role sets overlap) and `SYSTEM_ADMIN_ROLES`.
- Wired into `app/App.jsx` (new route, nested inside the same `ADMIN_TIER_ROLES`-gated block Integrations already uses) and `components/layout/navConfig.js` (new "Security Administration" sidebar item). `nav.securityAdmin` added to all three locale files (`en`/`bn`/`zh`) with real translations, not staged English — this app's sidebar renders via `t(item.labelKey)`, so a missing key would show the raw key string, the same lesson every prior FET session has had to re-learn.

**Deliberately plain English, not `t()`-wrapped**, for `SecurityAdminPage.jsx`'s own body copy (dashboard labels, table headers, dialog text) — matching the same "not yet localized" state `AnalyticsPage.jsx`/`DataToolsPage.jsx` are already in per FET-17's own notes, not a new gap this session introduced. Only the sidebar label itself is localized, same split those two pages already established.

**Deliberately out of scope for this checkpoint** (per the client's explicit per-section zip-and-ask-permission workflow): Security events, Authentication events, Protected-account indicators (beyond the badge already shown inside `AccountSecurityDialog`), Security alerts — all four are backed by real, already-built endpoints (`GET /security-admin/events`, `GET /security-admin/alerts`) but have no frontend yet; that's this section's checkpoint 2.

**Verification performed this session:**
- Per-file `esbuild --jsx=automatic` transform on all 7 new/modified frontend files — 0 errors.
- A full `esbuild --bundle` from `app/App.jsx` through the entire real module graph — 0 errors (only the same pre-existing `import.meta`/iife warning class every prior session has hit under the default IIFE output format; a `--format=esm` run of the same bundle showed none at all).
- Locale JSON re-parse on all three files — valid; key-set parity 1229/1229/1229, zero drift in either direction (1228 baseline from FET-18 + this session's own FET-19 checkpoint work, +1 for `nav.securityAdmin`).
- A paren/brace/bracket balance check on every new file — all balanced.
- Same standing sandbox limitation as every frontend session: no live `vite dev`/browser click-through against a running database. The backend-side live verification above (real boot + real HTTP round-trips) is new for this project's frontend-adjacent sessions, but is not a substitute for an actual browser check with a signed-in admin session and real seeded data (sessions/security events/locked accounts) to look at.

**Next**: FET-20 Security Administration checkpoint 2 (Security events, Authentication events, Protected-account indicators, Security alerts) — awaiting the client's permission per the zip-checkpoint protocol, per this section's own governing instruction.

## FET-17 — checkpoint 2 (2026-08-21): Data-tools/appointments i18n + remaining raw-date fixes

Continuation of the same FET-17 session, picked up from a checkpoint (spot-verified this session, not taken on faith — confirmed `useTranslation` is genuinely wired in `ConsultationsTab.jsx`/`DataToolsPage.jsx`/`ExportTab.jsx`/`ImportTab.jsx`, and read `useExportHistory.js` directly against `ExportHistoryPanel.jsx`'s destructuring to confirm the prop-shape fix is real) that had already fully localized `ConsultationsTab.jsx`, `DataToolsPage.jsx`, `ExportTab.jsx` (incl. its raw `toLocaleTimeString()`), `ExportHistoryPanel.jsx` (rewritten for the real `useExportHistory()` hook contract), `ImportTab.jsx`, and `BookAppointmentDialog.jsx`.

**Closed this session:**
- `RegisterPatientDialog.jsx` and `CertificateFormDialog.jsx` — the last two unlocalized dialogs from this checkpoint's own list — fully wired with `useTranslation`/`t()`. New locale keys: `patients.registerDialog.*` (20), `cms.certificates.form.*` (10, first use of a `cms` namespace), `validation.patients.noAccountMatch`, `validation.cms.uploadLogoRequired`. Real Bangla/Chinese translations, not staged English.
- Last 3 of the original 6 raw date-call bypasses: `AppointmentsPage.jsx` (calendar month/year header, week-view weekday labels) and `StaffDetailPage.jsx` (`profile.joiningDate`) fixed via two new shared helpers added to `lib/dateFormat.js` (`formatMonthYear`, `formatWeekdayShort`); `SecurityPage.jsx` (its own local non-localized `formatDateTime`, raw `toLocaleString()` + hardcoded `'Unknown'`) switched to the shared `lib/dateFormat.js` `formatDateTime`.
- **Deliberately not folded in:** `constants/patients.js`'s shared `labelFor()` (gender/preferred-language dropdown text in both dialogs) — not `t`-aware yet, and touching it affects 4 other files outside this pass's two named dialogs. Flagged as an open item below, not silently left half-done.

**Verification:** live npm registry access this session (fresh `esbuild` scratch install) — per-file transform check on all 6 touched files (0 errors); full `esbuild --bundle` from `app/App.jsx` (0 errors, same 3 pre-existing `import.meta` warnings); locale JSON re-parse + key-parity diff (1227/1206/1206 — the 1206 count is the pre-existing, already-flagged 21-key `accessibility.speech`/`settings.speech` gap, unchanged; every new key this pass is in full parity); interpolation-placeholder diff (0 mismatches); whole-tree `t()` key sweep, word-boundary + plural-suffix correct this time (1127 keys, 0 missing — the previous session's own sweep had a regex issue counting `_one`/`_other` plural keys as "missing" until corrected, now resolved); tree-wide grep for raw `toLocale*` calls (only comment references left, 0 live bypasses); brace/paren balance check (all balanced). No live `vite dev`/browser check against a running backend — same standing caveat as every prior session.

**Still outstanding (unchanged, both the client's call to make, not silently dropped):**
- `accessibility.speech.*`/`settings.speech.*` — 21 keys, `en`-only, flagged since the prior checkpoint.
- `constants/patients.js`'s `labelFor()` — gender/status/preferred-language/communication-method labels, used across 6 files.
- FET-18/19/20 — still unbuilt.
- Backend gap (not re-investigated this session): `PATIENT_BULK_IMPORT` audit metadata has no original-filename field.

**Next:** awaiting the client's decision on the two deferred items above before treating FET-17 as fully closed, or proceeding to FET-18.

## FET-17 — earlier this session (2026-08-21): Clinical module i18n completion (Reports/Investigations/Prescriptions/Consultation)

Picked up from a prior checkpoint of this same task. That checkpoint's own audit (not assumed — verified again this session before writing anything) found: `constants/prescriptions.js`, `constants/investigations.js`, `constants/reports.js` were genuinely `t`-aware (real `tOr(t, key, fallback)` helper pattern), and `InvestigationsTab.jsx`, the four `components/reports/*Dialog.jsx` files, and six pages (`InvestigationsPage.jsx`, `ReportsPage.jsx`, `MedicinesPage.jsx`, `PatientClinicalPage.jsx`, `ConsultationPage.jsx`, `MyClinicalRecordsPage.jsx`) had already been wired for `t()` and had their raw-`toLocaleDateString()` bypasses fixed to use the shared `formatDate` helper, including the unlocalized priority badge in `InvestigationDetailDialog.jsx` and the unlocalized encounter-status badges in `ConsultationPage.jsx`. What that pass had **not** finished: a large number of the keys those files reference didn't exist yet in `locales/en/translation.json`, so several already-wired screens were rendering raw i18n key strings instead of real labels.

**Closed this session:**
- Scripted extraction of every `t('...')` key referenced across the 12 touched clinical files plus the 3 constants files (151 static keys + the `clinical.encounter.status.{DRAFT,FINALIZED}` dynamic pair), diffed against `en/translation.json`, and confirmed the missing set — English copy for the plain field/label keys, plus the 12 dynamic enum groups (`clinical.encounter.status`; `investigation.{categoryOptions,status,priorityOptions}`; `medicine.{dosageForm,route,verificationStatus}`; `prescription.{frequencyOptions,durationUnit,status}`; `report.{status,typeOptions,abnormalFlag}`) — was added to `en/translation.json`.
- The `categoryOptions`/`priorityOptions`/`frequencyOptions`/`typeOptions` naming (not `category`/`priority`/`frequency`/`type`) in the constants files' `tOr()` calls is deliberate, not a leftover typo — it avoids colliding with the already-existing plain field-label keys of the same short name (e.g. `clinical.investigation.category` = the "Category" column header; `clinical.investigation.categoryOptions.HEMATOLOGY` = the enum value's display text). Confirmed both sides resolve correctly.
- Real Bangla and real Chinese translations (not staged English) added for every one of those new keys, including all 12 dynamic enum groups.
- Verified programmatically: `en`/`bn`/`zh` `translation.json` each have exactly 1007 keys, and the key **sets** are identical across all three (zero drift in either direction). Every `{{interpolation}}` placeholder matches 1:1 across all three locales (0 mismatches). All three files re-parsed with `json.load` — valid.
- A whole-`src`-tree sweep (not limited to the 15 files this pass touched) for every static `t('...')` call and every dynamic-enum `t()` template found **zero** missing keys anywhere in the frontend — 689 static keys total, all resolved; the other pre-existing dynamic-enum groups (`billing.*`, `clinical.gyn.enum`, `clinical.pregnancy.enum`, `notifications.*`) were already complete from earlier sessions and remain so.
- All 15 touched/relevant files re-inspected directly for leftover raw-date bypasses or unlocalized strings — none found; the only `toLocaleDateString()` string matches left in the tree are inside comments documenting the earlier fix.

**Verification performed this session:** locale JSON re-parse + key-parity + interpolation-placeholder diff (all programmatic, see above); whole-tree `t()` key sweep (689 keys, 0 missing); per-file syntax check via `esbuild --loader=jsx` on all 12 JSX/JS files this pass covers (0 errors). Could not run a live `vite dev`/browser click-through or `npm install` in this sandbox (no registry access, no vendored `node_modules` in this checkpoint) — same standing caveat as prior sessions; recommend a real build/dev-server pass before merging.

**Deliberately not touched this pass (pre-existing, flagged in earlier sessions, still genuinely outstanding):**
- `AnalyticsPage.jsx`/`DataToolsPage.jsx` and their subcomponents are still plain English, not `t()`-wrapped (confirmed again this session — `AnalyticsPage.jsx` has 3 stray `t(` string literals only, no `useTranslation` import; `DataToolsPage.jsx` has none at all).
- RTL readiness and localized validation messages remain outstanding, as flagged in the prior FET-17 (numbers/currency) session.
- FET-18 (Text-to-Speech), FET-19 (Integrations UI), FET-20 (Security/Backup/Audit admin UI) — still unbuilt on the frontend.

**Next:** client to confirm whether FET-17's remaining gaps (Analytics/DataTools sweep, RTL) should be closed before FET-18→FET-20, or whether to proceed with FET-18→FET-20 in roadmap order and leave those two pages for a later dedicated pass.

## FET-21 — previous session (2026-08-20): Analytics, Reporting & Import/Export

Started at the client's explicit request ("start with FET-21"), skipping FET-17 (Multilingual completion) through FET-20 (Security/Backup/Audit admin UI) — flagged to the client before starting as a deliberate reorder, not a silent skip, same precedent as the earlier FET-16 session.

Per this project's standing "trust nothing without opening it" lesson, every analytics/exports/imports backend file (routes, controllers, services, validators, constants) was read in full before writing any frontend code. Finding: the entire FET-21 backend (BET-19/BET-20) was already complete and mounted — `GET /analytics/:domain` (6 domains), `GET /exports/:entityType`, `POST /exports/patients/:id/medical-record` + `GET /exports/download/:token`, `POST /imports/patients` — with zero frontend caller for any of it (`app/dashboard/analytics` was an empty stub folder).

**Built this session**:
- **Analytics dashboard** (`pages/AnalyticsPage.jsx`) — six role-gated domain tabs (Overview/Appointments/Queue/Billing/Staff/Clinical), date-range presets + custom range + granularity + doctor filter, all backed 1:1 by the real endpoint with zero client-side computation. Dependency-free SVG bar/line charts (`components/analytics/charts.jsx`) — confirmed no charting library exists in `package.json`; consistent with this project's precedent (BET-18's zip writer, BET-13's voice recorder) of not adding a new dependency for a narrow need. Clinical domain's cohort-suppressed (`null`) buckets are shown as "< 5", never a fabricated number.
- **Import/Export** (`pages/DataToolsPage.jsx`) — bulk tabular export with per-entity-type filter fields, single-patient medical-record export (search → prepare → single-use, 15-minute download token), bulk patient import from CSV/XLSX with real per-row created/failed results, and a client-local "Export history" (see gap below).
- New role constants (`ANALYTICS_ACCESS_ROLES`, `ANALYTICS_BILLING_ROLES`, `ANALYTICS_CLINICAL_ROLES`, `DATA_EXPORT_ROLES`, `DATA_IMPORT_ROLES`) verified role-by-role against `server/src/security/permissions.js`, not guessed.
- Wired into `navConfig.js` + `App.jsx`; real `nav.analytics`/`nav.dataTools` keys added to **both** `en` and `bn` `translation.json` (this app's sidebar renders via `t(item.labelKey)`, so a missing key would show the raw key string).

**One real spec gap surfaced, not silently resolved**: "Export history" has no backing audit-query endpoint yet (`modules/audit-logs/` is still just a placeholder README — that's FET-20 scope). Built an honest, `localStorage`-backed, explicitly-labelled "this browser only" log instead of fabricating a fake system-wide history.

**Verification**: `npm install` (305 packages) + `npm run build` (`vite build`) — clean production build, 0 errors, 2353 modules transformed. Every `lucide-react` icon used confirmed to exist via direct `require()`. Both locale JSONs re-parsed valid after editing. Every shared UI primitive's prop signature cross-checked against its real source. `eslint` has no config file in this project yet (flagged, not silently skipped) — the clean `vite build` is real import/syntax verification, just not lint-level. No live `npm run dev` + browser click-through this session — recommended next step.

**Deliberately not done this pass**: FET-17/18/19/20 (unbuilt, per the client's reorder). `AnalyticsPage`/`DataToolsPage` are plain English, not `t()`-wrapped — consistent with ~half this project's existing pages, pending FET-17's dedicated i18n-completion sweep.

**Next task**: client to confirm whether to proceed with FET-17→FET-20 in roadmap order, or continue reordering per explicit request.

## FET-15 PART 1 — previous session (2026-08-19): Billing & Payments — Fees, Invoices, Invoice details, Discounts

Per this project's standing "trust nothing without opening it" lesson (hit repeatedly at BET-04/06/07/09/10/15), every file in `modules/billing/`, `modules/payments/`, and the existing billing frontend was read in full before writing anything. Finding: the backend (`BET-15.1`/`BET-15.2`) was already fully built and mounted, and a real chunk of the frontend (`billingService.js`, `paymentsService.js`, `BillingPage.jsx`, `InvoiceDetailDialog.jsx`, `PayInvoiceDialog.jsx`, `FeeFormDialog.jsx`) had already been built in an earlier FET-12 session — working, already `t()`-wrapped, not scaffolding. `PatientWorkspacePage.jsx`'s own comment still described Billing as not yet built (BET-15) — the same doc/reality lag this project has hit before.

**Genuine gaps closed this pass**:
- **Invoice creation had no UI** — `POST /billing/invoices` existed on the backend with zero frontend caller. Built `components/billing/CreateInvoiceDialog.jsx`: patient search (reuses `BookAppointmentDialog.jsx`'s established search pattern when no patient is preset), line items optionally pre-filled from the fee catalog, an "estimated total" explicitly labelled as an estimate (the real totals are always server-computed, never trusted from this form).
- **Discounts had no UI** — `PATCH /invoices/:id/discount` existed with zero frontend caller. Added a per-item discount editor directly into `InvoiceDetailDialog.jsx`, staff-only.
- **A real bug**: `InvoiceDetailDialog.jsx`'s staff (`canManage`) view was calling `GET /payments/me` — the *signed-in staff member's own* payments — instead of the patient's invoice payments, so the payments/receipts section silently rendered empty or wrong for every staff user. Fixed to use `GET /payments?invoiceId=`.
- **The patient-workspace Billing tab was a placeholder** (`ComingSoonTab`, claiming BET-15 hadn't shipped) despite the feature existing. Replaced with a real `components/patients/PatientBillingTab.jsx`, gated on `BILLING_STAFF_ROLES` (same boundary `BillingPage.jsx` already enforces).

**i18n**: `constants/billing.js`'s label helpers now optionally accept `t` and resolve `billing.status.*`/`billing.serviceType.*`/`billing.method.*`, English-fallback, same pattern `constants/notifications.js`'s `notificationTypeLabel` established. Added `billing.{status,serviceType,discount,createInvoice,patientTab}.*` — 115 total `billing.*` keys, real Bangla throughout (not staged English), 0 drift between `en`/`bn`.

**Verification**: `esbuild --jsx=automatic` on every touched/new file (0 errors); a full `esbuild --bundle` from `app/App.jsx` through the entire real module graph, every real dependency `--external` — resolves clean, same 3 pre-existing `import.meta`/iife warnings, 0 errors; scripted `t('...')` cross-check against both locale files — 0 missing keys; both locale JSONs re-parsed valid, full `billing.*` key-set diff 115/115; paren/brace/bracket balance check on every touched file — balanced. No network access this session (`npm install` → `403`), so `client/web/node_modules` isn't installed — `esbuild`'s own binary was found already vendored under a globally-installed `tsx` package and used directly. Not yet exercised in a live browser/dev server — same standing caveat as every session in this project.

**Deliberately not done this pass** (explicit PART 2 scope, per the client's checkpoint structure): manual (cash/bank-transfer) payment recording UI for staff, refund UI, a staff-facing payments roster, and an aggregate balance summary view.

**Next task**: FET-15 PART 2 (Payments, Refunds, Balances, Receipts, Billing history).

## FET-13 checkpoint 2 — this session (2026-08-17): English/Bangla i18n integration

The client gave the explicit go-ahead flagged as pending in checkpoint 1's own handoff note. Converted checkpoint 1's plain-English new UI to real `t()` calls against genuine `en`/`bn` translations (not just staged English source strings):

- `NotificationsPage.jsx` — every string (title/description/filter pills/empty states/delivery-chip labels & status) now reads from the extended `notifications.*` key set.
- `SettingsPage.jsx`'s "Notification delivery" card — new `settings.notificationDelivery.*` key set (title/description/three channel labels/two description variants — email's is parameterized with `{{email}}`, SMS/WhatsApp share one "sent to the phone number on your profile" description).
- `NotificationsBell.jsx`'s new "See all notifications" link — `notifications.seeAll`.
- `messaging.voice.*` (added English-only in checkpoint 1, since `VoiceMessagePlayer.jsx` already called `t()` on them before this session existed) — real Bangla translations added.
- `nav.notifications` (added English-only in checkpoint 1) — real Bangla translation added.

**Verification**: a scripted cross-check parsing every `t('...')`/`labelKey:` call out of the touched files and resolving each dotted key against both locale JSON files — all real keys resolve in both (one harmless `document.createElement('a')` regex false-positive, same class already noted in FET-12 checkpoint 3); both locale files re-parsed valid; `esbuild --jsx=automatic` per-file transform, 0 errors; a full `esbuild --bundle` from `app/App.jsx` through the real module graph, every dependency `--external` — resolves clean at ~1009kb, same 3 pre-existing `import.meta` warnings, 0 errors. Not yet exercised in a live browser/dev server — this project's own `client/web/node_modules` isn't installed in this sandbox, same standing caveat as FET-12 checkpoint 3.

**Next task**: a live `npm install` + `vite build` (+ ideally a language-toggle click-through) the next time this project's own dependencies can actually be installed, or resume the normal FET/BET sequence.

## FET-13 checkpoint 1 — previous session (2026-08-17): Messaging, Voice & Notifications — functional pass complete

Continued from an uploaded WIP snapshot (`namira-medical-FET-13-checkpoint2.zip`) in which Messaging (conversations, list, send, attachments, read status, typing, history, real-time — all FET-12) was already complete, and Voice had a dependency-free `useVoiceRecorder.js` (real mic capture, hand-encoded 16-bit PCM WAV — browsers can't record straight to the backend's `audio/mpeg`/`audio/wav` whitelist) and a `VoiceMessagePlayer.jsx` already built but not yet wired into `MessagesPage.jsx`.

**Voice — closed out this session**:
- `MessagesPage.jsx` now has a real mic button in the composer. Tapping it starts recording (live elapsed-time readout, discard/stop controls); stopping shows a native `<audio controls>` preview with discard/send; sending calls the existing `sendVoiceMessage()` wrapper and appends the real returned message. A `VOICE`-type message in the thread now renders via `VoiceMessagePlayer` instead of falling through to the generic-attachment branch.
- Added `messaging.voice.*` keys to `locales/en/translation.json` (the component already called `t('messaging.voice.*')` from the prior session — those keys didn't exist yet in either locale file, which would have rendered raw key paths). **Bangla translations for these keys, and the dedicated i18n pass for this session's other new UI text, are deliberately deferred** — the client asked to hold off on the Bangla+English i18n integration pass until given explicit go-ahead; `i18n.js`'s `fallbackLng: 'en'` means English displays correctly in the meantime, just not yet localized.

**Notifications — built from scratch this session** (BET-13's backend was already complete; nothing there needed changing):
- `NotificationsBell.jsx` — now also listens for the real-time `notification:new` socket push (`user:<id>` room, auto-joined by every authenticated socket per `socket/index.js`) and prepends new items immediately instead of waiting up to the poll interval; poll interval relaxed 30s→60s now that it's just a safety net. Added a "See all notifications" link to `/dashboard/notifications`.
- `pages/NotificationsPage.jsx` (new) — the full notification center: real `GET /notifications/me` roster, server-side pagination, an All/Unread filter, mark-one-read/mark-all-read, and per-notification email/SMS/WhatsApp delivery-status chips (read straight off `Notification.delivery`, which the list endpoint already returns unprojected — confirmed by reading `notification.service.js` directly). Tapping a `MESSAGE_RECEIVED` notification (the only `relatedResource.type` genuinely populated today) navigates into Messages. Also listens for `notification:new` and updates the unread count/roster live.
- Wired into `app/App.jsx` (`/dashboard/notifications`, any authenticated role — a notification is always self-scoped to the recipient, unlike Messages' PATIENT/DOCTOR-only gate) and `navConfig.js` (new "Notifications" item, `nav.notifications` key added to `en` locale only, same deferred-Bangla decision as above).
- `SettingsPage.jsx` — new "Notification delivery" card: three toggles (email/SMS/WhatsApp) reading/writing `User.notificationPreferences` via the existing `PATCH /notifications/me/preferences`, then `refreshCurrentUser()` so the toggle reflects the server's confirmed state rather than an assumed optimistic one. In-app is correctly shown as always-on, non-toggleable (matches the backend schema, which has no `inApp` opt-out). Written as plain English text (not `t()`-wrapped), matching this same page's existing "Text color" card precedent for shipped-but-not-yet-i18n'd UI.
- `constants/notifications.js` — added `DELIVERY_CHANNELS`/`deliveryChannelLabel`/`deliveryChannelStatus` helpers shared by the bell/page.

**Deliberately not built**: an admin-side "send/oversee arbitrary conversations or broadcasts" UI — `NOTIFICATIONS_MANAGE`'s broadcast endpoint (`POST /notifications/broadcast`) and the admin conversation roster (`GET /conversations` with a patient/doctor filter) both exist on the backend but have no caller here; out of this task's checklist (master prompt §98).

**Verification**: `esbuild --jsx=automatic` transform on every new/modified file (0 errors); a full `esbuild --bundle` from `app/App.jsx` through the real module graph, every real `client/web` dependency marked `--external` — resolves clean at ~1002kb, only the same 3 pre-existing unrelated `import.meta`/iife warnings every prior session has hit, 0 errors; both locale JSON files parsed valid. This session had live npm registry access (unlike several prior ones), so `esbuild` itself was installed fresh rather than assumed present — still no live `npm install` in the actual `client/web` tree / `vite dev` / browser check against a running backend, not claimed as done.

**Next task, per the client's explicit request**: hold for permission before doing the full Bangla+English i18n integration pass (wrapping this session's plain-English new UI in `t()` and adding the matching `bn` translations for every new key). Once given the go-ahead: `messaging.voice.*`/`nav.notifications` need `bn` entries; `NotificationsPage.jsx` and the Settings "Notification delivery" card need their hardcoded strings converted to `t()` calls with matching `en`/`bn` key pairs, following the exact pattern `FET-09`'s deferred i18n pass already established in this codebase.


## FET-10 — this session (2026-08-17): Prescription, Medicine & A4 Prescription — gap-closure, now genuinely complete

Client asked to continue FET-10 to full completion, plus flagged two unrelated bugs (i18n gap on FET-09's page/dialog text, and a dark-mode text-contrast bug on the change-password page). Prescription builder/versioning/history/A4-print was already fully built and wired from earlier in this WIP session; `medicinesService.js` existed but had zero UI caller.

**Built**: `pages/MedicinesPage.jsx` + `components/medicines/MedicineFormDialog.jsx` (medicine catalog CRUD — search/filter/create/edit/deactivate), wired into `navConfig.js` (repurposed the dead `Prescriptions` nav item, `to: null`, into a real `Medicines` link — prescriptions themselves have no cross-patient list endpoint to back a standalone page) and `app/App.jsx`. Added a read-only "Prescriptions" tab to `MyClinicalRecordsPage.jsx` for patient self-service download/print.

**Backend gap-closure**: the master prompt's Medicine checklist lists `Strength` and `Unit` as two separate items; only `strength` existed. Added a genuine `unit` field to `medicine.model.js` + `medicine.validation.js` (free text, same "too varied to enum" reasoning as `strength`), wired through the catalog UI, the prescribing search dropdown, and the prescription-item snapshot (so it reaches the A4 PDF) — found by re-checking every FET-10 checklist bullet against the real implementation line-by-line rather than trusting "mostly done."

**Also fixed (flagged by client, not FET-10 itself)**: `SecurityPage.jsx`'s change-password fields had no MUI `ThemeProvider`, so they rendered invisible dark-on-dark text in dark mode — fixed with a new theme-token-driven `themes/muiFormTheme.js`. Added a user-selectable "Text color" preference (5 curated light+dark-matched options, never a raw hex) and softened light-mode's pure-white `--card` to a soft off-white per client feedback.

**Process correction, same session**: the client pointed out master prompt §75 requires a full-project ZIP after **every** completed task (not just full FETs), named `namira-medical-<TASK>-complete.zip`, with `PROJECT_PROGRESS.md`/`SESSION_HANDOFF.md` updated first (§74) — this had been missed for the mid-session Unit-field fix. Corrected here; will be followed exactly from here on.

**Verification**: `esbuild` transform-check on every new/modified file; a full `esbuild --bundle` of `app/App.jsx` with all real deps external — 0 errors, same 2 pre-existing unrelated warnings as every prior session; `node --check` on both modified backend files; both locale JSON files parsed valid. No `node_modules`/network access in this sandbox this session (registry unreachable), so no live `npm install`/`vite build`/browser check — not claimed as done.

**Next task**: FET-11 (Investigations, Medical Reports & File Management). Backend (BET-12) is fully built; **frontend does not exist yet** — confirmed via directory search, only empty stub folders (`app/dashboard/reports`, `app/patient/reports`, `components/reports`) and no `services/investigationsService.js`/`reportsService.js`. Real, substantial next-session work, not a small gap.

## FET-09 — this session (2026-08-16): Appointment Calendar, Scheduling & Queue — full module built and ported into this project

The client asked to start with, and complete, FET-09. `server/src/modules/appointments/` and `server/src/modules/queue/` (BET-10) were confirmed fully built and correct before writing any frontend — nothing on the backend needed changing. The frontend module (`AppointmentsPage`, `QueuePage`, booking/detail/schedule dialogs, `scheduleService.js`/`queueService.js`, `appointmentsService.js` extended past its FET-06 read-only functions) was built and verified once, then diffed against and ported into this project specifically because the client flagged this upload as the actual source of truth — it turned out to carry real work beyond the copy it was first built in (a full `react-i18next` i18n pass across nav/auth/settings/dashboard, and a One UI dark-mode `dark:` token pass across shared UI primitives). Every file that differed between the two was read and diffed before touching it, not blindly overwritten — `navConfig.js`/`MobileBottomNav.jsx` were hand-re-applied against this project's `labelKey`/`t()` convention (plus a new `nav.queue` key added to both `en`/`bn` locale files) rather than pasting in hardcoded-English versions that would have regressed i18n.

**Built**: `lib/dateFormat.js`, `constants/appointments.js`, `services/scheduleService.js`, `services/queueService.js`, `components/appointments/{BookAppointmentDialog,AppointmentDetailDialog,DoctorScheduleDialog}.jsx`, `pages/{AppointmentsPage,QueuePage}.jsx`; extended `services/appointmentsService.js`; rebuilt `components/patients/AppointmentsTab.jsx` (FET-06) to share the same booking/detail dialogs instead of being read-only; wired real routes into `app/App.jsx`, `navConfig.js`, `MobileBottomNav.jsx`. Full detail and verification notes: `PROJECT_PROGRESS.md`'s new `FET-09` table row.

**Next task**: full i18n coverage for FET-09's new page/dialog body copy (only the nav-level labels are translated so far), or resume the normal FET/BET sequence — ask the client which.

## FET-08 — this session (2026-08-16): Consultation & Clinical Encounters — full workspace built, no backend changes needed

The client asked to start with, and complete, FET-08 directly. Before writing anything, `server/src/modules/encounters/` (BET-09) and the existing frontend (`services/encountersService.js`, `components/patients/ConsultationsTab.jsx`) were read end-to-end — the backend API (model/service/controller/validators/routes, mounted at `/api/v1/encounters`) was already fully built and correct from BET-09, and `ConsultationsTab.jsx` already carried an explicit doc comment flagging that write functionality was "a full consultation workflow (FET-08 in the roadmap) and is deliberately not built as part of this task." This session builds exactly that.

**Built:**
- `services/encountersService.js` — extended with `createEncounter`, `getEncounter`, `updateEncounter`, `finalizeEncounter`, `amendEncounter`, matching BET-09's routes 1:1.
- `components/clinical/EncounterClinicalFields.jsx` (new) — every clinical field the `Encounter` model accepts (chief complaint, examination findings, 8-field vitals grid, a dynamic diagnoses list edited as component state — `diagnoses` is embedded directly on the encounter document, not a separate sub-resource endpoint the way gynecology/pregnancy items are — clinical findings, assessment, treatment plan, instructions, follow-up), controlled and `disabled`-aware so it's reused unmodified across create, draft-edit, and the amend dialog.
- `components/clinical/AmendEncounterDialog.jsx` (new) — the amend workflow for a FINALIZED encounter: required reason + corrected fields, `POST /encounters/:id/amend`.
- `pages/clinical/ConsultationPage.jsx` (new) — the actual consultation workspace at `/dashboard/patients/:patientProfileId/consultations/:encounterId` (or `.../new`). Mirrors the backend's DRAFT→FINALIZED state machine exactly: editable + save-draft/finalize while DRAFT, fully read-only once FINALIZED with "Amend" as the only path to a correction — never tries to work around the backend's real 409 (`ENCOUNTER_FINALIZED`). Also shows a patient-history summary (allergies/chronic conditions, respecting `medicalHistoryRedacted`), a clickable "previous consultations" sidebar, and an honest "not available yet" empty state for related investigations/prescriptions/reports (their refs exist on the BET-09 model but nothing populates them until BET-11/BET-12 ship their own frontends).
- `components/patients/ConsultationsTab.jsx` — added a "New consultation" button and made every row navigate into the new workspace; added a `canWrite` prop.
- `pages/PatientWorkspacePage.jsx` — passes `canWrite` (the same `MEDICAL_RECORDS_WRITE_ROLES` check already gating the tab's visibility) through to `ConsultationsTab`.
- `app/App.jsx` — new route, gated on `MEDICAL_RECORDS_WRITE_ROLES` (confirmed by reading `security/permissions.js` directly: `MEDICAL_RECORDS_READ` and `MEDICAL_RECORDS_WRITE` resolve to the exact same role set — `SOFTWARE_OWNER`/`SUPER_ADMIN`/`DIRECTOR`/`ADMIN`/`DOCTOR` — so one constant correctly gates both).

**No backend changes** — BET-09's API needed nothing added or fixed.

**Deliberately not built**: no patient-facing consultation view. FET-08's roadmap bullets are all doctor/staff-facing consultation-authoring features; `MyClinicalRecordsPage.jsx` (patient self-view) wasn't touched — adding to it wasn't asked for and isn't in this task's scope (master prompt §98).

**Verification**: `esbuild --jsx=automatic` transform on all 7 new/modified files (zero syntax errors); a full `esbuild --bundle` from `app/App.jsx` through the entire real module graph, all real `client/web` dependencies marked `--external` — resolves and bundles clean at 525.8kb, the same 2 pre-existing unrelated `import.meta`/iife warnings noted in every prior FET session, 0 errors; a from-scratch Python export/import cross-reference across the whole 113-file `client/web/src` tree — 0 problems found; a paren/brace/bracket balance check on every touched file — all balanced. Same standing sandbox limitation as every other FET session: no `node_modules`/network access in this sandbox, so no live `npm install`/`npm run dev`/browser check or live HTTP round-trip against a running backend — not claimed as done. Full write-up: `PROJECT_PROGRESS.md`'s new `FET-08` table row.

**Next task**: FET-09 (Appointment Calendar, Scheduling & Queue), or resume the normal FET sequence — ask the client which.

## FET-16 — this session (2026-08-16): correction pass — merged into GynoCare, no duplicate CMS/backend created

A separate project (`namira-fet16-dynamic-website`) had some FET-16 work built in it by mistake. Per the client's explicit instructions, every file in both projects was read and compared before anything was changed — not assumed duplicate or assumed new from filenames alone.

**Confirmed first**: every backend CMS file that exists in both projects was byte-identical (FET-16 was branched from this exact snapshot) — so there was never a "which version is better" question for `Page`/`Service`/`HomepageStat`/`AboutContent`/`Media`, `cms.controller.js`/`cms.service.js`/`cms.routes.js`/`cms.validation.js`, or any shared frontend UI primitive/provider. None of that was touched.

**What was genuinely new and got merged in** (full detail in `PROJECT_PROGRESS.md`'s new `## FET-16` section): navbar management, certificates grid, hero/banner (image-or-video upload), and a homepage-section layout registry — new models + `dynamic-site.{controller,service,routes,validation}.js`, mounted at the same `/api/v1/cms` prefix on disjoint sub-paths; a `media-storage.service.js` extension (`resourceType` param, backward-compatible); 12 new `AUDIT_ACTIONS`; a full admin-dashboard "Website Management" page + 9 components + service wrapper (this project had **none** of that UI before — confirmed empty first); one new sidebar entry + route; and one new public-homepage section (`CertificatesSection.jsx`), **rewritten to match this project's actual current design tokens** rather than copying FET-16's own divergent hardcoded-color version verbatim.

**What was explicitly left alone because this project's version is already more current**: `Hero.jsx`/`Navbar.jsx`/`TopBar.jsx`/`Logo.jsx`/`layout.jsx`/`AboutSection.jsx` under `client/website/` all differ from FET-16's copies, but in every case this project's own independent restyle is further along — read both in full before concluding this, not just diffed.

**One real gap flagged, not silently fixed**: neither project's public `Navbar.jsx`/`Hero.jsx` actually fetches the new `/cms/navbar`/`/cms/hero-banner` endpoints yet — both still render static `constants/site.js` values. The backend + admin UI are real and wired; public-site consumption of that specific data isn't, in either project. Whoever picks up frontend work next should treat this as the next real FET-16-adjacent gap, not assume it's done because the backend/admin-UI pieces are.

**Verification**: `node --check` across all of `server/src` (zero errors); a Python export/import cross-reference on every touched backend file (zero real problems); a paren/brace/bracket balance check on every new/modified frontend file (all balanced); confirmed via `diff` that every shared dependency this pass relied on being identical actually was, before trusting either copy. Same standing sandbox limitation as every prior session: no `node_modules`/network access, so no live `npm install`/dev-server/browser check or live HTTP round-trip against the new routes — not claimed as done.

**The standalone `namira-fet16-dynamic-website` project should now be considered fully absorbed.** Nothing further should be built there going forward — continue FET-work directly in this project.

## FET-04/05 — previous session (2026-08-15): Super Admin / Owner Dashboard & RBAC UI — found built, one mobile gap closed

Continuing directly from the FET-06 session's own note ("Next task: FET-04/FET-05..."). Per the standing "verify, don't trust the log" rule, `components/dashboard/OwnerDashboard.jsx`, `pages/{RolesPermissionsPage,StaffDetailPage}.jsx`, and `services/{usersService,rolesService,permissionsService}.js` were read end-to-end before writing anything. **This file's own prior entry for this row was wrong** — last session logged FET-04 as "NOT STARTED" without opening `OwnerDashboard.jsx` first. It already existed (231 lines, in-code labeled "FET-05"), already wired into `DashboardPage.jsx`, and pulls every stat from real backend pagination totals — same documentation-lag pattern as FET-06's discovery, now caught and corrected here rather than left standing.

Real work this session: `RolesPermissionsPage.jsx`'s role table had the same missing-mobile-card-view problem the FET-06 session fixed on the patient/staff lists — closed with the same pattern. Full write-up: `PROJECT_PROGRESS.md`'s new `## FET-04/05 — What was found, and what this session added` section, including two genuine, still-open gaps flagged rather than built around: no admin screen for non-staff (`PATIENT`-role) accounts, and no real "Departments" entity on the backend to manage (only a free-text field on `StaffProfile`) — building a Departments screen would mean inventing a backend module, which the master prompt explicitly says not to do for convenience.

**Verification**: full read-through of every file; Python paren/brace balance check on the touched file. Same standing caveat as every FET session: no `node_modules`/network in this sandbox, so unverified beyond static review.

**Next task**: Appointments/Messages UI (both are still `to: null` placeholders in the sidebar and mobile nav — no frontend module exists for either), or a dedicated all-accounts admin list if the client wants patients manageable from the admin side too.

## FET-06 — previous session (2026-08-15): Patient Management, Profile & Unified Patient Workspace — found built, mobile UI pass added

Per the client's explicit master-prompt request to bring the frontend's mobile UI/UX in line with the master prompt before starting FET-06, `pages/`, `components/patients/`, and `services/patientsService.js` were read end-to-end before writing anything — same "verify, don't trust the log" rule as every backend session. **FET-06 turned out to already be fully built**: real patient list (search/filter/pagination against the live backend, no mock data), a tabbed patient workspace (overview/medical history/appointments/consultations), register/edit dialogs, and routes already mounted in `app/App.jsx` — including a redirect from FET-07's old temporary "paste a patient ID" deep link into the new workspace's Gynecology tab. None of this had ever been recorded in `PROJECT_PROGRESS.md`/this file — the same documentation-lag pattern the backend sessions hit repeatedly (BET-04/09/10/16/17), now confirmed on the frontend too.

**Real gap found and closed**: the app had no mobile bottom navigation (master prompt §8) and list-page tables just scrolled horizontally on mobile instead of becoming cards (master prompt §12/§30/§31). Built `components/layout/MobileBottomNav.jsx` (Home / Patients-or-My-records / Appointments / Messages / Profile, role-aware, `<lg` only) wired into `AppShell.jsx`, and added a `<lg` card-list view to both `PatientsListPage.jsx` and `StaffListPage.jsx` alongside their existing (now desktop-only) tables. Full write-up: `PROJECT_PROGRESS.md`'s new `## FET-06 — What was found, and what this session added` section.

**Verification**: every touched file read in full; a Python paren/brace balance check across all four touched files (all balanced). No `esbuild`/`vite build`/live browser check was possible — this sandbox has no `node_modules` and no network access to install any (a step further than prior FET sessions, which at least had `esbuild` reachable). **Owed before this is treated as field-verified**: a real `npm install && npm run dev` pass against a live backend, in a session where the registry is reachable.

**Next task**: FET-04/FET-05 (Owner/Admin dashboard + RBAC UI — `PROJECT_PROGRESS.md` FET-04 row), or build out Appointments/Messages (both are still `to: null` placeholders in the sidebar and the new mobile nav — no frontend module exists for either yet).

## BET-23 — previous session (2026-08-15): Backend Production Readiness — complete, checkpoints 23.1–23.8

Continued from an uploaded WIP snapshot (`namira-BET-23-checkpoint-23_6.zip`)
in which checkpoints 23.1–23.6 (Performance: query optimization/indexes/
API performance/pagination/caching/load; Reliability: logging/monitoring/
health/database health/error handling/graceful shutdown/recovery;
Security: environment validation/secrets validation/production security
configuration/security review; Deployment: production configuration/
deployment readiness/environment & infrastructure documentation) were
already implemented and verified in a prior session. Per the
continuation handoff's explicit instruction, none of that work was
redone — only checkpoints 23.7 (documentation completion) and 23.8
(operational runbook + final wrap-up) were this session's actual work.

**Checkpoint 23.7 — Documentation completion:**
- `docs/api/BET-23-API.md` (new) — cross-cutting API conventions
  (authentication, RBAC/permission requirements, error-response codes,
  pagination envelope, readiness/liveness semantics) plus full detail on
  the three BET-23 health/metrics endpoints. Deliberately does not
  re-document the ~150+ business endpoints already covered in
  `docs/BET-12-API.md` through `docs/BET-20-API.md` — cross-links them
  instead.
- `docs/architecture/BET-23-ARCHITECTURE.md` (new) — full request
  lifecycle/middleware chain, the 28-router module-to-mount-point table,
  auth/RBAC design, domain-module layering convention, cross-cutting
  infrastructure table, startup/shutdown sequence, external-provider
  abstractions. Explicitly documents which of the 50 `modules/*/`
  folders are empty scaffolding versus real (21 empty, 2 README-only
  redirects, 27 real) — verified by `find`, not assumed from folder
  names.
- `docs/database/BET-23-DATABASE.md` (new) — all 39 model files
  inventoried, real relationships traced from actual `ref:` fields (not
  inferred from naming), representative compound/unique indexes read
  directly from schema `.index()` calls, the production `npm run
  indexes` build process, data ownership/isolation/sensitive-record
  logging design, and how the retention-policy catalog and backup/
  restore's non-transactional-restore limitation connect back to this
  layer.

**Checkpoint 23.8 — Operational runbook + final wrap-up:**
- `docs/deployment/BET-23-OPERATIONAL-RUNBOOK.md` (new) — the 17-item
  operator runbook the master prompt's Documentation section calls for
  (pre-deploy checks through secret-rotation precautions), written as a
  concise navigation layer over `docs/reliability/RECOVERY_PROCEDURES.md`
  and `docs/backup/{DISASTER_RECOVERY,RESTORE_PROCEDURE}.md` rather than
  a re-authored duplicate of either.
- **Final documentation consistency audit**: reviewed `PROJECT_PROGRESS.md`,
  this file, and every BET-23 doc together; no contradictory statements
  found requiring correction (the BET-22→BET-23 handoff line in
  `PROJECT_PROGRESS.md`'s BET-22 row was already accurate and is left as
  historical context, not erased).
- **Final source verification, this session**: `node --check` on all 309
  `.js` files under `server/src` + `server/tests` — zero syntax errors.
  A from-scratch Python export/import cross-reference script, self-
  tested against a deliberately broken named import before being
  trusted (confirmed it correctly flags a nonexistent export), then run
  clean against the real 270-file `server/src` tree — zero problems.
  Every environment variable referenced in the new documentation
  (`SHUTDOWN_TIMEOUT_MS`, `DB_CONNECT_RETRY_ATTEMPTS`,
  `DB_CONNECT_RETRY_DELAY_MS`, `DB_HEALTH_PING_TIMEOUT_MS`,
  `REDIS_ENABLED`, `COOKIE_SECURE`, the four production secrets)
  confirmed present in `.env.example` by direct grep, not assumed.
  Every file path referenced across the three new checkpoint-23.7 docs
  and the runbook confirmed to exist on disk before being cited.
- **Live-verification caveat, stated plainly per the continuation
  handoff's explicit instruction not to hide it**: no live deployment
  dry-run was performed for BET-23.6 (containerization was explicitly
  out of scope and the operator is deploying their own Docker setup);
  BET-22's Jest suites remain statically verified, not live-run; Redis-
  enabled cache behavior was not live-exercised in the BET-23.2 caching
  pass. None of these are new gaps introduced this session — all three
  were already flagged in the prior BET-23 sessions' own documentation
  and are restated here, not newly discovered.
- `PROJECT_PROGRESS.md` — added the missing `BET-23` row to the task-log
  table (it had a stale "BET-23 (next roadmap item)" pointer in the
  BET-22 row but no BET-23 row of its own) plus a full narrative section
  mirroring the BET-16 through BET-22 format.

**BET-23 is now complete.** Per the master prompt, frontend work
(the `FET-*` series) may begin next — see `PROJECT_PROGRESS.md`'s BET-23
row for the "Next Task" pointer.

## BET-22 — this session (2026-08-15): Backend Automated Testing — all 11 client-defined checkpoints complete

All 11 numbered milestones from the client's checkpoint list are done: Unit (services/utilities/validators/auth/authz), Integration (database/auth/sessions/users/patients/clinical-records/appointments/queue/prescriptions/investigations/reports/billing/files), Security (auth attacks/authz bypass/session attacks/token attacks/sensitive-record access/file-access security/rate-limiting/input validation), and End-to-End (registration→login→refresh→rotation, logout→revocation, patient→consultation, appointment→queue→consultation, consultation→prescription, investigation→report, billing→payment→receipt, messaging, notifications, video consultation) — 19 new test files under `tests/{unit,integration,security,e2e}/`, all prefixed `bet22-`. Full per-checkpoint breakdown in `PROJECT_PROGRESS.md`'s `## BET-22` section — read that before touching this task again.

**This session's actual work** was checkpoint 11 (notifications + video consultation E2E, the last one) plus the final tree-wide wrap-up the client's own rules defer until after the last zip-only checkpoint:
- Wrote `tests/e2e/bet22-notifications-video-consultation.test.js` — read every real source file involved (`video-session.service.js`, its controller/routes/validators/access-service, `notification.service.js`/model/controller/validators, appointment booking/availability logic, `security/permissions.js`) before writing a single assertion, rather than guessing at shapes. Caught and fixed one genuine bug in a draft before zipping: two appointments for the same doctor computed via the same time-deterministic slot-picking helper would have collided (`SLOT_UNAVAILABLE`) — fixed with the same 30-minute-offset pattern checkpoint 9's file already used for an identical scenario.
- `node --check` across all 306 `.js` files under `server/src`+`server/tests` — zero syntax errors, every checkpoint.
- Wrote and ran a from-scratch Python export/import cross-reference script (`audit_exports.py`) — **self-tested against three deliberately-broken imports first** (a missing named export, a missing default export, a missing file) to confirm it actually catches real problems, *then* run clean against the whole tree (0 problems in 306 files). This addresses the exact failure mode two prior sessions' own audit scripts hit (regex gaps that either produced false positives or, worse, could have silently passed real bugs) by validating the tool before trusting its output.
- Confirmed via `app.js` that both routers checkpoint 11 touches (`/api/v1/notifications`, `/api/v1/video-calls`) are genuinely mounted.

**Known issue — the standing gap this whole task has, now made precise:** `npm install` was attempted this session. Registry metadata resolution worked (a `--dry-run` completed cleanly), but the real install failed partway through on one dependency's tarball CDN host being outside the network allow-list (`registry.npmjs.org/zod/-/zod-3.25.76.tgz` → `403 host_not_allowed`, reproduced 3× via direct `curl`). **No checkpoint's Jest suite — not this session's, not any of the prior 10 checkpoints' — has ever actually been run against a live `mongodb-memory-server` in this project.** Every one of the 19 `bet22-*` files has been verified by hand (real source reads + `node --check` + the self-tested export/import audit) but never executed. A session with an environment where every npm dependency's tarball host is reachable should run `npm install && npx jest tests/unit tests/integration tests/security tests/e2e` in full before BET-22 is treated as done rather than written. If real failures surface then, fix forward in the affected test file(s) or the source it caught a genuine bug in — don't just adjust the assertion to match broken behavior.

**Next task: BET-23** (or whatever the master prompt's roadmap names next) — but consider running the live-Jest pass above first if the environment allows it, since it would be the single highest-value verification step available for this entire task.

## BET-21 — previous session (2026-08-15): API Security Hardening — full review, no code defects found

A security review, not a build: every checkpoint bullet (authentication, authorization/RBAC, token/refresh-token/session security, rate limiting, request validation, input sanitization, security headers, CORS, file-upload/file-access security, sensitive-data protection, API abuse protection, secrets management, webhook security, error-message security, logging/security monitoring, dependency security, production configuration security) was checked against the actual source — not assumed from earlier BETs' notes — and every one was already correctly implemented, primarily from BET-02/BET-03/BET-04. **No code was changed this session.** Full write-up: `docs/security/BET-21-SECURITY-REVIEW.md`.

Reviewed in the 8 checkpoint groups the client specified, with a ZIP snapshot after each group (per the client's explicit ZIP-checkpoint protocol) — all 8 snapshots are identical since nothing changed during the review. Real verification performed this session, not just static reading: `node --check` across the whole tree (zero errors); `npm install` succeeded (677 packages, registry reachable this session) followed by a real `npm audit` — **0 vulnerabilities at any severity**; a live `import('./src/app.js')` boot with zero runtime errors across the entire route graph; `npx jest tests/unit` — 131/133 passing, same 2 pre-existing unrelated `bet12-*` failures as every session since BET-15.

Noteworthy findings, none requiring a fix: refresh-token rotation with reuse detection revokes the *entire* session family on replay (not just the one token) — already correctly implemented in `auth/auth.service.js`; file uploads are validated by magic-byte signature, not just client-supplied MIME type (`security/file-security.js`); CSP is deliberately left disabled in Helmet with a documented rationale (JSON-only API, no HTML content to police) rather than an oversight; the production-boot guard in `config/env.js` actually calls `process.exit(1)` if required secrets are missing or `COOKIE_SECURE` isn't `true` — a real fail-closed check, not just a documented expectation.

**Next task: BET-22.** Consult the master prompt's roadmap for its exact scope before assuming anything about the relevant module's state — the standing lesson from every prior BET alike.

## BET-19 — previous session (2026-08-15): FHIR, Import & Export — mostly already built, two real gaps closed

Same mixed pattern as BET-16/17: most of BET-19 was already fully built and mounted before this session (`modules/fhir/`'s 7 mapping bullets; `modules/exports/`'s CSV/Excel/PDF/JSON tabular export, medical-record export, and controlled-export token flow; `modules/imports/`'s CSV/Excel patient import) — verified by reading every file end-to-end, not assumed. But two checkpoint bullets were genuinely missing, not just undocumented: **"Export authorization"** (no dedicated bulk-export/bulk-import permission existed — every route only checked its entity's ordinary native permission) and **"Export audit logging"** (the audit service's `recordExport()` helper existed and was already used elsewhere in the project, but nothing in `modules/exports/` or `modules/imports/` ever called it — every export/import action was completely unlogged). Built: two new permissions (`DATA_EXPORT`/`DATA_IMPORT` in `security/permissions.js`, layered on top of each route's existing entity permission, with deliberately asymmetric role grants — see `PROJECT_PROGRESS.md`'s `## BET-19` section for the full table) and 7 new `AUDIT_ACTIONS` wired into all four export/import controllers, including the one unauthenticated route (`downloadControlledExportController`) using `recordAuditEvent` directly since it has no `req.user` to attribute the event to. `docs/BET-19-API.md` written fresh. Full write-up in `PROJECT_PROGRESS.md`'s `## BET-19 — What was found vs. what was built` section — read that before starting BET-20.

**Verification this session**: `node --check` across the whole `server/src` tree (zero syntax errors); a from-scratch Python export/import cross-reference across the whole tree (zero real problems); a standalone `node -e` load of the modified `security/permissions.js` exercising every new role/permission combination via `hasPermission()` — all matched the intended design. Could not run `npm install` or boot a live server this session (network egress fully blocked again, unlike BET-18's session where the npm registry was briefly reachable) — so none of this has been exercised against a live MongoDB instance or an actual HTTP request yet. That live pass is still owed, on top of the standing BET-05-onward live-verification note.

**Next task: BET-20.** Check the master prompt's roadmap for its exact scope before assuming anything about `modules/`'s current state — the standing lesson from BET-16/17/18/19 alike: read every file before deciding whether it's empty, already built, or (as with BET-19) built except for one or two specific bullets.

## BET-18 — previous session (2026-08-15): Backup, Recovery & Data Protection — built fresh, not a documentation-lag case

Unlike BET-16/BET-17, `modules/backups/` was confirmed genuinely empty before writing anything (`find modules/backups -type f` returned nothing but empty scaffolding directories). Built: a dependency-free ZIP writer (`utils/zip-writer.util.js`, round-trip tested against the project's existing dependency-free ZIP reader from BET-12); database backup as a full JSON logical dump of every registered Mongoose model (no `mongodump` binary available in this sandbox — documented trade-off, not a shortcut); AES-256-GCM backup encryption reusing `DATA_ENCRYPTION_KEY`; a dependency-free Google Drive upload (`https`-based OAuth2 + Drive v3 multipart, no `googleapis` dependency); backup retention with a "never purge the last remaining backup" safety floor; automatic post-backup verification; and both restore testing (into a disposable scratch database, never production) and the real restore-to-production operation (gated with the same password+confirm+reason contract BET-17's `data-lifecycle` purge established). Full write-up in `PROJECT_PROGRESS.md`'s `## BET-18 — What was built` section — read that before starting BET-19.

**Verification this session went further than static checks**: `npm install` was actually run and succeeded (677 packages — the npm registry was reachable this time; this is distinct from the MongoDB Atlas connectivity gap noted in earlier sessions, and this session did not conflate the two). With dependencies installed, a live `import app from './src/app.js'` loaded the entire route graph — including the new `/api/v1/backups` router — with zero runtime errors, and a genuine functional smoke test exercised the zip-writer → AES-GCM-encrypt → decrypt → re-parse pipeline end-to-end, including a deliberate single-byte tamper test that GCM's auth tag correctly rejected. What was **not** tested live: an actual backup/restore against a real MongoDB instance — no `mongod` binary and no reachable Atlas cluster exist in this sandbox. That gap is stated plainly in `PROJECT_PROGRESS.md` rather than implied as covered.

**Next task: BET-19.** Check the master prompt's roadmap for its exact scope before assuming anything about `modules/`'s current state — per this session's own lesson, empty-looking directories have sometimes turned out to be fully built (BET-16/BET-17) and sometimes turned out to be genuinely empty (BET-18 here). Don't assume either way; open the files first.

## BET-16 & BET-17 — previous session (2026-08-15): verification pass, both marked COMPLETED

Per the standing "trust nothing found in `modules/*` without opening and reading it first" lesson, this session opened every file in `modules/cms/`, `modules/integrations/`, `modules/users/services/account-deletion.service.js` + its model/controller/validator, and all of `modules/data-lifecycle/` before touching `PROJECT_PROGRESS.md`. Finding: **all of BET-16 (pages/media/publish-workflow/SEO + the full external-integrations architecture) and all of BET-17 checkpoints 3–4 (account-deletion workflow + retention/purge) were already fully built and already mounted in `app.js`** — the prior session's notes ("BET-16 partial", "BET-17 checkpoint 2 of 4, checkpoints 3–4 not started") had gone stale, the same documentation-lag pattern first seen at BET-04/BET-09/BET-10/BET-15. No code defects were found and no code was changed. This session's actual work was the verification itself — `node --check` across the whole `server/src` tree (zero syntax errors) and a from-scratch Python export/import cross-reference across the whole tree (zero orphaned references, after fixing a relative-path bug in the audit script itself that had produced 623 false positives on its first run) — plus writing `docs/BET-16-API.md` and `docs/BET-17-API.md`, and correcting both this file and `PROJECT_PROGRESS.md`. Full narrative for each is in `PROJECT_PROGRESS.md`'s `## BET-16 — What was verified/completed` and `## BET-17 — Checkpoints 3 & 4 — What was verified/completed` sections — read those before starting BET-18.

**Next task: BET-18 — Backup, Recovery & Data Protection.** Nothing in this project currently schedules anything (no `node-cron` or equivalent dependency) — both `modules/data-lifecycle`'s purge and any future backup job need that infrastructure, so introducing a scheduler is likely BET-18's first real gap to check for, the same "read every file before assuming empty vs. built" approach used this session. `modules/backups/` is confirmed still empty (see `find` output this session) — genuinely unstarted, not another documentation-lag case.


## BET-17 — Audit Logs, Account Lifecycle & Retention (this session, Checkpoint 2 of 4)

**Stopped exactly at the hard ZIP checkpoint the master prompt defines for "record modification / record deletion / data exports / file access"** — do not resume by implementing account deactivation, account deletion workflow, soft/permanent deletion, retention policies, or data-ownership/lifecycle rules (that's checkpoints 3–4) without explicit permission, per the one-task-at-a-time rule (§72).

Before writing anything, grepped every controller for existing audit-service usage rather than trusting checkpoint 1's note at face value. Finding: **most of checkpoint 2 was already built, undocumented**, in an earlier pass — `recordModification`/`recordDeletion`/`recordExport`/`recordFileAccess` (all four already existed in `audit/audit.service.js`) were already wired into patients, encounters, prescriptions, investigations, appointments, billing (invoices + fees), payments, messaging, staff, roles, and users. Five real gaps were found and closed this session: `modules/medicines`, `modules/appointments/schedule.controller.js` (doctor schedules + blocked dates — distinct from `appointment.controller.js`, which was already wired), and all three CMS controllers (`page.controller.js`, `cms.controller.js`, `media.controller.js`). Security-event logging remains intentionally owned by BET-03's `SecurityEvent` (not duplicated); gynecology/obstetrics/reports modification+deletion remain intentionally owned by their own dedicated access logs (BET-07/BET-12) — re-verified by grep this session rather than assumed. Full breakdown, including exactly which action constants were added, is in `PROJECT_PROGRESS.md`'s dedicated `## BET-17 — ... (Checkpoint 2 ...)` section — read that before continuing this task.

**Not run this session** (standing sandbox limitation, same as every prior BET): `npm install` still returns `403` from the registry (no change from checkpoint 1). Verified statically only (`node --check` across the whole tree, a Python import/constant-resolution check on the five modified files, and a route-mounting grep confirming none of the newly-audited controllers sit behind an unmounted route). Re-check network-egress status at the start of the next session rather than assuming it's still blocked.

## BET-14 — Video Consultation ✅

`modules/video-calls/` was found with its **model and access-control layers already built** from an earlier session (`models/video-session.model.js` — full state machine, immutable history, hashed single-use join credentials, consent subdocument; `models/video-session-audit-log.model.js`; `services/video-access.service.js`; `services/providers/{video-provider.interface.js,native-webrtc.provider.js}` — a real provider abstraction, P2P WebRTC over the existing Socket.IO connection) — but `controllers/`, `routes/`, `validators/`, `repositories/`, `schemas/`, `types/` were all genuinely empty, and nothing was mounted in `app.js`. Built the entire missing HTTP/controller/route/validator layer plus Socket.IO `video:join`/`video:signal`/`video:leave` signaling. Full writeup, including a real crash bug found and fixed (`env.video` was referenced by `native-webrtc.provider.js` but never actually exported from `config/env.js`), is in `PROJECT_PROGRESS.md`'s dedicated `## BET-14` section — read that before touching this module further.

**Also this session (housekeeping while editing `PROJECT_PROGRESS.md`'s task table for BET-14): corrected a stale `BET-15` table row that still said `PARTIAL`, contradicting that same file's own dedicated `## BET-15` sections (both of which already say `COMPLETED`) and this document's own header/BET-15 section above.** No BET-15 code was touched — documentation-only correction, caught incidentally.

**A note for whoever picks up BET-16 or any future task**: `npm install` succeeded again this session (same as the BET-15 session) — 677 packages, a real `app.js` module-graph boot, a real `supertest` round-trip against the new routes, and a real `npx jest` run (124 tests, 122 passing — same 2 pre-existing, unrelated `bet12-*` failures as every session since BET-15; not touched, per the one-task-at-a-time rule). MongoDB Atlas itself is still unreachable (network allowlist) — re-check both at the start of the next session rather than assuming either state still holds.

## BET-15 — Billing & Payment Architecture ✅

Picked up from a prior session's "partial" state (models/services complete, routes missing/unmounted — see the old note preserved further down for historical context). Audited every file in `modules/billing/` and `modules/payments/` line-by-line before trusting anything, per this project's standing "trust nothing without opening it" rule. Finding: **the code itself was already essentially complete and high quality** — fees, invoices, invoice items, discounts, balances, payment status, billing history, a real provider abstraction (`manual` vs. a configurable online `gateway`), signature-verified webhooks, refunds, and receipts (PDF) were all already implemented, and `billing.routes.js`/`payment.routes.js` were already mounted in `app.js`. `SESSION_HANDOFF.md` simply hadn't been updated to say so — the same doc/reality drift this project has hit repeatedly (BET-04, BET-09, BET-10).

**The actual news this session: npm-registry access worked for the first time in this project's history.** Every prior session (see "Known Issues" further down, preserved for the record) had `npm install` return 403 with zero network egress. This session it succeeded — 677 packages installed cleanly — which made real verification possible for the first time instead of `node --check` (syntax-only) and hand-traced static analysis:
- Ran the real Jest suite (`NODE_OPTIONS=--experimental-vm-modules npx jest tests/unit`) — the two existing BET-15 unit test files (`bet15-invoice-service.test.js`, `bet15-payment-service.test.js`, 32 assertions, pure-function/DB-free) passed for real, not just by inspection.
- Hand-verified `computeTotals`, `deriveStatusFromBalance`, and `assertCanAccessAsSelf` directly via `node --input-type=module`.
- **Booted the real server** (`node src/server.js`) for the first time in this project's history. It got all the way through building the entire Express app (every route file, every middleware) and only failed at the actual MongoDB Atlas network dial — expected, since this sandbox's network allowlist still doesn't include MongoDB Atlas (see updated Known Issues).
- Smoke-tested every new BET-15 route against a live (DB-less) Express instance via `supertest` — confirmed `GET /billing/fees`, `GET /billing/invoices`, `GET /billing/invoices/me`, `POST /billing/invoices`, `GET /payments`, `GET /payments/me`, `POST /payments/initiate`, `POST /payments/manual` all return `401` (auth-gated and reachable), not `404` (unmounted) — and that `POST /payments/webhook` is reachable without authentication and fails closed with `INVALID_WEBHOOK_SIGNATURE` when no valid signature header is sent. Formalized this as a permanent regression test, `tests/unit/bet15-app-boot.test.js` (see below for why it deliberately builds a minimal Express app rather than importing the full `app.js`).

### A real, previously-undiscoverable, server-boot-fatal bug — found and fixed
`node src/server.js` initially crashed immediately on import, before ever reaching the Mongo connection attempt:
```
Error: ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'
    at ... node_modules/pdf-parse/index.js:15
```
Root cause: `pdf-parse@1.x`'s package-root `index.js` gates a debug/self-test block on `isDebugMode = !module.parent`. Under a normal CommonJS `require()`, `module.parent` is set and this is `false`. Under Node's ESM→CJS interop (this project imports it as `import pdfParse from 'pdf-parse'` in `modules/reports/services/report.service.js`, BET-12), `module.parent` is never populated the same way, so `isDebugMode` evaluates `true` — the package then eagerly `readFileSync`s a fixture PDF that only exists inside its own test suite and throws `ENOENT` at import time, unconditionally, for every consumer. Because `report.service.js` is imported by `report.routes.js`, which `app.js` imports at the top level, this was **fatal to the entire server's boot**, not just to PDF text extraction — every route, not just BET-12's, was unreachable. This is not a BET-15 bug (it predates this session, from BET-12), but it blocked verifying BET-15 (or anything) end-to-end, and no prior session could have caught it without npm-registry access. Fixed with a one-line change:
```js
// modules/reports/services/report.service.js
import pdfParse from 'pdf-parse/lib/pdf-parse.js'; // was: import pdfParse from 'pdf-parse';
```
This imports the actual parser the package root just re-exports, skipping the buggy debug-mode block entirely — verified behavior-identical, confirmed via `node --input-type=module` and a full server boot afterward (see above).

### Also this session
- Deleted a stray, uncommitted-looking `tests/unit/_temp-boot.test.js` left over from earlier exploration — it wasn't referenced by any BET's documented deliverables and was failing for an unrelated reason (a `pdf-parse` package quirk needing a fixture file at `./test/data/...` relative to `cwd`, not a real bug in this project's code). Its actual intent (assert `app.js` boots and BET-15 routes are reachable) is now covered properly by the new `tests/unit/bet15-app-boot.test.js`.
- Added `tests/unit/bet15-app-boot.test.js` — deliberately builds a minimal Express app containing *only* `billingRoutes`/`paymentRoutes` plus the real error middleware, rather than importing the full `app.js`, so its dependency/failure surface is exactly BET-15's own code and not entangled with unrelated modules elsewhere in the tree (like the `pdf-parse` bug above). Confirms every BET-15 route is mounted and auth-gated.
- Attempted to add `mongodb-memory-server` (the recommended next step from every prior BET-12 session note, now that `npm install` finally works) to enable real integration/e2e tests against a live-but-ephemeral MongoDB. **Still blocked**: `npm install` for the package itself succeeds, but its own postinstall step tries to download a MongoDB server binary from `fastdl.mongodb.org`, which returned `403` — that host isn't on this sandbox's network allowlist (only `pypi.org`, `registry.npmjs.org`, `github.com`, etc. are). Reverted the dependency addition (not left in `package.json`). Integration/e2e-tier tests against a live Mongo still require a session with broader network access than this one has.

### Verification performed this session
- `node --check` across every `.js` file under `server/src/` — zero syntax errors (same as every prior session, now additionally confirmed by a real boot, not just parse-checking).
- Full real `npm install` (677 packages) — first time in this project's history.
- Full real `npx jest tests/unit` run — 105 tests, 103 passing (2 pre-existing failures, both in `bet12-*` files, both dated and unrelated to BET-15 — see below).
- Real server boot via `node src/server.js`, reaching the MongoDB connection attempt (which fails only on network reachability, an environment constraint, not a code defect).
- Real `supertest` HTTP round-trips against every new BET-15 route, DB-free.

### Newly visible, out-of-scope findings (not fixed this session — flagged for whoever picks up BET-12 follow-up or general hardening)
Now that the real test suite can finally run, two **pre-existing** BET-12 test failures are visible for the first time (previously masked by the sandbox's total lack of npm access):
1. `tests/unit/bet12-report-access.test.js` — `assertCanAccessAsSelf` returns `null` (not strictly `false`) for a report with no owner recorded on it. Falsy either way for the `if (!assertCanAccessAsSelf(...))` call sites that actually gate access, so this is not believed to be an access-control hole — but the test's strict `toBe(false)` assertion doesn't match the real return value, and that mismatch itself needs a decision (fix the function to normalize to `false`, or loosen the test) by whoever next works in `modules/reports`.
2. `tests/unit/bet12-extraction-parser.test.js` — `parseLabStyleText` normalizes an OCR'd reference range `"12.0-15.5"` to `"12-15.5"` (dropping a trailing `.0`), but the test expects the untouched `"12.0-15.5"`. Cosmetic (this field is `LOW`-confidence, machine-extracted, and gated behind mandatory doctor review before finalization per BET-12's design), not a clinical-safety issue like the earlier BET-12 abnormal-flag bug — but still worth a real fix/decision.

Left untouched (per the master prompt's one-task-at-a-time rule — this pass stayed inside BET-15, matching every prior session's discipline around BET-12/BET-13 follow-ups). Also newly visible: harmless Mongoose "duplicate schema index" warnings on `patientId` (`modules/patients`), `patient`/`investigation` (`modules/reports`), and `originalDocument.fileHash` (`modules/reports`) — cosmetic log noise from a field declaring both `index: true` inline and a separate `schema.index()` call for the same path; doesn't affect correctness, not fixed this session (out of scope, pre-existing, several BETs old).

### Also this session (gap-closure follow-up, same day)
Closed the three remaining loose ends flagged at the end of the first BET-15 pass:
1. **Added `docs/BET-15-API.md`** — a dedicated billing/payments API reference, matching the format `docs/BET-12-API.md` already established (endpoint tables, status lifecycles, provider-abstraction contract, webhook idempotency/transaction-safety notes, refund/failure-handling behavior, security model). BET-15 was the only completed backend BET without one.
2. **Documented `modules/invoices/`** — added `modules/invoices/README.md` explaining why the folder is intentionally empty (`Invoice` lives inside `modules/billing/`, not its own module — a deliberate design choice, not a missed task) so a future session doesn't waste time re-investigating it or, worse, accidentally start a duplicate `Invoice` implementation there.
3. Re-ran the full verification pass after both additions (`node --check` across the entire tree, full `npx jest tests/unit` — same 105/103 result as before, nothing regressed, nothing newly broken — and a full server boot, reaching the same MongoDB Atlas network boundary as before). Confirms the two doc-only additions above didn't touch or risk any runtime code path.

Items 3–4 from the original "what's left" list (a live integration/e2e test against a real MongoDB, and an actual live gateway round-trip) remain environment/account limitations, not missing code — see the `mongodb-memory-server` note above and the blank `PAYMENT_*` `.env` values (no real gateway account exists yet to test against). BET-15 is now considered fully complete.

---

## Current Architecture
- **Backend**: Node.js (ESM, `"type": "module"`) + Express 4 + Mongoose 8 (MongoDB Atlas), Redis (optional, `REDIS_ENABLED=false` currently), Socket.IO (installed, not yet wired), JWT auth (access + refresh, rotation + reuse detection), Argon2 password hashing, Joi validation, Helmet, CORS (dedicated module), express-rate-limit, express-mongo-sanitize + hpp, pino structured logging (secret-redacting), Cloudinary SDK configured (upload/delivery logic itself is still BET-12).
- **Structure**: `server/src/` has two coexisting patterns:
  - Flat top-level domains that are implemented: `auth/`, `users/` (just the `User` model — see below), `security/`, `middlewares/`, `database/`, `config/`, `health/`, `integrations/email/`. (`audit/`, `backup/` remain empty — reserved for BET-17/BET-18.)
  - A `modules/<domain>/{controllers,models,repositories,routes,schemas,services,types,validators}/` scaffold for every planned domain. As of the BET-10 session, **`modules/roles/`, `modules/permissions/`, `modules/staff/`, `modules/users/`, `modules/patients/`, `modules/gynecology/`, `modules/obstetrics/`, `modules/cms/` (partial), `modules/encounters/`, `modules/appointments/`, and `modules/queue/` all have real, working, routed content** (BET-04 through BET-10) — this bullet was never updated in later sessions, so it undercounts: `modules/medicines/`, `modules/prescriptions/` (BET-11), `modules/investigations/`, `modules/reports/` (BET-12), `modules/messaging/`, `modules/notifications/` (BET-13), `modules/video-calls/` (BET-14, this session), and `modules/billing/`, `modules/payments/` (BET-15) are now also real and mounted. `modules/auth/` remains dead scaffolding on purpose (see the naming-trap note below); `modules/invoices/`, `modules/consultations/`, `audit/`, `backup/` remain genuinely empty, reserved for BET-16+/BET-17/BET-18.
  - **Important naming trap for the next session**: `modules/auth/` and `modules/users/` both exist. `modules/auth/` is still dead scaffolding — the real, working auth code intentionally lives in the flat `auth/` directory; do not duplicate into it. `modules/users/`, by contrast, is **not** dead scaffolding anymore — it now holds the real BET-05 admin user-management code (list/create/update/role/status). The flat `users/` directory still only holds `user.model.js` (the Mongoose schema itself, from BET-03) — that has not moved and should not move. In short: `users/user.model.js` = the schema; `modules/users/` = the admin CRUD layer on top of it. Both are real; neither is a duplicate of the other.
- **Frontend**: `client/web` is **not empty** — it already has a working Vite + React + Tailwind + shadcn/ui + MUI auth flow from earlier in this WIP session (audited this session, found correct — see the Frontend note below). No dashboard content beyond auth + a real `DoctorDashboard` exists yet; broader frontend build-out is still expected to wait until the backend roadmap (BET-08 onward) is further along, per the master prompt, unless the user explicitly asks to jump ahead again.
- **Two protected accounts** (Owner: Fahim Khan, Director: Namira Tanha): protected at the Mongoose layer (`isProtected: true`, enforced by pre-hooks on `users/user.model.js`). `database/seed.js` sets/backfills this flag. As of BET-05, the new admin user-management endpoints (`modules/users/`) also check `isProtected` explicitly before mutating, returning a clean `403 PROTECTED_ACCOUNT` rather than relying solely on the Mongoose hook.

## Completed Work
### BET-04 — RBAC, Permissions & Authorization ✅ (found already implemented; verified/documented this session)
This code was present in the uploaded WIP project already, but `PROJECT_PROGRESS.md`/`SESSION_HANDOFF.md` had not been updated to say so (they still read "BET-04 NOT STARTED"). This session verified it (`node --check` on every file, confirmed route mounting, read every exported function) and corrected the docs — no code changes were needed. See `PROJECT_PROGRESS.md` for the full breakdown. Summary: fixed-enum RBAC (`security/permissions.js`) is the enforcement source of truth; `modules/roles/` adds a DB-backed custom-role layer on top (system roles mirrored in, read-only); `modules/permissions/` exposes a read-only permission catalog + role matrix; `middlewares/auth.middleware.js` has `authenticate`/`authorize`/`authorizeAny`/`authorizeAll` plus three building blocks BET-04 built specifically for BET-05 to consume: `authorizeSelfOrPermission`, `authorizeManagesRole`, `blockProtectedRoleTarget`.

### BET-05 — User, Staff & Organization Management ✅
See `PROJECT_PROGRESS.md` for the full breakdown. Summary: this session found `modules/staff/` (staff profiles, employment status, doctor-designation modeling) already complete from earlier in the same WIP session, but two things were missing and have now been built:
1. **`modules/users/` was empty** — there was no way for an administrator to list users, provision a staff/doctor/admin account, change someone's role, or activate/deactivate an account. Built out `services/user.service.js`, `controllers/user.controller.js`, `validators/user.validation.js`, `routes/user.routes.js`, mounted at `/api/v1/users`.
2. **Doctor listing endpoints existed in the service layer but were never wired up** — `listDoctors`/`getDoctorById` in `staff.service.js` had no controller/route. Added `GET /staff/doctors` and `GET /staff/doctors/:id`.

Also added two new transactional email templates (`sendWelcomeSetPasswordEmail`, `sendAccountStatusChangedEmail`) to `integrations/email/email.service.js`.

## Current Task
**BET-21 — API Security Hardening — COMPLETED as of this session (2026-08-15), as a review pass.** See the `## BET-21` section near the top of this file for the writeup, and `docs/security/BET-21-SECURITY-REVIEW.md` for the full checkpoint-by-checkpoint detail.

BET-01 through BET-21 are all COMPLETED.

## Next Task
**BET-22.** Consult the master prompt's roadmap for its exact scope. Open every file in the relevant `modules/` directory before assuming it's empty or already built — this project has had both outcomes happen repeatedly (BET-16/BET-17/BET-19/BET-20/BET-21 were undocumented-but-complete or complete-on-review; BET-18 was genuinely empty) so neither assumption is safe without checking first.

### BET-07 — Gynecology & Sensitive Clinical Records ✅ (built fresh this session)
`modules/gynecology/` was confirmed genuinely empty (`find`/`ls` showed every subdirectory present but zero files) before writing anything — unlike BET-06, there was no pre-existing draft code to audit here. Built:
- `GynecologyRecord` model covering every roadmap bullet (menstrual history, summary-level reproductive history, gynecological conditions, contraception, fertility/infertility, STI/STD history, cervical screenings, breast records, procedures) — deliberately excludes LMP/EDD/gestational age/antenatal/delivery/postpartum data, which is BET-08 scope.
- **Provider-based access** (`sensitive-record-access.service.js`): a `DOCTOR` holding `SENSITIVE_RECORDS_READ`/`WRITE` is not automatically entitled to a given patient's record — they must also be that patient's assigned `primaryCareProvider` (`PatientProfile.primaryCareProvider`, BET-06). `SOFTWARE_OWNER`/`SUPER_ADMIN`/`DIRECTOR` are exempt (already unconditional in the RBAC map). A `PATIENT` can always read (never write) their own record via `GET /gynecology/me`.
- **Mandatory access logging** (`SensitiveRecordAccessLog` model, new dedicated collection `sensitive_record_access_logs`) — every read/write attempt, allowed *or denied*, is logged with actor, role, target patient, action, specific resource, outcome, and denial reason. This is a single choke point (`enforceSensitiveRecordAccess`) that every service function goes through — access tracking can't be silently skipped by a future code path. Mirrors the fail-safe pattern of BET-03's `recordSecurityEvent` (a logging failure never blocks the actual request).
- Full CRUD + 6 array sub-resources (conditions, contraception, STI history, cervical screenings, breast records, procedures) — 22 routes total under `/api/v1/gynecology`, mounted in `app.js`.
- Verification: `node --check` on every new file, plus a full sweep of every `.js` file under `server/src` (zero syntax failures anywhere, confirming nothing else broke); a Python-scripted diff of exported vs. imported identifiers across controller↔routes, controller↔service, routes↔validators (all matched exactly). Same network limitation as before — could not `npm install` or boot a live server this session.
See `PROJECT_PROGRESS.md` for the complete breakdown.

## Frontend note (this session — investigated, nothing built)
Mid-session the user asked to jump ahead to a shadcn owner/doctor dashboard (deliberately deviating from the "backend roadmap first" rule, confirmed explicitly by the user), then redirected back to "continue with BET-7" before any dashboard file was written. What was learned before the redirect, for whoever picks up frontend work next:

- **`client/web` is not empty scaffolding.** It already has a real, working implementation: Vite + React 18 + Tailwind + shadcn/ui primitives (`button.jsx`/`card.jsx`/`alert.jsx`, built on `class-variance-authority`/`clsx`/`tailwind-merge` — genuine shadcn conventions, not approximations) + MUI (installed, minimally used so far — a `muiAuthTheme.js` exists) + `react-router-dom` + `react-hook-form`/`zod` + `axios`.
- Complete, correct auth flow: `apiClient.js` (axios instance, JWT bearer interceptor, automatic refresh-token rotation with a request queue so concurrent 401s don't trigger duplicate refresh calls, session-expired callback wiring), `authService.js` (thin wrappers matching every real `auth/auth.routes.js` endpoint field-for-field), `AuthProvider.jsx` (context, bootstraps via `GET /auth/me` rather than trusting a stored token blindly), `ProtectedRoute.jsx`/`GuestRoute.jsx` (role-aware, correctly labeled as UX-only — backend remains the real boundary), full page set (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`, `UnauthorizedPage`, `NotFoundPage`), `App.jsx`/`main.jsx` routing. All of this was read end-to-end and found correct — no bugs like BET-06's `modules/patients/` had.
- `DashboardPage.jsx` is role-aware: a `DOCTOR` gets a real `DoctorDashboard.jsx` (pulls live data from `GET /staff/me`, shows specialization/registration/experience/department/employee ID/designation/qualifications/bio, and — importantly — honestly labels the "today's appointments" section as not-yet-available rather than fabricating numbers, since `modules/appointments/` doesn't exist yet). Every other role currently falls through to a generic "Authentication is wired up, the rest belongs to later tasks" placeholder card.
- **What's missing and was the actual ask**: an `OwnerDashboard.jsx` (or similar) for `SOFTWARE_OWNER`/`SUPER_ADMIN`/`DIRECTOR`/`ADMIN` — the admin-tier equivalent of `DoctorDashboard.jsx`, following the exact same pattern (real data only, from endpoints that already exist and already work: `GET /users`, `GET /patients`, `GET /staff/doctors`, `GET /roles`, `GET /permissions` — pull real counts/summaries, never fabricate). No service wrapper exists yet for `/users` or `/patients` on the frontend (only `authService.js` and `staffService.js` exist under `client/web/src/services/`) — those would need to be added, mirroring `staffService.js`'s thin-wrapper style, before an `OwnerDashboard` could be built.
- `client/mobile` was not inspected this session — check it the same way before assuming anything about its state.
- **This entire investigation is informational only — nothing under `client/` was created or modified this session.** The next session (frontend or backend) should re-confirm this is still accurate before building on it, the same "read before trusting" discipline applied to every `modules/*` folder.


### BET-06 — Patient & Medical History ✅ (found pre-existing but broken; fixed and verified this session)
`modules/patients/` already had a full model/service/controller/routes/validator implementation from earlier in this WIP session, but `PROJECT_PROGRESS.md` still listed BET-06 as "NOT STARTED" / empty scaffolding — it was neither. Auditing it (the same "verify, don't trust" approach BET-04 used) turned up real bugs:
1. `patient.service.js` imported `AppError` from a file that doesn't exist (`utils/AppError.js`) — would have thrown on first import. Fixed to import from `middlewares/error.middleware.js`, and fixed all 34 call sites using the wrong constructor argument shape (3rd arg must be an `{ code }` options object, not a bare string).
2. `patient.controller.js` imported a nonexistent `apiResponse` helper — rewritten to use the project's real `sendSuccess`/`sendPaginated` (`utils/apiResponse.js`).
3. `createPatientProfileSchema` was missing `userId` — every create request would have silently dropped it (Joi `stripUnknown`) and failed.
4. **Real access-control gap, now fixed**: medical history (allergies/conditions/meds/surgeries/family+social history/vaccinations) is embedded on the same document as basic demographics, but `PATIENTS_READ` and `MEDICAL_RECORDS_READ` are separate permissions (RECEPTIONIST has the former, not the latter). Every profile-read response was handing back the full document regardless of which permission the caller actually held. New `modules/patients/utils/patient-access.util.js` strips medical-history fields from every controller response unless the viewer holds `MEDICAL_RECORDS_READ` or is viewing their own record.
See `PROJECT_PROGRESS.md` for the complete breakdown and verification steps performed.

## Important Implementation Decisions (this session)
1. **Admin-created accounts never receive a password from anyone** — including the administrator who creates them. `modules/users/services/user.service.js`'s `createUserByAdmin` generates a random password server-side purely to satisfy the schema's `passwordHash: required`, immediately discards it, and instead issues a password-reset token via the same mechanism `auth/auth.service.js`'s `resetPassword` already consumes. This means `POST /auth/reset-password` (BET-03) is now used for two flows (self-service forgot-password, and admin-provisioned initial password-set) — deliberately, to avoid building and maintaining a second "set initial password" code path that would need its own security review.
2. **`SOFTWARE_OWNER` role is not assignable through `modules/users/` at all**, not even by another `SOFTWARE_OWNER` — `ADMIN_ASSIGNABLE_ROLES` excludes it outright, and `blockProtectedRoleTarget` (BET-04) is applied at the route level on both create and role-change as a second, independent layer. This is deliberate: the master prompt requires any ownership-transfer mechanism to be its own explicit, MFA-gated, audited operation, not a side effect of ordinary role assignment. That dedicated endpoint still does not exist (same as reported after BET-03/04) — still belongs to a future BET.
3. **"Permission assignment" (BET-05 roadmap item) was satisfied via role assignment, not a new per-user override mechanism.** This architecture expresses all permission granularity through roles (fixed system roles, or BET-04 custom roles) — there is no per-user permission-override concept anywhere in the codebase, and BET-05 did not introduce one. If a future task genuinely needs per-user overrides on top of role-based permissions, that's a deliberate architectural addition to flag and design, not something to add quietly.
4. **Doctor listing is gated on `doctors:read`, not `users:read`** — even though the underlying data is a `StaffProfile` filtered by designation, deliberately using the more specific, already-existing (previously unused) permission constant so a future role can see the doctor roster without general staff/HR administration access.
5. **Medical-history field redaction happens in the controller layer, not the service layer** (`modules/patients/utils/patient-access.util.js`, BET-06) — the service functions are reused internally by other flows (future consultation/prescription modules will likely need the full profile server-side), so redaction is applied only at the point a response actually leaves the API, based on `req.user`. Don't move this into the service layer without checking every internal caller first.
6. **General medical history (BET-06) stays on `MEDICAL_RECORDS_READ`/`WRITE`; sensitive reproductive/sexual-health data is out of scope for `modules/patients/` entirely** — that's BET-07's `modules/gynecology/`, on the separate `SENSITIVE_RECORDS_READ`/`WRITE` pair. Do not add gynecology/obstetric fields to `PatientProfile`.
7. **"Provider-based access" (BET-07) is enforced in the service layer, not the route layer** — `authorize(SENSITIVE_RECORDS_READ/WRITE)` only checks the role-level permission; `enforceSensitiveRecordAccess` (`modules/gynecology/services/sensitive-record-access.service.js`) additionally requires a `DOCTOR` to be the specific patient's `primaryCareProvider`. This two-layer shape (route-level RBAC + service-level resource-ownership/provider check) is now the established pattern for any future "role has permission but only for resources they're specifically tied to" requirement — reuse `enforceSensitiveRecordAccess`'s shape rather than reinventing it.
8. **Sensitive-record access logging is unconditional and separate from the general audit trail** — every call into `modules/gynecology/services/gynecology.service.js` that touches an existing/target record routes through `enforceSensitiveRecordAccess`, which logs both allowed and denied attempts to `SensitiveRecordAccessLog` before the caller gets a result. This log is intentionally its own collection (`sensitive_record_access_logs`), not part of BET-17's future general audit trail — same reasoning BET-03 used for `SecurityEvent`.

### BET-10 — Appointment, Schedule & Queue ✅ (models/services/controllers pre-existing and correct; routes were the actual gap)
`modules/appointments/{models,services,controllers,validators}` and `modules/queue/{models,services,controllers,validators}` were already fully built from earlier in this WIP session and were read end-to-end (per the standing lesson) — found correct, no bugs like BET-06's had. The real gap: `appointment.routes.js` and `queue/routes/queue.routes.js` did not exist at all, and `schedule.routes.js` (which did exist) was never mounted in `app.js` — so none of BET-10's HTTP surface was reachable despite the underlying logic being complete. Built the two missing route files and mounted all three routers (`/api/v1/schedules`, `/api/v1/appointments`, `/api/v1/queue` — deliberately three separate top-level paths, not nested, to avoid `schedule.routes.js`'s `/:doctorId` colliding with `appointment.routes.js`'s `/:id`). See `PROJECT_PROGRESS.md`'s "BET-10 — What was implemented" for the full route-by-route authorization reasoning (in particular: why `confirm`/`no-show` are `staffOnly` on the appointment router while `cancel`/`reschedule` are not, and why every queue route is `staffOnly`). Also found and corrected the same documentation-lag issue BET-04 had: `modules/encounters/` (BET-09) was already complete and already mounted, but this file still said "NOT STARTED" — verified, no code changes needed.

## Known Issues
- **UPDATE (BET-15 session, 2026-08-13): `npm install` now works.** Every bullet below this one describing "network egress fully blocked" / "npm install fails 403" was accurate for every session through BET-12's gap-closure pass, but is **no longer current** — this session ran a real `npm install` (677 packages), a real `npx jest` run, and a real `node src/server.js` boot (which reached, and only failed at, the actual MongoDB Atlas dial — that host specifically is still not on this sandbox's network allowlist, unlike the npm registry). The end-to-end live-database round trips this note calls for below (admin→staff account→login, patient-record redaction, gynecology provider-access + logging) are **still not done** — this session's scope was BET-15, not re-verifying BET-05/06/07 — but they are now *possible* for a future session in a way they weren't before, given MongoDB Atlas reachability, or a local/`mongodb-memory-server`-backed alternative (attempted this session for BET-15's own tests; blocked specifically on `fastdl.mongodb.org` not being allowlisted, a narrower gap than "no network access at all"). Re-check both allowlist boundaries (npm registry, MongoDB Atlas, `fastdl.mongodb.org`) at the start of the next session rather than assuming either the old "fully blocked" state or this session's "npm works" state still holds.
- **Network egress in this sandbox is still fully blocked this session** — `npm install` fails (`403` from the npm registry, zero packages in `node_modules`), so nothing this session could be verified beyond `node --check` (syntax, run across the *entire* `server/src` tree this session, not just new files) and manual static cross-reference audits (a Python script diffing exported vs. imported identifiers across module boundaries). **The very first step of the next session should be running `npm install` + a real server boot + live end-to-end round trips** — (a) admin creates a staff/doctor account → set-password email link → login (BET-05), (b) create a `PatientProfile` → fetch it as the patient via `/patients/me` vs. as a `RECEPTIONIST` via `/patients/:id` to confirm medical-history redaction (BET-06), and (c) create a `GynecologyRecord` → confirm a non-assigned `DOCTOR` gets a 403 while the assigned `primaryCareProvider` succeeds, and that both attempts land in `sensitive_record_access_logs` (BET-07) — before any of BET-05/06/07 are treated as field-verified. _(Historical — accurate as of the session that wrote it, superseded by the bullet immediately above.)_
- **Trust nothing found in `modules/*` (or `client/*`) without opening and reading it first** — standing lesson, reconfirmed again this session in a *third* variant. `modules/patients/` (BET-06) looked complete but had a fatal import that would have crashed on first request; `modules/gynecology/` (BET-07) really was empty; `modules/appointments/`+`modules/queue/` (BET-10) were neither — the model/service/controller layers were genuinely complete and correct, but the *routes* were missing/unmounted, so the feature was 100% unreachable over HTTP despite ~95% of the code being done. `client/web` was assumed empty prior to a session and turned out to already have a full, correct auth implementation. Four different failure modes so far, all only discoverable by opening every file — don't infer completeness or correctness from file size, docstrings, prior session notes, or a folder's mere existence. This pattern held again for BET-15: `modules/billing/` and `modules/payments/` have real model/service/provider code, but the routes are missing/unmounted, so none of it is reachable over HTTP yet. Before touching BET-14 or finishing BET-15, read every file in `modules/video-calls/`, `modules/billing/`, `modules/payments/`, and `modules/invoices/`, and specifically check whether routes exist AND are mounted in `app.js` — not just whether the service/controller layer looks done.
- `audit/audit.model.js`, `audit/audit.service.js`, `backup/backup.service.js` remain empty — untouched, reserved for BET-17/BET-18.
- No automated test suite exists yet under `server/tests/{unit,integration,security,e2e}` beyond `setup.js` — that is BET-22's job.
- SMTP credentials in `.env` — email sending was not live-verified, same reason as BET-03: no outbound SMTP reachable in this sandbox. `mailer.js` fails safe (logs a warning, returns `{ sent: false }`) rather than throwing.

## Environment Requirements
- Node >= 20, npm >= 10.
- No new npm dependencies were added this session (BET-10 only used packages already installed: express, joi, mongoose).
- MongoDB Atlas cluster already configured in `server/.env` (`MONGODB_URI`) — unchanged.
- Cloudinary already configured in `server/.env` — unchanged.
- Redis currently disabled (`REDIS_ENABLED=false`).
- SMTP (`SMTP_*` in `.env`) — optional; if left blank, emails are skipped with a logged warning instead of failing requests.

## API Changes (this session)
New routes under `/api/v1/users` (all `authenticate` + `users:read`/`users:write`):
- `GET /` — list/search users (filters: `role`, `status`, `search`; paginated)
- `GET /:id`
- `POST /` — admin-create a staff/doctor/admin account (never `PATIENT`, never `SOFTWARE_OWNER`)
- `PATCH /:id` — edit name/email/username
- `PATCH /:id/role` — role assignment (hierarchy-checked)
- `PATCH /:id/status` — activate/deactivate/suspend (revokes sessions on non-`ACTIVE`)

New routes under `/api/v1/staff`:
- `GET /doctors` — list active doctor staff profiles (`doctors:read`)
- `GET /doctors/:id` (`doctors:read`)

Unchanged existing routes: everything under `/api/v1/auth`, `/api/v1/roles`, `/api/v1/permissions`, and the rest of `/api/v1/staff` from earlier in this WIP session.

New routes under `/api/v1/patients` (BET-06; all `authenticate`; see `modules/patients/routes/patient.routes.js` for full detail):
- `GET /me` — patient's own profile, full detail, no extra permission needed beyond authentication
- `GET /` (`patients:read`, paginated/filterable), `POST /` (`patients:write`)
- `GET /patient-id/:patientId`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (deactivate), `PATCH /:id/reactivate` (`patients:read`/`patients:write`)
- `POST|PATCH|DELETE /:id/allergies[/:itemId]`, `.../chronic-conditions[/:itemId]`, `.../surgeries[/:itemId]`, `.../medications[/:itemId]`, `.../family-history[/:itemId]`, `.../vaccinations[/:itemId]` — all `medical_records:write` (`medical_records:read` is implied by whichever route already required `patients:read`/`write`, but every response is additionally redacted per-viewer regardless — see `patient-access.util.js`)
- `PATCH /:id/social-history` — `medical_records:write`

New routes under `/api/v1/gynecology` (BET-07; all `authenticate`; see `modules/gynecology/routes/gynecology.routes.js` for full detail):
- `GET /me` — patient's own record, no extra permission beyond authentication (identity-resolved, same shape as `/patients/me`)
- `POST /` (`sensitive_records:write`), `GET /patient/:patientProfileId` (`sensitive_records:read`), `GET /:id` (`sensitive_records:read`), `PATCH /:id` (`sensitive_records:write`) — every non-`/me` route additionally enforces provider-based access in the service layer (a `DOCTOR` must be the patient's `primaryCareProvider`; admin-tier roles are exempt)
- `POST|PATCH|DELETE /:id/conditions[/:itemId]`, `.../contraception[/:itemId]`, `.../sti-history[/:itemId]`, `.../cervical-screenings[/:itemId]`, `.../breast-records[/:itemId]`, `.../procedures[/:itemId]` — all `sensitive_records:write` + provider-based access
- Every request above (allowed or denied) is written to `sensitive_record_access_logs`

New routes under `/api/v1/schedules` (BET-10; all `authenticate`; see `modules/appointments/routes/schedule.routes.js`):
- `GET /blocked-dates`, `POST /blocked-dates` (`staffOnly`), `DELETE /blocked-dates/:id` (`staffOnly`) — `appointments:read`/`write`
- `GET /:doctorId`, `PUT /:doctorId` (`staffOnly`), `POST /:doctorId/deactivate` (`staffOnly`) — doctor schedule template
- `GET /:doctorId/available-slots` — open to any authenticated user (a patient must see what's bookable before booking)

New routes under `/api/v1/appointments` (BET-10; all `authenticate`; see `modules/appointments/routes/appointment.routes.js`):
- `GET /me` — patient's own appointments, no extra permission beyond authentication
- `POST /` (`appointments:write`) — book; `GET /` (`appointments:read`, `staffOnly`) — full filterable list
- `GET /:id`, `GET /:id/history` (`appointments:read`; ownership enforced in the service layer for a `PATIENT` actor)
- `POST /:id/confirm` (`appointments:write`, `staffOnly`), `POST /:id/cancel`, `POST /:id/reschedule` (both `appointments:write`, open to the owning `PATIENT`), `POST /:id/no-show` (`appointments:write`, `staffOnly`)

New routes under `/api/v1/queue` (BET-10; all `authenticate` + `staffOnly`; see `modules/queue/routes/queue.routes.js`):
- `POST /check-in/:appointmentId` (`appointments:write`)
- `GET /today/:doctorId` (`appointments:read`), `GET /:id` (`appointments:read`)
- `POST /:id/call`, `POST /:id/start-consultation`, `POST /:id/complete`, `POST /:id/no-show` (all `appointments:write`)

## API Changes (2026-08-15 session — BET-18, new routes)
All new, mounted at `/api/v1/backups` (`system:admin` throughout): `GET /`, `POST /`, `GET /:id`, `POST /:id/restore-test`, `POST /:id/restore`, `POST /retention/purge`. See `docs/BET-18-API.md` for full detail.

## API Changes (2026-08-15 session — verification only, no new routes)
No new routes were added this session — every route documented in `docs/BET-16-API.md` and `docs/BET-17-API.md` already existed in the uploaded project and was already mounted. See those two files for the full endpoint lists (`/cms/*`, `/integrations/*`, `/auth/me/deletion-request`, `/users/deletion-requests*`, `/data-lifecycle/*`).

## Database Changes (2026-08-15 session — BET-18)
One new collection: `backup_runs` (`modules/backups/models/backup.model.js`) — one document per backup run. No changes to any existing collection/schema.

## Database Changes (2026-08-15 session)
No new collections and no schema changes — this session was verification only. For completeness, the collections BET-16/BET-17 checkpoints 3–4 use (all pre-existing in the uploaded project, none touched this session): `website_pages`, `website_media`, `website_services`, `website_homepage_stats`, `website_about_content`, `integration_logs`, `account_deletion_requests`.

## Database Changes (historical)
**BET-17 checkpoint 1 (2026-08-14) adds one new collection: `audit_logs` (`audit/audit.model.js`).** No changes to any existing collection/schema — this checkpoint is additive-only, per master prompt §81.

BET-07 adds two new collections: `gynecology_records` (`modules/gynecology/models/gynecology-record.model.js`) and `sensitive_record_access_logs` (`modules/gynecology/models/sensitive-record-access-log.model.js`). No changes to any existing collection/schema. (BET-06 likewise reused `PatientProfile` with no schema changes.)

BET-10 introduced no new collections this session — `appointments`, `doctor_schedules`, `blocked_dates`, and `queue_entries` (all four models) were already created and correct from earlier in the same WIP session; this session only added the routes that make them reachable.


## BET-12 — Final Backend/API Handoff

Status: COMPLETED — 2026-08-13

### Architecture
- `modules/investigations/` is the investigation-order domain.
- `modules/reports/` owns medical-report metadata, lifecycle, extraction, verification, amendments, secure storage access, and report audit access logs.
- `security/file-security.js` remains the shared upload-security boundary.
- Existing Cloudinary configuration remains the medical-report storage provider.
- `modules/reports/services/ocr.service.js` is the active provider abstraction for Tesseract/pdftoppm.
- `modules/reports/services/spreadsheet-extraction.service.js` handles dependency-free XLSX extraction and sends legacy XLS to manual review.
- `app.js` now mounts `/api/v1/investigations` and `/api/v1/reports`.

### API changes
- Investigation routes are reachable through `/api/v1/investigations`.
- Report routes are reachable through `/api/v1/reports`.
- Patient self-service uses `/me`; patient access to individual reports is ownership-checked server-side.
- Report search supports patient, investigation, type, status, verification status, text search, pagination, and authorization-aware sensitive filtering.
- Secure download never returns a Cloudinary URL to the client.

### Database changes
- `MedicalReport` gained additional query indexes for patient/status, investigation/status, and sensitive-patient access.
- `EXTRACTION_SOURCES` now includes `SPREADSHEET`.
- Existing original-document preservation and report-access-log collections remain intact.

### Security decisions
- Sensitive report lists are filtered before pagination; ordinary doctors only receive sensitive records for patients whose `primaryCareProvider` is that doctor.
- Patients can only receive finalized/amended reports.
- OCR retries are atomically claimed to prevent duplicate extraction jobs.
- Office Open XML uploads are checked for unsafe archive paths, executable-like entries, macro payloads, excessive expansion, and traversal patterns.
- Finalized amendments preserve the previous parameters and interpretation before applying the new version.
- Doctor verification remains separated from general report-write permission.

### Environment correction
The previous env schema contained duplicate OCR configuration keys. The later duplicate block shadowed the active Tesseract settings and was removed. The canonical OCR variables are:
`OCR_PROVIDER`, `OCR_DEFAULT_LANGUAGES`, `OCR_TESSERACT_BIN`, `OCR_PDFTOPPM_BIN`, and `OCR_TIMEOUT_MS`.

### Verification
`node --check` passed for all server JavaScript files. Live Jest/MongoDB/Cloudinary/Tesseract verification is still required in a normal development environment with dependencies installed.

### BET-12 audit & correction pass — 2026-08-13 (same day, follow-up session)

Re-audited the BET-12 implementation above line-by-line against the master prompt before trusting the prior "COMPLETED" status. Found and fixed 3 real defects; architecture, `.env`, MongoDB, and Cloudinary configuration untouched. Full narrative is in `PROJECT_PROGRESS.md`'s BET-12 section — summary here for the next session:

**Fixed:**
1. `modules/reports/routes/report.routes.js` — `GET /api/v1/reports` (the general list/search route) had a `validateParams` call requiring a `:patientProfileId` URL param that route doesn't have, so it 400'd on every call. Removed; the dedicated `/patient/:patientProfileId` route is unaffected and still correctly validated.
2. `modules/reports/services/extraction-parser.service.js` — the qualitative abnormal-flag classifier used a substring regex that matched `"reactive"` inside `"Non-Reactive"`/`"Nonreactive"` and `"detected"` inside `"Not Detected"`, flagging common **negative** results as `ABNORMAL`. Replaced with an exhaustive value → flag lookup table. Regression-tested.
3. `server/package.json` — Jest could not parse any `.test.js` file (project is native ESM, Jest scripts never set `NODE_OPTIONS=--experimental-vm-modules`, no babel/swc transform installed). Added the flag to `test`/`test:watch`/`test:coverage`.

**Added:** `tests/unit/bet12-report-access.test.js` and `tests/unit/bet12-office-container-security.test.js` (new, DB-free), plus regression cases added to the existing `tests/unit/bet12-extraction-parser.test.js`. All new assertions were hand-verified against the real implementation via plain `node --input-type=module` (jest itself still can't run here — see below) before being committed to the test files.

**Confirmed already correct, no fix needed:** XLSX decompression-bomb protection (already enforced by `file-security.js`'s `hasSafeOfficeContainer` at upload time, before extraction ever runs); `investigation.routes.js` does not share report.routes.js's param bug; `sensitive-record-access.service.js` (BET-07, reused here) is a real implementation.

**Still open for a session with network access:**
- Could not run `npm install` or `npm test` here (registry returns 403 — same sandbox limitation every prior session hit). Everything above was verified by hand instead (see PROJECT_PROGRESS.md for exactly how).
- `tests/setup.js` is still empty/unused. No `mongodb-memory-server` (or equivalent) devDependency exists yet, so there is still no way to run real integration/e2e tests against a live-but-ephemeral MongoDB. This is the single biggest remaining gap for BET-12.38/12.39's Integration/Security/E2E tiers (only the Unit tier has real coverage right now). Recommended next step: add `mongodb-memory-server`, wire it into `tests/setup.js` via Jest `globalSetup`/`globalTeardown`, *then* write `tests/integration/bet12-reports.test.js` covering the full upload→OCR→extract→review→verify→finalize→patient-view path plus the unauthorized-access/IDOR cases BET-12.38 calls for.
- Do not start BET-13. This pass stayed inside BET-12 per the master prompt's one-task-at-a-time rule.

### BET-12 gap-closure pass — 2026-08-13 (same day, second follow-up)

Closed 3 of the 4 remaining scope gaps a prior session had identified and left open (a 5th item — real mongodb-memory-server-backed integration/e2e tests — remains blocked; see above, unchanged). Architecture, `.env`, MongoDB, and Cloudinary configuration untouched. Full narrative in `PROJECT_PROGRESS.md`.

**Closed:**
1. **Report search (BET-12.29) was missing `orderingDoctorId` and a date-range filter.** Added both to `listReportsQuerySchema` and `report.service.js`'s `listReports`. The date filter (`dateFrom`/`dateTo`) matches `reportDate` when present, falling back to `uploadDate` for reports that don't have one set, rather than silently excluding them. Also fixed a latent `$and`/`$or` merge bug in the same function (pre-existing, not introduced by this change, but exposed by it): the doctor-sensitivity-ownership clause was being assigned straight into `filter.$and`, which would have silently discarded a date-range clause any time both were active on the same query.
2. **Investigation search (BET-12.29) had no free-text search** — `reports` had one, `investigations` didn't. Added `search` (matches investigation `name`) to `listInvestigationsQuerySchema` and `investigation.service.js`'s `listInvestigations`, with the same `$and`-merge fix applied.
3. **Orphaned dead OCR abstraction removed.** `server/src/integrations/ocr/` (an interface file + a no-op manual-entry provider) had zero importers anywhere in the tree — confirmed via project-wide grep before deleting. The real, working abstraction remains at `modules/reports/services/ocr.service.js`, unaffected.
4. **Document metadata extraction (BET-12.32) was PDF-only.** Built `modules/reports/services/office-metadata.service.js` — dependency-free (reuses the existing ZIP-central-directory reader, now exported from `spreadsheet-extraction.service.js` as `readZipEntries`), reads `docProps/core.xml`'s `dc:title` for both `.docx`/`.xlsx` and, for `.docx` only, Word's self-reported `Pages` count from `docProps/app.xml`. New model field `originalDocument.embeddedTitle` (kept distinct from the existing user-authored `title` field). Deliberately does not guess a page count for `.xlsx` — there's no meaningful equivalent, and inventing one would violate BET-12.12. Wired into the upload path in `report.service.js`.

**Verification performed this session:**
- `node --check` on every new/modified file, plus a full sweep of every `.js` file under `src/` and `tests/` (zero syntax failures).
- A corrected export/import cross-reference audit across the entire tree (the first run of the audit script itself had a false positive — its export-detection regex didn't account for `export async function`; fixed the script, re-ran, 0 real problems).
- Hand-built a byte-correct synthetic OOXML ZIP fixture (STORED/uncompressed entries, real CRC32, real ZIP local/central-directory headers — same technique the existing `tests/unit/bet12-office-container-security.test.js` uses) and ran real assertions against `extractOfficeMetadata` directly: title extraction, `.docx` page-count extraction, `.xlsx` correctly returning `pageCount: null`, non-Office mime types short-circuiting to nulls, and a malformed buffer failing soft to nulls rather than throwing. All passed.
- Confirmed via grep that no remaining reference to the deleted `integrations/ocr/` folder exists anywhere in the project (code or docs).

**Still not done:** real integration/e2e tests against a live-but-ephemeral MongoDB (item 5 from the prior gap list) — still blocked by this sandbox having no network access to install `mongodb-memory-server`. No new attempt was made this session; the recommendation above stands unchanged.

### FET-15 (Part 2, checkpoint 2) — Billing & Payments: Payments, Refunds, Balances, Receipts, Billing history — 2026-08-19

Continuation of FET-15 per the client's explicit PART/checkpoint-zip protocol. Confirmed via direct file reads (not assumption) that BET-15.2's payments backend (`server/src/modules/payments/`) — manual payments, checkout initiation, refunds, receipt PDF generation, cancel-pending, provider webhook boundary — was already fully built and mounted, and that `client/web/src/services/paymentsService.js` already wrapped every one of those endpoints correctly from an earlier FET-12 pass. This pass was pure frontend UI gap-closure against that existing, already-correct service layer — no backend changes.

**New frontend components:**
- `RecordManualPaymentDialog.jsx` — staff (`BILLING_WRITE`) records a CASH/BANK_TRANSFER payment against an invoice.
- `RefundDialog.jsx` — staff refunds a `SUCCEEDED`/`PARTIALLY_REFUNDED` payment. Computes remaining-refundable amount from a live read of the payment's `Refund` history rather than trusting a cached total, mirroring how `payment.service.js` itself derives it server-side.
- `OutstandingBalancesPanel.jsx` — the "Balances" requirement. Deliberately does not fetch the entire invoice dataset into the browser to compute a fake system-wide total — that would violate this project's own established rule (see `Pagination.jsx`'s comment) against unbounded client-side aggregation of paginated resources. Instead: a real server-paginated, status-toggled (`ISSUED`/`PARTIALLY_PAID`) list of invoices that still carry a balance, with an honestly-labelled current-page subtotal.
- `BillingHistoryPanel.jsx` — the "Billing history" requirement. Merges two already-bounded, already-fetched lists (recent invoices + recent payments) into one newest-first timeline. Holds no fetch logic itself.
- `PaymentsRosterPanel.jsx` — staff-facing payments list (`GET /payments`), filterable by status/method, real server pagination, with the same receipt/refund/cancel actions available per-invoice, now reachable directly.

**Modified:** `InvoiceDetailDialog.jsx` (manual-payment button, per-payment refund button, per-payment cancel-pending button); `BillingPage.jsx` (`MyBillingView` gained Balances/History tabs and receipt/cancel actions on its Payments tab; `StaffBillingView` gained Payments/Balances/History tabs).

**i18n:** `locales/{en,bn}/translation.json` — 40 new `billing.*` keys (115 → 155), real Bangla throughout (not staged English), verified zero drift both directions.

**Verification:** This session had live npm registry access (unlike most prior sessions), so `esbuild` was installed fresh into a scratch directory (`npm install esbuild --no-save`) rather than borrowed from a vendored `tsx` install. Ran: per-file `esbuild --jsx=automatic` transform on all 10 touched/new files (0 errors); a full `esbuild --bundle` from `app/App.jsx` through the real module graph with every real dependency `--external` (resolves clean, same 3 pre-existing `import.meta`/iife warnings, 0 errors); a scripted `t('...')` key cross-check against both locale files (0 missing); a `billing.*` key-set diff between `en`/`bn` (155/155, zero drift); a paren/brace/bracket balance check on all touched files. Still no live `npm install` inside `client/web`'s own tree, no `vite dev`, no browser check against a running backend — not claimed as done.

**Next:** FET-15 PART 3 — Payment method selection, Payment initiation, Payment status, per the client's checkpoint-zip protocol.

### FET-15 (Part 3, checkpoint 3) — Billing & Payments: Payment method selection, Payment initiation, Payment status — 2026-08-19

Continuation of FET-15. Confirmed via direct file reads that `POST /payments/initiate` and `GET /payments/:id` (BET-15.2) were already fully built/mounted, and that method selection + initiation already worked correctly on the frontend (`PayInvoiceDialog.jsx`, from an earlier FET-12 pass). The one genuine gap for this Part was **Payment status**: after a patient was redirected to the gateway, there was no way to see the live outcome without leaving the dialog and manually refreshing the Payments tab.

**New:** `PaymentStatusDialog.jsx` — polls `GET /payments/:id` (4s interval, capped at 20 polls / ~80s, then requires a manual "Check again" — never polls forever) and renders exactly the server's current `status`, provider name/reference when populated, failure reason on `FAILED`, and status-appropriate actions (cancel while `PENDING`, download receipt / request refund once `SUCCEEDED`). Never infers success from the redirect itself — same rule the rest of this payments module already follows.

**Modified:** `PayInvoiceDialog.jsx` (post-initiation hand-off into the new dialog via a "Track status" button); `InvoiceDetailDialog.jsx`, `PaymentsRosterPanel.jsx`, `BillingPage.jsx`'s `MyBillingView` Payments tab — every payment row on all three surfaces now has a "Status" action.

**i18n:** 8 new `billing.status.*` keys (155 → 163 billing keys total), real Bangla, zero drift verified both directions.

**Verification:** Same tooling as checkpoint 2 (fresh `esbuild` install, this session still has live npm access) — per-file transform checks (0 errors), full `esbuild --bundle` from `app/App.jsx` (0 errors, same 3 pre-existing warnings), scripted `t()` key cross-check (0 missing, 139 keys checked), `billing.*` key-set diff (163/163, zero drift), brace/paren balance check (all balanced). Still no live `vite dev`/browser check against a running backend.

**Next:** FET-15 PART 4 — Payment success, Payment failure, Refund status, Provider-specific UI, per the client's checkpoint-zip protocol.

### FET-15 (Part 4, final checkpoint) — Billing & Payments: Payment success, Payment failure, Refund status, Provider-specific UI — 2026-08-19

Final part of FET-15 per the client's checkpoint-zip protocol. Read `gateway-payment.provider.js` and `payment.service.js`'s `refundPayment` again before writing anything: confirmed online-payment success/failure is always webhook-resolved (never client-inferred — already correctly built in Part 3's `PaymentStatusDialog`), and that a refund resolves *synchronously within the same request* (manual → `COMPLETED` immediately; gateway → whatever the provider reports, `COMPLETED` or `PROCESSING`) — there's no later webhook advancing a `PROCESSING` refund further, so there was nothing genuine to poll for on the refund side.

**Genuine gaps closed this pass:**
1. **Refund status honesty** — `RefundDialog.jsx`'s post-submit toast previously always said "requested" regardless of outcome. Now reflects the refund's real resulting status (`COMPLETED` vs `PROCESSING`), and the dialog stays open after submit so the refreshed history list with its real status badge is immediately visible.
2. **Provider-specific UI** — `InvoiceDetailDialog.jsx`'s payment rows now show the `provider` label next to the method whenever it's populated with something other than the default `'manual'` value, so which real gateway a payment went through is visible without opening the full status dialog.

**Reviewed and found already sufficient (no changes needed):** "Payment success"/"Payment failure" — Part 3's `PaymentStatusDialog` already gives each terminal state its own icon/badge/copy and surfaces `failureReason` verbatim on `FAILED`. Building a second, separate success/failure screen on top of an already-correct live status dialog would have been redundant, not a real gap.

**i18n:** 2 new `billing.refund.{successCompleted,successProcessing}` keys (163 → 165 billing keys), real Bangla, zero drift.

**Verification:** Same tooling as every checkpoint this session — per-file `esbuild` transform (0 errors), full `esbuild --bundle` from `app/App.jsx` (0 errors, same 3 pre-existing warnings), scripted key cross-check including the 3 dynamically-selected refund result keys (0 missing), `billing.*` key-set diff (165/165, zero drift), brace/paren balance check (all balanced). Still no live `vite dev`/browser check against a running backend — flagged honestly as the standing gap, not glossed over.

**FET-15 is now complete end-to-end** — Fees, Invoices, Invoice details, Discounts, Payments, Refunds, Balances, Receipts, Billing history, Payment method selection, Payment initiation, Payment status, Payment success, Payment failure, Refund status, and Provider-specific UI are all implemented against the real, already-complete BET-15 backend and verified at the compiler/lexical level.

## FET-18 — Text-to-Speech & Accessibility Interaction — 2026-08-21

Per roadmap order, FET-18 was the next unstarted frontend task. Before writing anything, inspected the whole tree for it the standing "read before trusting" way — this time it flipped the usual finding: **FET-18 was already fully built** (`lib/speech.js`, `hooks/useTextToSpeech.js`, `hooks/useTextSelection.js`, `providers/SpeechProvider.jsx`, `components/accessibility/{ReadPageButton,ReadSelectionButton,SpeechControlsBar}.jsx`, the Speech card in `SettingsPage.jsx`, and the matching backend `uiPreferences.speech` schema in both `users/user.model.js` and `auth/auth.validation.js`) — just never given a dated section in `PROJECT_PROGRESS.md`, the same documentation-lag this project has hit repeatedly on the backend side (BET-04/09/16/17), now confirmed once on the frontend too. Every file was read end-to-end, every mount point (`Topbar.jsx`, `AppShell.jsx`, `main.jsx`'s provider tree) confirmed by direct read, not just grep. See `PROJECT_PROGRESS.md`'s `## FET-18` section for the full per-file breakdown and the roadmap-item-by-item coverage check (all 7 bullets satisfied).

**The one real gap, closed this session:** `accessibility.speech.*`/`settings.speech.*` (21 keys) existed only in `en/translation.json` — a gap already flagged, unresolved, by two prior FET-17 checkpoints. Added real Bangla and real Chinese translations for all 21 keys (not staged English), matching the established tone of the surrounding `settings.*`/`accessibility.*` groups.

**Verification performed this session:**
- All three `translation.json` files re-parsed valid; key-set parity now **1227/1227/1227, zero drift** (closes the gap the last two FET-17 checkpoints carried forward).
- Whole-tree `t('...')` sweep: 1127 keys checked, 0 missing.
- Per-file `esbuild` transform on every speech-related file: 0 errors.
- Full `esbuild --bundle` from `app/App.jsx` through the real module graph: 0 errors, same 3 pre-existing `import.meta`/iife warnings as every prior session.
- Still no live `vite dev`/browser click-through against a running backend, and no real device/OS voice inventory (this sandbox has no audio-capable browser) — same standing caveat as every prior frontend session; not claimed as done.

**FET-18 is now complete** — Text-to-speech, Read selected content, Voice/read controls, Speech settings, Accessibility integration, Language-aware speech, and User preference persistence are all implemented and verified against the real, already-complete backend preference schema.

**Next:** per the master prompt's one-task-at-a-time rule and the client's explicit "ask for permission for the next task" instruction — **FET-19 (Social & External Integrations)** is next in roadmap order. Awaiting client confirmation before starting it.

## FET-17 — correction pass: BillingPanel/StaffPanel/ClinicalPanel wiring gap — 2026-08-22

`PROJECT_PROGRESS.md` had a "FET-17 — COMPLETE" entry that turned out to be wrong: its key count (1231/1231/1231) was stale (real count was 1820/1820/1820), and it never mentioned `AnalyticsPage`/`DataToolsPage` — the exact area an earlier FET-17 checkpoint had explicitly left mid-pass. Audited `components/analytics/DomainPanels.jsx` directly instead of trusting the "COMPLETE" note: 3 of its 6 panel functions (`BillingPanel`, `StaffPanel`, `ClinicalPanel`) had zero `t()` calls, all-hardcoded English labels, and `ClinicalPanel` was also overriding `BreakdownList`'s own already-fixed i18n fallback with a hardcoded string.

**Fixed:** wired all three panels to the `analytics.*` keys that already existed (real bn/zh translations, not staged English) — no new keys needed. Full detail and verification steps logged in `PROJECT_PROGRESS.md`'s matching dated entry.

**Verified:** `esbuild` transform + full `--bundle` from `app/App.jsx` (0 errors, same 3 pre-existing warnings), 61/61 `t('analytics.*')` calls in the file resolve against `en/translation.json`, `en`/`bn`/`zh` parity re-confirmed at 1820/1820/1820 zero drift. No live `vite dev`/browser check — standing sandbox caveat, not claimed as done.

**FET-17 is now genuinely complete.** Prior "COMPLETE" entry left in place, not edited, per this project's append-only log convention.

**Next:** still **FET-19 (Social & External Integrations)** per roadmap order — awaiting client confirmation before starting it.

## FET-19 — correction: found already built, undocumented; one real gap closed — 2026-08-24

The "Next: FET-19 awaiting confirmation" line directly above this was stale — FET-19 was already fully built in an earlier, undocumented session (real `IntegrationsPage.jsx`, backend `modules/integrations`, live route/nav, i18n) and just never got a `## FET-19` write-up in either log. Confirmed by reading the actual code, not by trusting the log's silence. Full detail in `PROJECT_PROGRESS.md`'s matching dated entry — summary here:

**Found solid:** real 3-provider registry (Email/SMS/WhatsApp), no fake integrations, real `ADMIN_TIER_ROLES`/`WEBSITE_MANAGE` gating verified end-to-end, correctly read-only configuration (no fake Save button), real HMAC webhook signature verification, full i18n (real Bangla, not staged).

**Gap found and closed:** the `IntegrationLog` collection backing "Sync status"/"Error status" had exactly one writer — the inbound WhatsApp webhook. The three actual outbound send paths (`mailer.js`/`sms.service.js`/`whatsapp.service.js`) never logged anything, despite the model already having an unused `OUTBOUND_SEND` enum value. Wired `recordIntegrationEvent` into all three, added a `maskRecipient()` helper so only a masked recipient — never raw email/phone/message body — ever lands in the log.

**Verified:** `node --check` across all 296 `server/src` files (0 errors); a custom import-graph trace confirming no circular imports; a real `npm install` (network reachable this session, 706 packages, no blocked hosts); a functional test through the real `sendMail`/`sendSms`/`sendWhatsAppMessage` functions — 15/15 assertions passed (unchanged return shapes, exactly 3 correct log writes, no raw recipient ever persisted). `mongodb-memory-server` couldn't download a real `mongod` this session (`fastdl.mongodb.org` not on the allowed egress list) — the test mocked `IntegrationLog.create` instead of a live DB write, flagged as weaker than a real round-trip, not glossed over. No live SMTP/SMS/WhatsApp success-path test (would need real third-party credentials) and no live browser click-through — same standing sandbox limitation as every session in this project.

**FET-19 is now genuinely complete** against every spec bullet.

**Next:** ask the client which FET-16 gap to tackle (admin CMS UI for Pages/Media/Stats/About, Contact inquiries inbox, or wiring the homepage to the sections registry) — all three still genuinely open, per this session's earlier website audit.

## Website module swap — 2026-08-27 (Claude session, no FET number assigned)

**What was done:** `client/website` (the previously non-building public site — Next.js 14, next-intl, English/Bangla/Chinese) was fully removed and replaced with a separately-built Next.js frontend ("gynocare front end part": Next 16 / React 19 / TypeScript / MUI / Tailwind v4) that already ships real Dr. Namira Tanha branding, Cloudinary-hosted media under the `namira-medical/website` path, and a CMS client (`src/lib/api.ts`) targeting `/api/v1/cms/*`.

**Verified compatible before swapping, not assumed:**
- New frontend's endpoints (`/cms/navbar`, `/cms/services`, `/cms/stats`, `/cms/about`, `/cms/certificates`, `/cms/hero-banner`, `/cms/sections`, `/cms/pages/public[/:slug]`, `POST /cms/contact`) all have exact matches already live in `server/src/modules/cms/routes/{cms,dynamic-site,contact}.routes.js` — no backend changes were needed or made.
- Default API base in the new frontend (`http://localhost:5000/api/v1`) matches `server/.env`'s `PORT=5000`, and `server/.env`'s `CORS_ORIGINS` already includes `http://localhost:3000`. `server/.env` was not opened for writing and its checksum was recorded before and after this session — unchanged.
- `package.json`/`package-lock.json` "aldhib" leftover name → renamed to `gynocare`. Grepped the full project tree afterward — zero remaining "aldhib" occurrences.

**Not done / not verifiable this session:** no `npm install` or `npm run build`/`next build` was run against the new website module (would need to fetch a large, different dependency tree — Next 16, React 19, MUI — under this session's network egress rules), so this is a **file-level integration, not a build-verified one**. The two frontends were on different Next/React majors (14/18 vs 16/19); nothing in the code was changed to reconcile that beyond the rename above — the new module was dropped in as-is since it was reported working standalone. Recommend `cd client/website && npm install && npm run build` as the first thing to check after unzipping.

**Old `client/website` (broken, next-intl based) was deleted, not archived.** If any custom edits existed on top of it that weren't in this zip, they're gone — check before working further from an older copy if one exists elsewhere.

## Lab tests on prescriptions — 2026-08-27 (Claude session, no FET number assigned)

**What was asked:** doctor can add lab test names to a prescription; patient can see test name + cost. Client also supplied `NamiraGynoCare_LaboratoryRequisitionForm.jsx` (a converted BMDC-hospital paper requisition form, ~200 hardcoded test names across categories, no prices) as a reference.

**Decision made, not just default behavior:** did NOT drop the uploaded form's hardcoded test list into the app. It has no cost data, and the ask explicitly needs "test name with test cost." Instead, wired the new lab-test picker into the existing `Fee` price catalog (`billing/models/fee.model.js`, `serviceType: 'INVESTIGATION'`) that the clinic already manages under Billing → Fees — a doctor searches it, picks a test, cost comes along automatically; a test not yet in the catalog can still be typed in free-hand with a manual cost. This means test costs shown to patients are the same admin-configurable numbers used everywhere else billing-related, not a second, disconnected price list.

**Changed:**
- `server/.../prescriptions/models/prescription.model.js` — new `labTests` array (`testName`, `category`, `cost`, `currency`, `notes`, optional `feeRef` back-pointer), snapshotted at prescribing time same as medicine `items`. Optional — a prescription with medicines only is still valid.
- `server/.../prescriptions/validators/prescription.validation.js` — matching Joi schema.
- `server/.../prescriptions/services/prescription.service.js` — added `labTests` to the finalized-prescription revise whitelist.
- `server/.../prescriptions/services/prescription-pdf.service.js` — new "Investigations Advised" section on the A4 PDF: test name, category, per-test cost, running total.
- `client/web/.../constants/prescriptions.js` — `emptyLabTestItem()`, `labTestsTotalCost()`.
- `client/web/.../components/prescriptions/LabTestsEditor.jsx` — new. Fee-catalog search (mirrors `MedicineSearchField`'s pattern) + manual entry, running total.
- `PrescriptionFormDialog.jsx` / `RevisePrescriptionDialog.jsx` — wired in for create and for revising a finalized prescription.
- `PrescriptionDetailDialog.jsx` — read view now lists lab tests with per-test cost and a total; this is the same dialog both the doctor's workspace (`PatientWorkspacePage.jsx`) and the patient's own records page (`MyClinicalRecordsPage.jsx`) already use, so both sides see it from this one change.
- `locales/{en,bn,zh}/translation.json` — 13 new keys each under `clinical.prescription.*`, real translations (not machine-literal placeholders) in Bangla and Chinese matching the file's existing style.

**Verified this session:** `node --check` on all 4 touched backend files (0 errors). All 5 touched client `.jsx`/`.js` files run through `esbuild` (installed standalone into a scratch folder for this check only, not part of the project) with 0 parse errors. All 3 locale JSON files re-validated as parseable JSON with the new keys present. Confirmed `labTests` isn't dropped by any `.select()`/projection on the existing prescription read queries (there are none), so no controller change was needed for it to appear in API responses.

**Not verified / not done:** no `npm install` + real app boot in this session — same standing sandbox limitation noted in the website-swap entry above. No new automated test was written for `labTests` (existing `bet22-*` integration/e2e tests weren't touched or re-run). Mobile app (`client/mobile`) has no prescription screens at all currently, so nothing there to update. The uploaded requisition-form component itself was not added to the codebase as-is (see decision above) — its BMDC-style patient/ward/cabin header fields were also not carried over, since prescriptions here already carry patient identity via `patientProfile`.
