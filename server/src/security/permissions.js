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

export const PERMISSIONS = Object.freeze({
  SYSTEM_ADMIN: 'system:admin',

  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',

  /**
   * USER_ACCOUNTS_ADMIN — exclusive gate for the User Account
   * Management module (Dashboard → Administration → User Accounts).
   * Only SOFTWARE_OWNER and SUPER_ADMIN hold this permission.
   * DIRECTOR and ADMIN retain USERS_READ/WRITE for their own
   * staff-administration purposes, but those permissions do NOT
   * grant access to the account-management module's routes.
   *
   * Every route under /api/v1/users that is part of the User
   * Account Management dashboard is gated on this permission.
   * This is separate from SYSTEM_ADMIN to allow SUPER_ADMIN to
   * hold it without implying full system ownership.
   */
  USER_ACCOUNTS_ADMIN: 'user_accounts:admin',

  PATIENTS_READ: 'patients:read',
  PATIENTS_WRITE: 'patients:write',

  DOCTORS_READ: 'doctors:read',
  DOCTORS_WRITE: 'doctors:write',

  APPOINTMENTS_READ: 'appointments:read',
  APPOINTMENTS_WRITE: 'appointments:write',

  MEDICAL_RECORDS_READ: 'medical_records:read',
  MEDICAL_RECORDS_WRITE: 'medical_records:write',

  PRESCRIPTIONS_READ: 'prescriptions:read',
  PRESCRIPTIONS_WRITE: 'prescriptions:write',

  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',

  // Narrower than BILLING_WRITE — governs only invoice creation/
  // discount/cancellation, never the Fee price catalog. Lets a role
  // (DOCTOR) charge a patient for the visit it just treated without
  // also being able to edit the clinic-wide price list, which stays
  // BILLING_WRITE-only. See ROLES.DOCTOR below and
  // `billing.routes.js`'s `authorizeAny([BILLING_WRITE, INVOICES_WRITE])`
  // on the three invoice-mutation routes.
  INVOICES_WRITE: 'invoices:write',

  AUDIT_READ: 'audit:read',

  // BET-04 — RBAC administration itself.
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  PERMISSIONS_READ: 'permissions:read',

  // BET-04 — sensitive-record authorization foundation. These are
  // deliberately separate from MEDICAL_RECORDS_* / PATIENTS_* so a
  // role (e.g. RECEPTIONIST) can be granted ordinary patient/medical
  // record access without automatically also gaining access to
  // reproductive/sexual-health history (master prompt section 16).
  // The gynecology/obstetric modules themselves are built in
  // BET-07/BET-08; this only establishes the permission constants
  // and default grants so later modules have something real to
  // check against instead of reusing the broader medical-records
  // permission.
  SENSITIVE_RECORDS_READ: 'sensitive_records:read',
  SENSITIVE_RECORDS_WRITE: 'sensitive_records:write',

  // Public website CMS content (master prompt §14/§39 — "website.manage").
  // Reads are public/unauthenticated (the marketing site itself); this
  // only gates the admin write endpoints.
  WEBSITE_MANAGE: 'website:manage',
  // BET-16 Checkpoint 2 — deliberately separate from WEBSITE_MANAGE,
  // mirroring the REPORTS_WRITE/REPORTS_VERIFY split already used for
  // investigations: editing/drafting page content is a broader,
  // lower-stakes capability than actually making it live on the
  // public site. A role can be granted WEBSITE_MANAGE (draft/edit)
  // without WEBSITE_PUBLISH (go live), so a content editor can't
  // publish unreviewed changes on their own.
  WEBSITE_PUBLISH: 'website:publish',

  // BET-12 — Investigations & Medical Reports. Deliberately their own
  // pair rather than reusing MEDICAL_RECORDS_* — ordering/managing
  // investigations and uploading/reviewing reports is a narrower,
  // lab/clinical-workflow-specific capability than general medical-
  // history read/write, and a future lab-technician-style role should
  // be grantable this without also getting the broader medical-record
  // permission. Reproductive/sexual-health-flagged reports additionally
  // go through `SENSITIVE_RECORDS_READ`/`WRITE` (reused from BET-07) on
  // top of these — see `modules/reports/services/report-access.service.js`.
  INVESTIGATIONS_READ: 'investigations:read',
  INVESTIGATIONS_WRITE: 'investigations:write',
  REPORTS_READ: 'reports:read',
  REPORTS_WRITE: 'reports:write',
  // Doctor clinical sign-off on extracted/manual result data
  // (BET-12.14) — separate from REPORTS_WRITE (which covers upload/
  // amend) so verification can later be restricted to DOCTOR/admin-
  // tier roles only, without blocking a nurse/receptionist-style role
  // from uploading a report in the first place.
  REPORTS_VERIFY: 'reports:verify',

  // Patient/staff report intake. Deliberately narrower than
  // REPORTS_WRITE (which also covers cancel/reject/manual-entry/retry):
  //  - REPORTS_SUBMIT: a PATIENT submitting their OWN report to a
  //    doctor. Never lets the caller name a different patient — the
  //    patient profile is always resolved from the caller's identity.
  //  - REPORTS_UPLOAD: staff (nurse / assistant / receptionist /
  //    doctor) dropping a document into ANY patient's file on the
  //    patient's behalf. Upload-only: does not imply read access to
  //    reports or any of the REPORTS_WRITE mutations.
  // Both create an unverified submission that lands in the routed
  // doctor's intake inbox; neither can verify or finalize anything.
  REPORTS_SUBMIT: 'reports:submit',
  REPORTS_UPLOAD: 'reports:upload',

  // BET-13 — secure patient-doctor messaging (conversations, messages,
  // attachments, voice messages). Deliberately its own pair rather
  // than reusing APPOINTMENTS_*/MEDICAL_RECORDS_* — the ability to use
  // the messaging feature at all is a role-level grant, but which
  // specific conversation a caller may read/write is always resolved
  // by conversation membership in the service layer (master prompt
  // §30 — no staff role, however senior, gets an implicit backdoor
  // into a specific patient-doctor conversation's content by holding
  // this permission alone).
  MESSAGING_READ: 'messaging:read',
  MESSAGING_WRITE: 'messaging:write',

  // BET-13 — in-app/email/SMS/WhatsApp notifications. Every
  // authenticated user can always read and manage their own
  // notifications/preferences (identity-resolved, no permission
  // needed — same `/me` shape as appointments/patients). This
  // permission only gates the administrative capability to create a
  // notification addressed to *other* users (system/broadcast
  // notices) — see `modules/notifications`.
  NOTIFICATIONS_MANAGE: 'notifications:manage',

  // BET-19 — Import/Export & Data Interoperability, "Export
  // authorization" checkpoint. Deliberately an *additional*, narrower
  // gate layered on top of each entity's own native read/write
  // permission (`EXPORT_ENTITY_PERMISSION` in
  // `modules/exports/constants/export.constants.js` still enforces
  // the per-entity check first) — not a replacement for it. Holding
  // `PATIENTS_READ` lets a caller view patients one at a time through
  // the ordinary API; it does not by itself justify pulling the
  // entire list out as a CSV/XLSX/PDF/JSON file or a full single-
  // patient medical-record package. Bulk extraction and bulk
  // creation are meaningfully higher-risk than their one-record-at-a-
  // time equivalents, so they get their own opt-in grant rather than
  // silently inheriting from whatever native permission already
  // exists — the same "an interoperability surface never grants
  // wider access than this project's own native routes" principle
  // FHIR/export already document, just enforced with its own switch
  // instead of assumed.
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // BET-20 — Secure Analytics. Three separate gates rather than one
  // broad "analytics:read", deliberately mirroring the BET-19
  // DATA_EXPORT rationale above: analytics is its own read surface,
  // independent of (and narrower/broader by domain than) each
  // entity's native read permission, and the different domains carry
  // very different sensitivity levels.
  //
  // ANALYTICS_READ — operational analytics: appointments, queue,
  // staff metrics. The day-to-day "how is the clinic running today"
  // surface; the widest-granted of the three.
  //
  // ANALYTICS_BILLING_READ — revenue/billing analytics, kept separate
  // from ANALYTICS_READ so a role can see operational throughput
  // without also seeing aggregate financial performance (master
  // prompt §51 groups "revenue"/"billing" with the same "sensitive
  // analytics must use permission control" language as clinical
  // stats) — financial reporting is treated as its own admin-tier
  // concern here, same as BILLING_READ/WRITE already are.
  //
  // ANALYTICS_CLINICAL_READ — consultation/prescription/investigation/
  // pregnancy statistics. The narrowest of the three: master prompt
  // §51 explicitly calls out "sensitive analytics must use permission
  // control" and "where possible, use aggregated/de-identified data",
  // so this gates access to the endpoint itself, while the service
  // layer (`modules/analytics/services/clinical-statistics.service.js`)
  // separately enforces the de-identification/minimum-cohort-size
  // side of that same requirement — holding this permission is
  // necessary but not sufficient to see a small, potentially
  // re-identifiable bucket.
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_BILLING_READ: 'analytics:billing_read',
  ANALYTICS_CLINICAL_READ: 'analytics:clinical_read',
});

/**
 * Groups permissions for display/administration purposes (e.g. the
 * role-editor UI in a future FET task, and the `GET /permissions`
 * catalog endpoint added in BET-04). Purely descriptive metadata —
 * has no effect on enforcement, which is always driven by the
 * `PERMISSIONS` values themselves.
 */
export const PERMISSION_GROUPS = Object.freeze([
  {
    key: 'system',
    label: 'System Administration',
    permissions: [PERMISSIONS.SYSTEM_ADMIN],
  },
  {
    // USER_ACCOUNTS_ADMIN is deliberately its own top-level group
    // rather than nested under 'users' — it is a narrower, more
    // privileged capability than the general staff-management
    // USERS_READ/WRITE pair, and keeping it visually separate in
    // the permission catalog makes its exclusivity obvious.
    key: 'user_accounts_admin',
    label: 'User Account Management (Owner / Super Admin only)',
    permissions: [PERMISSIONS.USER_ACCOUNTS_ADMIN],
  },
  {
    key: 'rbac',
    label: 'Roles & Permissions',
    permissions: [
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_WRITE,
      PERMISSIONS.PERMISSIONS_READ,
    ],
  },
  {
    key: 'users',
    label: 'Users & Staff',
    permissions: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_WRITE],
  },
  {
    key: 'patients',
    label: 'Patients',
    permissions: [PERMISSIONS.PATIENTS_READ, PERMISSIONS.PATIENTS_WRITE],
  },
  {
    key: 'doctors',
    label: 'Doctors',
    permissions: [PERMISSIONS.DOCTORS_READ, PERMISSIONS.DOCTORS_WRITE],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    permissions: [
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_WRITE,
    ],
  },
  {
    key: 'medical_records',
    label: 'Medical Records',
    permissions: [
      PERMISSIONS.MEDICAL_RECORDS_READ,
      PERMISSIONS.MEDICAL_RECORDS_WRITE,
    ],
  },
  {
    key: 'sensitive_records',
    label: 'Sensitive Reproductive / Sexual Health Records',
    permissions: [
      PERMISSIONS.SENSITIVE_RECORDS_READ,
      PERMISSIONS.SENSITIVE_RECORDS_WRITE,
    ],
  },
  {
    key: 'prescriptions',
    label: 'Prescriptions',
    permissions: [
      PERMISSIONS.PRESCRIPTIONS_READ,
      PERMISSIONS.PRESCRIPTIONS_WRITE,
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    permissions: [PERMISSIONS.BILLING_READ, PERMISSIONS.BILLING_WRITE],
  },
  {
    key: 'audit',
    label: 'Audit',
    permissions: [PERMISSIONS.AUDIT_READ],
  },
  {
    key: 'website',
    label: 'Website Content',
    permissions: [PERMISSIONS.WEBSITE_MANAGE, PERMISSIONS.WEBSITE_PUBLISH],
  },
  {
    key: 'investigations',
    label: 'Investigations & Medical Reports',
    permissions: [
      PERMISSIONS.INVESTIGATIONS_READ,
      PERMISSIONS.INVESTIGATIONS_WRITE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_WRITE,
      PERMISSIONS.REPORTS_VERIFY,
      PERMISSIONS.REPORTS_SUBMIT,
      PERMISSIONS.REPORTS_UPLOAD,
    ],
  },
  {
    key: 'messaging',
    label: 'Messaging & Notifications',
    permissions: [
      PERMISSIONS.MESSAGING_READ,
      PERMISSIONS.MESSAGING_WRITE,
      PERMISSIONS.NOTIFICATIONS_MANAGE,
    ],
  },
  {
    key: 'data-interop',
    label: 'Import / Export & Interoperability',
    permissions: [PERMISSIONS.DATA_EXPORT, PERMISSIONS.DATA_IMPORT],
  },
  {
    key: 'analytics',
    label: 'Analytics & Reporting',
    permissions: [
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ANALYTICS_BILLING_READ,
      PERMISSIONS.ANALYTICS_CLINICAL_READ,
    ],
  },
]);

const ALL_PERMISSIONS = Object.freeze(
  Object.values(PERMISSIONS),
);

// Re-exported for consumers that genuinely need the full set
// (e.g. a future permissions-catalog endpoint that lists everything).
export { ALL_PERMISSIONS };

const rolePermissions = {
  // SOFTWARE_OWNER and SUPER_ADMIN receive every permission,
  // including the exclusive USER_ACCOUNTS_ADMIN gate. No other role
  // receives USER_ACCOUNTS_ADMIN in any explicit permission list
  // below (enforced by never referencing it in any other role's set).
  [ROLES.SOFTWARE_OWNER]: new Set(ALL_PERMISSIONS),

  [ROLES.SUPER_ADMIN]: new Set(ALL_PERMISSIONS),

  [ROLES.DIRECTOR]: new Set([
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,

    PERMISSIONS.ROLES_READ,
    PERMISSIONS.PERMISSIONS_READ,

    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_WRITE,

    PERMISSIONS.DOCTORS_READ,
    PERMISSIONS.DOCTORS_WRITE,

    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,

    PERMISSIONS.MEDICAL_RECORDS_READ,
    PERMISSIONS.MEDICAL_RECORDS_WRITE,

    PERMISSIONS.SENSITIVE_RECORDS_READ,
    PERMISSIONS.SENSITIVE_RECORDS_WRITE,

    PERMISSIONS.PRESCRIPTIONS_READ,
    PERMISSIONS.PRESCRIPTIONS_WRITE,

    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_WRITE,

    PERMISSIONS.AUDIT_READ,

    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.WEBSITE_PUBLISH,

    PERMISSIONS.INVESTIGATIONS_READ,
    PERMISSIONS.INVESTIGATIONS_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_WRITE,
    PERMISSIONS.REPORTS_VERIFY,
    PERMISSIONS.REPORTS_UPLOAD,

    PERMISSIONS.MESSAGING_READ,
    PERMISSIONS.MESSAGING_WRITE,
    PERMISSIONS.NOTIFICATIONS_MANAGE,

    // BET-19 — bulk data extraction/onboarding is an administrative-
    // tier capability at this level of seniority.
    PERMISSIONS.DATA_EXPORT,
    PERMISSIONS.DATA_IMPORT,

    // BET-20 — full analytics access: operational, financial, and
    // clinical statistics all belong at this level of seniority.
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_BILLING_READ,
    PERMISSIONS.ANALYTICS_CLINICAL_READ,
  ]),

  [ROLES.ADMIN]: new Set([
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,

    PERMISSIONS.ROLES_READ,
    PERMISSIONS.PERMISSIONS_READ,

    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_WRITE,

    PERMISSIONS.DOCTORS_READ,
    PERMISSIONS.DOCTORS_WRITE,

    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,

    PERMISSIONS.MEDICAL_RECORDS_READ,
    PERMISSIONS.MEDICAL_RECORDS_WRITE,

    PERMISSIONS.PRESCRIPTIONS_READ,
    PERMISSIONS.PRESCRIPTIONS_WRITE,

    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_WRITE,

    PERMISSIONS.AUDIT_READ,

    PERMISSIONS.WEBSITE_MANAGE,
    // Deliberately no WEBSITE_PUBLISH here — same rationale as the
    // REPORTS_VERIFY exclusion above: ADMIN can draft/edit pages,
    // upload media, and manage CMS content, but making a page live on
    // the public site is reserved for DIRECTOR/SUPER_ADMIN/
    // SOFTWARE_OWNER. — clinical sign-off on an
    // extracted/manual result is a doctor judgment call (master prompt
    // §BET-12.14/§94), not an administrative one. ADMIN can still
    // order investigations and manage report uploads/metadata.
    PERMISSIONS.INVESTIGATIONS_READ,
    PERMISSIONS.INVESTIGATIONS_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_WRITE,
    PERMISSIONS.REPORTS_UPLOAD,

    // ADMIN can send administrative/system-wide notifications (e.g.
    // a clinic closure notice), but does not automatically get
    // MESSAGING_* — ordinary administrative staff are not a party to
    // clinical patient-doctor conversations by default (master
    // prompt §30 chat privacy); that stays DOCTOR/PATIENT plus the
    // DIRECTOR/SUPER_ADMIN/SOFTWARE_OWNER admin tier above.
    PERMISSIONS.NOTIFICATIONS_MANAGE,

    // BET-19 — same rationale as DIRECTOR above.
    PERMISSIONS.DATA_EXPORT,
    PERMISSIONS.DATA_IMPORT,

    // BET-20 — same rationale as DIRECTOR above: ADMIN runs day-to-day
    // operations and needs the full analytics picture, financial
    // included.
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_BILLING_READ,
    PERMISSIONS.ANALYTICS_CLINICAL_READ,
  ]),

  [ROLES.DOCTOR]: new Set([
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_WRITE,

    PERMISSIONS.DOCTORS_READ,

    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,

    PERMISSIONS.MEDICAL_RECORDS_READ,
    PERMISSIONS.MEDICAL_RECORDS_WRITE,

    PERMISSIONS.SENSITIVE_RECORDS_READ,
    PERMISSIONS.SENSITIVE_RECORDS_WRITE,

    PERMISSIONS.PRESCRIPTIONS_READ,
    PERMISSIONS.PRESCRIPTIONS_WRITE,

    PERMISSIONS.INVESTIGATIONS_READ,
    PERMISSIONS.INVESTIGATIONS_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_WRITE,
    PERMISSIONS.REPORTS_VERIFY,
    PERMISSIONS.REPORTS_UPLOAD,

    PERMISSIONS.MESSAGING_READ,
    PERMISSIONS.MESSAGING_WRITE,

    // BET-19 — a doctor may pull a single patient's medical-record
    // package (referral, second opinion) or their own encounter/
    // prescription history as a file; deliberately no DATA_IMPORT —
    // bulk patient onboarding is a front-desk/admin workflow, not a
    // clinical one.
    PERMISSIONS.DATA_EXPORT,

    // BET-20 — a doctor may see operational analytics (their own
    // appointment/queue throughput) and clinical statistics, but
    // deliberately no ANALYTICS_BILLING_READ — practice revenue is
    // not a clinical concern. Operational analytics is further scoped
    // to the doctor's own data at the service layer (see
    // `modules/analytics/services/*` — a DOCTOR caller can never pass
    // a different doctor's id and see their throughput instead).
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_CLINICAL_READ,
    // A doctor may bill for the visit they just treated — new
    // consultation, follow-up, reviewing/reading a report, or any
    // other service — without also being able to edit the clinic's
    // price list (no BILLING_WRITE, which still gates the Fee
    // catalog). Scoped at the service layer (`invoice.service.js`'s
    // `assertCanAccessAsSelf`/`listInvoices`) to invoices the doctor
    // themself issued — a doctor can create freely but can only see/
    // amend their own invoices, never another doctor's or the
    // clinic's full billing roster (that stays BILLING_READ, held by
    // billing-staff roles only — mirrors the ANALYTICS_BILLING_READ
    // split just above: an individual charge is a clinical act, the
    // aggregate books are not).
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.INVOICES_WRITE,
  ]),

  [ROLES.STAFF]: new Set([
    PERMISSIONS.PATIENTS_READ,

    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,

    // A lab/imaging-technician-style user (the closest fit this fixed
    // catalog has — master prompt §14 lists "Medical Assistant" as a
    // possible role but ROLES only defines the 8 already established
    // through BET-04) needs to upload reports and manage the
    // investigation lifecycle, but never clinically verifies a result
    // (no REPORTS_VERIFY) and never orders a new investigation on
    // their own authority (no INVESTIGATIONS_WRITE — that stays a
    // doctor/admin decision).
    PERMISSIONS.INVESTIGATIONS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_WRITE,
    PERMISSIONS.REPORTS_UPLOAD,
  ]),

  [ROLES.RECEPTIONIST]: new Set([
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_WRITE,

    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,

    // BET-15 — the front desk is who actually issues invoices and
    // takes cash/bank-transfer/card payments day-to-day in this
    // clinic's real workflow; without this, no one below ADMIN/
    // DIRECTOR could record a manual payment or print a receipt,
    // which would make the payment module unusable in practice.
    // Deliberately still excluded from every other clinical
    // permission (no MEDICAL_RECORDS_*/SENSITIVE_RECORDS_*/etc.) —
    // this is billing-desk access only, not broadened clinical access.
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_WRITE,

    // Upload-only: front-desk staff may attach a document to a patient's
    // file when the patient cannot do it themselves. No report read access.
    PERMISSIONS.REPORTS_UPLOAD,

    // BET-19 — reception is who actually runs bulk patient
    // onboarding (e.g. migrating a paper register via CSV/XLSX) in
    // this clinic's real workflow; deliberately no DATA_EXPORT —
    // pulling the whole patient database out as a file stays an
    // admin-tier capability, not a front-desk one.
    PERMISSIONS.DATA_IMPORT,

    // BET-20 — reception runs the daily queue and books/cancels
    // appointments, so front-desk operational visibility (today's
    // queue wait times, no-show rates, appointment volume) is part
    // of that job. Deliberately no ANALYTICS_BILLING_READ (front
    // desk records payments but doesn't see aggregate revenue
    // reporting — same split BILLING_READ/WRITE already draws
    // between recording a transaction and analyzing the books) and
    // no ANALYTICS_CLINICAL_READ (never a clinical role).
    PERMISSIONS.ANALYTICS_READ,
  ]),

  [ROLES.PATIENT]: new Set([
    // A patient must be able to browse the active doctor list to book
    // an appointment (BookAppointmentDialog/AppointmentsPage call
    // GET /staff/doctors) — read-only, no DOCTORS_WRITE.
    PERMISSIONS.DOCTORS_READ,

    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,

    PERMISSIONS.MESSAGING_READ,
    PERMISSIONS.MESSAGING_WRITE,

    // Submit their OWN report to a doctor (see REPORTS_SUBMIT above).
    PERMISSIONS.REPORTS_SUBMIT,
  ]),
};

export const ROLE_HIERARCHY = Object.freeze([
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.STAFF,
  ROLES.RECEPTIONIST,
  ROLES.PATIENT,
]);

export const hasPermission = (role, permission) => {
  const permissions = rolePermissions[role];

  if (!permissions) {
    return false;
  }

  return permissions.has(permission);
};

export const hasAnyPermission = (role, permissions) => {
  if (!Array.isArray(permissions)) {
    return false;
  }

  return permissions.some((permission) =>
    hasPermission(role, permission),
  );
};

export const hasAllPermissions = (role, permissions) => {
  if (!Array.isArray(permissions)) {
    return false;
  }

  return permissions.every((permission) =>
    hasPermission(role, permission),
  );
};

export const getRolePermissions = (role) => {
  const permissions = rolePermissions[role] ?? new Set();

  return Object.freeze([
    ...permissions,
  ]);
};

export const isValidRole = (role) => {
  return ROLE_HIERARCHY.includes(role);
};

export const getRoleLevel = (role) => {
  const index = ROLE_HIERARCHY.indexOf(role);

  return index === -1 ? -1 : ROLE_HIERARCHY.length - index;
};

export const canManageRole = (actorRole, targetRole) => {
  if (
    actorRole === ROLES.SOFTWARE_OWNER
  ) {
    return true;
  }

  if (
    actorRole === targetRole &&
    actorRole !== ROLES.SUPER_ADMIN
  ) {
    return false;
  }

  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
};

export const isProtectedRole = (role) => {
  return (
    role === ROLES.SOFTWARE_OWNER
  );
};