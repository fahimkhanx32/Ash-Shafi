import {
  LayoutDashboard,
  HeartPulse,
  Users,
  CalendarClock,
  ListOrdered,
  Pill,
  FlaskConical,
  FileText,
  Receipt,
  MessagesSquare,
  ShieldCheck,
  Settings,
  Building2,
  UsersRound,
  Globe,
  Bell,
  BarChart3,
  FileUp,
  Plug,
  ShieldAlert,
  DatabaseBackup,
  ScrollText,
  FileSignature,
  UserCircle,
  Inbox,
} from 'lucide-react';

import {
  ROLES,
  ADMIN_TIER_ROLES,
  SYSTEM_ADMIN_ROLES,
  PATIENT_ACCESS_ROLES,
  PRESCRIPTIONS_ROLES,
  INVESTIGATIONS_REPORTS_READ_ROLES,
  REPORTS_VERIFY_ROLES,
  BILLING_ACCESS_ROLES,
  ANALYTICS_ACCESS_ROLES,
  DATA_TOOLS_ACCESS_ROLES,
  USER_ACCOUNTS_ADMIN_ROLES,
  STAFF_ROLES,
} from '../../constants/roles.js';

/**
 * FET-02 — sidebar information architecture, role-gated per
 * `allowedRoles` (UX only, mirrors `ProtectedRoute`'s convention).
 * `to: null` items describe planned modules that don't exist yet
 * (per the roadmap) and render disabled with a "Coming soon" label —
 * real navigation IA without linking to pages that would 404 or
 * faking functionality that isn't built (master prompt §79).
 * Add a real route here the same day a module ships; nothing else in
 * `Sidebar.jsx` needs to change.
 */
/**
 * i18n gap-closure pass: every item now carries `labelKey` (an
 * `nav.*` translation key) instead of a hardcoded `label`. `label` is
 * kept as an English fallback only (used as the React `key` prop and
 * as a last resort if a key is ever missing) — `Sidebar.jsx`/
 * `MobileBottomNav.jsx` render via `t(item.labelKey)`, never `.label`
 * directly.
 */
export const NAV_SECTIONS = [
  {
    items: [
      { label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, to: '/dashboard', allowedRoles: null },
    ],
  },
  {
    heading: 'Clinical',
    headingKey: 'nav.clinicalHeading',
    items: [
      {
        label: 'My clinical records',
        labelKey: 'nav.myClinicalRecords',
        icon: HeartPulse,
        to: '/dashboard/my-records',
        allowedRoles: [ROLES.PATIENT],
      },
      {
        // FET-06 — real patient list + unified workspace (which
        // includes the Gynecology/Pregnancy tabs for roles that
        // qualify). Mirrors `PATIENTS_READ`, not just the narrower
        // sensitive-records grant, since reception/general staff can
        // also open a patient's overview and appointments.
        label: 'Patients',
        labelKey: 'nav.patients',
        icon: Users,
        to: '/dashboard/patients',
        allowedRoles: PATIENT_ACCESS_ROLES,
      },
      {
        // FET-09 — full appointment calendar/booking/scheduling
        // module. Every role, incl. PATIENT (their own bookings) —
        // `AppointmentsPage` itself branches on role for what it
        // shows and which actions are offered.
        label: 'Appointments',
        labelKey: 'nav.appointments',
        icon: CalendarClock,
        to: '/dashboard/appointments',
        allowedRoles: [
          ROLES.SOFTWARE_OWNER,
          ROLES.SUPER_ADMIN,
          ROLES.DIRECTOR,
          ROLES.ADMIN,
          ROLES.DOCTOR,
          ROLES.STAFF,
          ROLES.RECEPTIONIST,
          ROLES.PATIENT,
        ],
      },
      {
        // Prescription Management & Legal 8.5"x14" Prescription Module
        label: 'Prescriptions',
        labelKey: 'nav.prescriptions',
        icon: FileSignature,
        to: '/dashboard/prescriptions',
        allowedRoles: PRESCRIPTIONS_ROLES,
      },
      {
        // FET-10 — prescriptions medicine catalog screen
        label: 'Medicines',
        labelKey: 'nav.medicines',
        icon: Pill,
        to: '/dashboard/medicines',
        allowedRoles: PRESCRIPTIONS_ROLES,
      },
      {
        // FET-11 — cross-patient investigations roster
        // (`GET /investigations` genuinely supports a roster query,
        // unlike prescriptions above — see that item's comment).
        // Ordering a new investigation stays inside a specific
        // patient's workspace tab. Mirrors `INVESTIGATIONS_READ`.
        label: 'Investigations',
        labelKey: 'nav.investigations',
        icon: FlaskConical,
        to: '/dashboard/investigations',
        allowedRoles: INVESTIGATIONS_REPORTS_READ_ROLES,
      },
      {
        // FET-11 — cross-patient medical reports roster
        // (`GET /reports`). Uploading a report stays inside a
        // specific patient's workspace tab. Mirrors `REPORTS_READ`.
        label: 'Reports',
        labelKey: 'nav.reports',
        icon: FileText,
        to: '/dashboard/reports',
        allowedRoles: INVESTIGATIONS_REPORTS_READ_ROLES,
      },
      {
        // Checkpoint 19 — Report Intake Inbox for reviewing patient-
        // submitted reports before accepting them into the chart.
        // Mirrors `REPORTS_VERIFY` (doctor / admin-tier only).
        label: 'Report Intake',
        labelKey: 'nav.reportIntake',
        icon: Inbox,
        to: '/dashboard/reports/intake',
        allowedRoles: REPORTS_VERIFY_ROLES,
      },
      {
        // FET-21 — real analytics dashboard (`AnalyticsPage.jsx`,
        // `GET /analytics/:domain`, BET-20). Mirrors
        // `ANALYTICS_READ`, the permission every domain requires at
        // minimum — the page itself further narrows which of its six
        // domain tabs a given role sees (billing/clinical need
        // additional permissions `ANALYTICS_ACCESS_ROLES` alone
        // doesn't guarantee — see `constants/analytics.js`'s
        // `ANALYTICS_DOMAIN_META`).
        label: 'Analytics',
        labelKey: 'nav.analytics',
        icon: BarChart3,
        to: '/dashboard/analytics',
        allowedRoles: ANALYTICS_ACCESS_ROLES,
      },
    ],
  },
  {
    heading: 'Operations',
    headingKey: 'nav.operationsHeading',
    items: [
      {
        // FET-09 — queue board (check-in, call, start/complete
        // consultation, no-show). Staff-only, same role set the
        // Patients nav item already uses.
        label: 'Queue',
        labelKey: 'nav.queue',
        icon: ListOrdered,
        to: '/dashboard/queue',
        allowedRoles: PATIENT_ACCESS_ROLES,
      },
      {
        // FET-12 (Patient Portal) — real invoices/payments now exist
        // (`BillingPage.jsx`). PATIENT reaches their own "My
        // invoices"/"My payments"; `BILLING_STAFF_ROLES` reach the
        // invoice roster + fee catalog instead — same page, role-
        // branched. Mirrors `BILLING_ACCESS_ROLES`
        // (`constants/roles.js`), not just the narrower staff grant,
        // since a patient must reach their own bill too.
        label: 'Billing',
        labelKey: 'nav.billing',
        icon: Receipt,
        to: '/dashboard/billing',
        allowedRoles: BILLING_ACCESS_ROLES,
      },
      {
        // FET-12 (Patient Portal) checkpoint 2 — real conversations now
        // exist (`MessagesPage.jsx`, BET-13). Restricted to PATIENT/
        // DOCTOR, matching the route's own `ProtectedRoute` gate in
        // `App.jsx` exactly (admin-tier oversight of arbitrary
        // conversations is the separate, not-yet-built FET-13 admin
        // roster — see that route's comment) — deliberately narrower
        // than `MESSAGING_ROLES` in `constants/roles.js`, which also
        // covers that future admin roster.
        label: 'Messages',
        labelKey: 'nav.messages',
        icon: MessagesSquare,
        to: '/dashboard/messages',
        allowedRoles: [ROLES.PATIENT, ROLES.DOCTOR],
      },
      {
        // FET-13 — full notification center (`NotificationsPage.jsx`,
        // `GET /notifications/me`). Every authenticated role — a
        // notification is always self-scoped to the signed-in user,
        // never gated by a permission the way Messages above is.
        label: 'Notifications',
        labelKey: 'nav.notifications',
        icon: Bell,
        to: '/dashboard/notifications',
        allowedRoles: null,
      },
      {
        // FET-21 — bulk export (`GET /exports/:entityType`,
        // `POST /exports/patients/:id/medical-record`) and bulk
        // patient import (`POST /imports/patients`). Gated on the
        // union of `DATA_EXPORT_ROLES`/`DATA_IMPORT_ROLES`;
        // `DataToolsPage.jsx` itself only renders the tab(s) the
        // signed-in role actually holds one of those two permissions
        // for (e.g. RECEPTIONIST sees Import but not Export).
        label: 'Import/Export',
        labelKey: 'nav.dataTools',
        icon: FileUp,
        to: '/dashboard/data-tools',
        allowedRoles: DATA_TOOLS_ACCESS_ROLES,
      },
    ],
  },
  {
    heading: 'Administration',
    headingKey: 'nav.administrationHeading',
    items: [
      {
        label: 'Staff',
        labelKey: 'nav.staff',
        icon: Users,
        to: '/dashboard/staff',
        allowedRoles: ADMIN_TIER_ROLES,
      },
      {
        // Closes the FET-04/05 "Departments as a real entity" gap —
        // `server/src/modules/departments` (`users:read`/`write`,
        // same reused permission pair `staff.routes.js` already
        // established for this exact "Users & Staff" bucket).
        label: 'Departments',
        labelKey: 'nav.departments',
        icon: Building2,
        to: '/dashboard/departments',
        allowedRoles: ADMIN_TIER_ROLES,
      },
      {
        // User Account Management — only SOFTWARE_OWNER and SUPER_ADMIN
        // may access this module. Deliberately narrower than the
        // ADMIN_TIER_ROLES used for Staff/Departments/Roles above;
        // the backend independently enforces this via USER_ACCOUNTS_ADMIN
        // permission on every /api/v1/users route — this is UX only.
        label: 'User Accounts',
        labelKey: 'nav.allAccounts',
        icon: UsersRound,
        to: '/dashboard/accounts',
        allowedRoles: USER_ACCOUNTS_ADMIN_ROLES,
      },
      {
        label: 'Roles & permissions',
        labelKey: 'nav.rolesPermissions',
        icon: ShieldCheck,
        to: '/dashboard/roles',
        allowedRoles: ADMIN_TIER_ROLES,
      },
      {
        // FET-16 — public website content management (navbar, hero
        // banner, services, certificates, and the homepage section
        // layout). Mirrors `WEBSITE_MANAGE`, which `ADMIN_TIER_ROLES`
        // holds exactly (see server/src/security/permissions.js).
        label: 'Website',
        labelKey: 'nav.website',
        icon: Globe,
        to: '/dashboard/website',
        allowedRoles: ADMIN_TIER_ROLES,
      },
      {
        // FET-19 — Social & External Integrations. Mirrors
        // `WEBSITE_MANAGE`, the exact permission
        // `server/src/modules/integrations/routes/integration.routes.js`
        // gates every route on (see that file's own header comment).
        label: 'Integrations',
        labelKey: 'nav.integrations',
        icon: Plug,
        to: '/dashboard/integrations',
        allowedRoles: ADMIN_TIER_ROLES,
      },
      {
        // FET-20 — Security Administration. Mirrors `AUDIT_READ`,
        // which today grants to the exact same 4 roles as
        // `ADMIN_TIER_ROLES` (verified against
        // `server/src/security/permissions.js` — see
        // `SECURITY_ADMIN_READ_ROLES`'s own comment in
        // `constants/roles.js`). The page's two mutating actions
        // (revoke session, unlock account) are additionally gated
        // live against `usePermissions().has('system:admin')`, so a
        // DIRECTOR/ADMIN reaching this page sees those buttons hidden.
        label: 'Security Administration',
        labelKey: 'nav.securityAdmin',
        icon: ShieldAlert,
        to: '/dashboard/security-admin',
        allowedRoles: ADMIN_TIER_ROLES,
      },
      {
        // FET-20 — Backup Administration. `SYSTEM_ADMIN_ROLES`
        // (SOFTWARE_OWNER, SUPER_ADMIN only) — narrower than
        // `ADMIN_TIER_ROLES` above, matching `modules/backups`'
        // own routes, which require `SYSTEM_ADMIN` outright with
        // no lower `AUDIT_READ` read tier.
        label: 'Backup Administration',
        labelKey: 'nav.backups',
        icon: DatabaseBackup,
        to: '/dashboard/backups',
        allowedRoles: SYSTEM_ADMIN_ROLES,
      },
      {
        // FET-20 — Audit Administration, checkpoint 1 (Audit log,
        // User activity, Administrative activity). `ADMIN_TIER_ROLES`
        // — same `AUDIT_READ`-mirroring boundary Security
        // Administration above uses, since both read from routes
        // gated on that identical permission.
        label: 'Audit Administration',
        labelKey: 'nav.auditAdmin',
        icon: ScrollText,
        to: '/dashboard/audit-admin',
        allowedRoles: ADMIN_TIER_ROLES,
      },
      {
        label: 'My Profile',
        labelKey: 'nav.myProfile',
        icon: UserCircle,
        to: '/dashboard/my-profile',
        // Every non-PATIENT role has a StaffProfile to self-edit here
        // (`GET/PATCH /staff/me`) — a PATIENT has none, so this stays
        // out of the patient portal's nav entirely.
        allowedRoles: STAFF_ROLES,
      },
      {
        label: 'My details',
        labelKey: 'nav.myDetails',
        icon: UserCircle,
        to: '/dashboard/my-details',
        // PATIENT self-service (`GET/PATCH /patients/me`) — the patient
        // counterpart of staff "My Profile".
        allowedRoles: [ROLES.PATIENT],
      },
      {
        label: 'Settings',
        labelKey: 'nav.settings',
        icon: Settings,
        to: '/dashboard/settings',
        allowedRoles: null,
      },
    ],
  },
];
