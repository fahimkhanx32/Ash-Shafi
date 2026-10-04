/**
 * Mirrors server/src/security/permissions.js ROLES enum exactly.
 * This is for UX only (hiding nav/routes) — the backend remains the
 * sole authority on what a role can actually do. Never use this to
 * gate anything security-sensitive on its own.
 */
export const ROLES = Object.freeze({
  SOFTWARE_OWNER: 'SOFTWARE_OWNER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  DIRECTOR: 'DIRECTOR',
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  STAFF: 'STAFF',
  RECEPTIONIST: 'RECEPTIONIST',
  PATIENT: 'PATIENT',
});

// Roles that may sign in through the staff-facing login and land on
// an internal dashboard, vs. the patient portal.
export const STAFF_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.STAFF,
  ROLES.RECEPTIONIST,
];

// Mirrors server/src/security/permissions.js's SENSITIVE_RECORDS_READ/
// WRITE grants (FET-07). UX-only, for showing/hiding the gynecology &
// pregnancy workspace and its edit controls — the backend's
// `authorize()` + provider-based access check (BET-07/BET-08) is the
// real boundary.
export const SENSITIVE_RECORDS_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.DOCTOR,
];

// FET-05 — roles that reach the Super Admin dashboard / Staff &
// RBAC administration screens. Mirrors who actually holds
// `users:read` in `server/src/security/permissions.js`'s
// `rolePermissions` map (SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR,
// ADMIN) — UX-only gate; the real boundary is `authorize()` on each
// route, checked dynamically per-user via `usePermissions()`.
export const ADMIN_TIER_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
];

// FET-06 — mirrors `PATIENTS_READ` in `server/src/security/permissions.js`'s
// `rolePermissions` map exactly: every role except PATIENT holds it. Drives
// visibility of the patient list / workspace nav item and route. UX-only —
// the backend's `authorize(PERMISSIONS.PATIENTS_READ)` on `GET /patients` is
// the real boundary.
export const PATIENT_ACCESS_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.STAFF,
  ROLES.RECEPTIONIST,
];

// Mirrors `PATIENTS_WRITE` — everyone in PATIENT_ACCESS_ROLES except STAFF.
// Drives whether "Register patient" / "Edit" / "Deactivate" controls render.
export const PATIENT_WRITE_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.RECEPTIONIST,
];

// Mirrors `MEDICAL_RECORDS_WRITE` — gates the medical-history sub-resource
// forms (allergies, conditions, surgeries, medications, family/social
// history, vaccinations) inside the patient workspace.
export const MEDICAL_RECORDS_WRITE_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
];

// Mirrors `USERS_READ` — only these roles can look up an existing patient
// User account by email when registering a new patient profile (see
// `RegisterPatientDialog`). Everyone else must know the account id already.
export const USER_LOOKUP_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
];

// FET-10 — mirrors `PRESCRIPTIONS_READ`/`WRITE` in
// `server/src/security/permissions.js`'s `rolePermissions` map exactly
// (SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR, ADMIN, DOCTOR — the same set
// as `MEDICAL_RECORDS_WRITE_ROLES`, kept as its own named export since
// the two permissions are conceptually distinct on the backend). A
// `PATIENT` holds neither grant but reaches their own prescriptions via
// the backend's `/me` self-access route instead (see
// `services/prescriptionsService.js`) — UX-only gate, `authorize()` +
// `assertCanAccessPrescription` on the backend remain the real boundary.
export const PRESCRIPTIONS_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
];

export const PRESCRIPTIONS_WRITE_ROLES = PRESCRIPTIONS_ROLES;

// ElevenLabs voice agent (see `providers/VoiceAgentProvider.jsx`) —
// UX-only gate for showing the assistant orb at all. Every write
// tool the backend registry (`server/src/modules/voice/tools/
// tool-registry.js`) currently exposes requires PRESCRIPTIONS_WRITE,
// so a role that can't hold that permission (STAFF, RECEPTIONIST,
// PATIENT) would only ever hear "you don't have permission to do
// that" — showing the orb to them anyway would just be a confusing
// dead end, not a security control (the backend still enforces the
// real boundary per-tool regardless of who sees this button).
export const VOICE_ASSISTANT_ACCESS_ROLES = PRESCRIPTIONS_ROLES;

// FET-11 — mirrors `INVESTIGATIONS_READ`/`REPORTS_READ` in
// `server/src/security/permissions.js`'s `rolePermissions` map exactly
// (SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR, ADMIN, DOCTOR, STAFF — STAFF
// holds read/upload but not INVESTIGATIONS_WRITE/REPORTS_VERIFY). A
// `PATIENT` holds none of these but reaches their own investigations/
// reports via the backend's `/me` self-access routes instead (see
// `services/investigationsService.js`/`reportsService.js`) — UX-only
// gate, `authorize()` on the backend remains the real boundary.
export const INVESTIGATIONS_REPORTS_READ_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.STAFF,
];

// Mirrors `INVESTIGATIONS_WRITE` — everyone in
// `INVESTIGATIONS_REPORTS_READ_ROLES` except STAFF (only a
// doctor/admin-tier actor may order a new investigation on their own
// authority).
export const INVESTIGATIONS_WRITE_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
];

// Mirrors `REPORTS_WRITE` — same role set as the read grant (STAFF
// may upload a report on a patient's behalf, e.g. reception scanning
// in a paper result).
export const REPORTS_WRITE_ROLES = INVESTIGATIONS_REPORTS_READ_ROLES;

// Mirrors `REPORTS_VERIFY` — only a clinician/admin-tier actor may
// review parameters, set the interpretation, verify, finalize, or
// amend a report. Notably excludes ADMIN (administrative, not
// clinical) and STAFF, same split the backend documents.
export const REPORTS_VERIFY_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.DOCTOR,
];

// Mirrors `ADMIN_ASSIGNABLE_ROLES` in
// `server/src/modules/users/services/user.service.js` — every role
// an administrator may assign through ordinary user management.
// SOFTWARE_OWNER is deliberately excluded (protected role, master
// prompt section 10) and PATIENT is self-service-only. The backend
// remains the real enforcement point (it re-validates this exact
// list plus role-hierarchy on every request); this only drives the
// dropdown options shown in the UI.
export const ADMIN_ASSIGNABLE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.STAFF,
  ROLES.RECEPTIONIST,
];

// FET-12 (Patient Portal) — mirrors `BILLING_READ`/`BILLING_WRITE` in
// `server/src/security/permissions.js` exactly: SOFTWARE_OWNER,
// SUPER_ADMIN, DIRECTOR, ADMIN, RECEPTIONIST. Notably excludes
// DOCTOR/STAFF (billing is a front-desk/admin function, not a
// clinical one) and PATIENT (who reaches their own invoices/payments
// through the dedicated `/me` self-service routes instead, gated
// purely by authentication — see `BillingPage.jsx`).
export const BILLING_STAFF_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.RECEPTIONIST,
];

// Who should even see the "Billing" nav item / reach `/dashboard/billing`
// at all — staff who manage invoices, plus PATIENT for their own
// self-service invoices/payments. `BillingPage.jsx` itself branches
// further on `BILLING_STAFF_ROLES` for which UI (roster + fee catalog
// vs. "my invoices") to render.
export const BILLING_ACCESS_ROLES = [...BILLING_STAFF_ROLES, ROLES.PATIENT];

// Who may create/manage an invoice at all — `BILLING_STAFF_ROLES` plus
// DOCTOR, who now holds the server's `INVOICES_WRITE` permission
// (`permissions.js`) to bill for a visit directly from a patient's own
// chart. Deliberately NOT added to `BILLING_ACCESS_ROLES` above — a
// doctor doesn't get the practice-wide `/dashboard/billing` page (fee
// catalog, payments roster, outstanding balances); their entry point
// stays `PatientWorkspacePage.jsx`'s per-patient Billing tab, which
// the backend scopes to invoices they personally issued anyway. See
// `PatientBillingTab.jsx`/`PatientWorkspacePage.jsx`'s `canAccessBilling`.
export const INVOICE_WRITE_ROLES = [...BILLING_STAFF_ROLES, ROLES.DOCTOR];

// FET-12/FET-13 — mirrors `MESSAGING_READ`/`MESSAGING_WRITE` exactly:
// SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR, DOCTOR, PATIENT. Deliberately
// excludes ADMIN/STAFF/RECEPTIONIST — "ordinary administrative staff
// are not a party to" a patient-doctor conversation (see the backend's
// own comment on this grant). SOFTWARE_OWNER/SUPER_ADMIN/DIRECTOR only
// ever reach the admin-tier filtered roster (`GET /conversations`),
// never a `/me` conversation of their own, since that trio isn't
// itself DOCTOR or PATIENT — `MessagesPage.jsx` branches accordingly.
export const MESSAGING_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.DOCTOR,
  ROLES.PATIENT,
];

// FET-21 — mirrors `ANALYTICS_READ` in `server/src/security/permissions.js`
// exactly: gates the operational/appointments/queue/staff analytics
// domains (`analytics.constants.js`'s `ANALYTICS_DOMAIN_PERMISSION`).
// SOFTWARE_OWNER/SUPER_ADMIN hold every permission; DIRECTOR/ADMIN/
// DOCTOR/RECEPTIONIST hold this one explicitly; STAFF and PATIENT do
// not. Also the gate for the Analytics nav item/route itself, since
// every domain requires at least this permission.
export const ANALYTICS_ACCESS_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.RECEPTIONIST,
];

// Mirrors `ANALYTICS_BILLING_READ` — revenue/billing analytics,
// deliberately narrower than `ANALYTICS_ACCESS_ROLES` (excludes
// DOCTOR/RECEPTIONIST — practice revenue isn't a clinical or
// front-desk concern per the backend's own comment on this grant).
export const ANALYTICS_BILLING_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
];

// Mirrors `ANALYTICS_CLINICAL_READ` — consultation/prescription/
// investigation/pregnancy statistics (cohort-suppressed server-side,
// see `CLINICAL_ANALYTICS_MIN_COHORT_SIZE`). Excludes RECEPTIONIST
// (never a clinical role) relative to `ANALYTICS_ACCESS_ROLES`.
export const ANALYTICS_CLINICAL_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
];

// FET-21 — mirrors `DATA_EXPORT` exactly. Verified against
// `permissions.js` role-by-role: this set is also a strict subset of
// every entity-level read permission the tabular/medical-record
// export routes additionally require (`PATIENTS_READ`,
// `MEDICAL_RECORDS_READ`, `PRESCRIPTIONS_READ`, `INVESTIGATIONS_READ`
// each grant to a role set that already contains every role below),
// so this single list is the true effective gate for every export
// feature — no need to separately intersect per entity type.
export const DATA_EXPORT_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
];

// FET-21 — mirrors `DATA_IMPORT` exactly. Same subset relationship as
// `DATA_EXPORT_ROLES` above relative to `PATIENTS_WRITE` (the only
// entity-level permission `POST /imports/patients` additionally
// requires) — this list is the true effective gate.
export const DATA_IMPORT_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.RECEPTIONIST,
];

// Who reaches the "Import/Export" nav item & route at all — anyone
// who can do at least one of the two. `DataToolsPage.jsx` itself
// further gates each individual tab.
export const DATA_TOOLS_ACCESS_ROLES = Array.from(
  new Set([...DATA_EXPORT_ROLES, ...DATA_IMPORT_ROLES]),
);

// FET-20 — mirrors `AUDIT_READ` in `server/src/security/permissions.js`
// exactly (SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR, ADMIN — verified
// role-by-role against the backend's `rolePermissions` map, not
// guessed). Happens to be the same four roles as `ADMIN_TIER_ROLES`
// today, but kept as its own named export — mirroring how
// `DATA_EXPORT_ROLES`/`DATA_IMPORT_ROLES` are named separately above
// despite overlapping members — so a future divergence between the
// two backend permissions is visible here rather than silently
// assumed away. Gates every read surface in `modules/security-admin`
// and `modules/audit-logs`' admin viewer (dashboard, sessions list,
// account security profile, events, alerts, audit log list/detail).
export const SECURITY_ADMIN_READ_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
];

// FET-20 — mirrors `SYSTEM_ADMIN` exactly: only SOFTWARE_OWNER and
// SUPER_ADMIN hold `ALL_PERMISSIONS` in the backend's
// `rolePermissions` map; DIRECTOR/ADMIN's explicit permission lists
// do not include it. Gates `modules/security-admin`'s two mutating
// endpoints (revoke another user's session, unlock another user's
// account) — the same owner-tier bar `modules/backups` already uses
// for its own high-impact operations. UX-only: `usePermissions().has('system:admin')`
// against the live role-matrix is what `SecurityAdminPage.jsx`
// actually gates the buttons on; this list exists for anywhere a
// static role check is simpler (e.g. hiding a whole section).
export const SYSTEM_ADMIN_ROLES = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN];

/**
 * User Account Management module — mirrors the backend's new
 * `USER_ACCOUNTS_ADMIN` permission (`user_accounts:admin`), which
 * only SOFTWARE_OWNER and SUPER_ADMIN hold.
 *
 * This is deliberately narrower than `ADMIN_TIER_ROLES`: DIRECTOR
 * and ADMIN retain `USERS_READ`/`USERS_WRITE` for staff-management
 * purposes but CANNOT access the User Account Management dashboard
 * (`/dashboard/accounts`). Hiding the nav item is UX only — the
 * real boundary is `authorize(USER_ACCOUNTS_ADMIN)` on every backend
 * route in `modules/users/routes/user.routes.js`.
 */
export const USER_ACCOUNTS_ADMIN_ROLES = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN];

