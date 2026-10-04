import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';

import GuestRoute from '../components/auth/GuestRoute.jsx';
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx';

import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import ForgotPasswordPage from '../pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../pages/ResetPasswordPage.jsx';
import VerifyEmailPage from '../pages/VerifyEmailPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import UnauthorizedPage from '../pages/UnauthorizedPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import MyClinicalRecordsPage from '../pages/clinical/MyClinicalRecordsPage.jsx';
import ConsultationPage from '../pages/clinical/ConsultationPage.jsx';
import PrescriptionWorkspacePage from '../pages/clinical/PrescriptionWorkspacePage.jsx';
import LabRequisitionWorkspacePage from '../pages/clinical/LabRequisitionWorkspacePage.jsx';
import PrescriptionsPage from '../pages/PrescriptionsPage.jsx';
import VerifyPrescriptionPage from '../pages/VerifyPrescriptionPage.jsx';
import PatientsListPage from '../pages/PatientsListPage.jsx';
import PatientWorkspacePage from '../pages/PatientWorkspacePage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import MyProfilePage from '../pages/MyProfilePage.jsx';
import PatientMyDetailsPage from '../pages/PatientMyDetailsPage.jsx';
import SecurityPage from '../pages/SecurityPage.jsx';
import StaffListPage from '../pages/StaffListPage.jsx';
import StaffDetailPage from '../pages/StaffDetailPage.jsx';
import RolesPermissionsPage from '../pages/RolesPermissionsPage.jsx';
import WebsiteManagementPage from '../pages/WebsiteManagementPage.jsx';
import IntegrationsPage from '../pages/IntegrationsPage.jsx';
import SecurityAdminPage from '../pages/SecurityAdminPage.jsx';
import BackupsPage from '../pages/BackupsPage.jsx';
import AuditAdminPage from '../pages/AuditAdminPage.jsx';
import DepartmentsPage from '../pages/DepartmentsPage.jsx';
import AllAccountsPage from '../pages/AllAccountsPage.jsx';
import AccountDetailPage from '../pages/AccountDetailPage.jsx';
import AppointmentsPage from '../pages/AppointmentsPage.jsx';
import QueuePage from '../pages/QueuePage.jsx';
import MedicinesPage from '../pages/MedicinesPage.jsx';
import InvestigationsPage from '../pages/InvestigationsPage.jsx';
import ReportsPage from '../pages/ReportsPage.jsx';
import DoctorReportIntakePage from '../pages/DoctorReportIntakePage.jsx';
import BillingPage from '../pages/BillingPage.jsx';
import MessagesPage from '../pages/MessagesPage.jsx';
import NotificationsPage from '../pages/NotificationsPage.jsx';
import VideoConsultationPage from '../pages/VideoConsultationPage.jsx';
import AnalyticsPage from '../pages/AnalyticsPage.jsx';
import DataToolsPage from '../pages/DataToolsPage.jsx';
import AppShell from '../components/layout/AppShell.jsx';
import {
  SENSITIVE_RECORDS_ROLES,
  ADMIN_TIER_ROLES,
  SYSTEM_ADMIN_ROLES,
  PATIENT_ACCESS_ROLES,
  MEDICAL_RECORDS_WRITE_ROLES,
  PRESCRIPTIONS_ROLES,
  PRESCRIPTIONS_WRITE_ROLES,
  INVESTIGATIONS_REPORTS_READ_ROLES,
  REPORTS_VERIFY_ROLES,
  BILLING_ACCESS_ROLES,
  ANALYTICS_ACCESS_ROLES,
  DATA_TOOLS_ACCESS_ROLES,
  USER_ACCOUNTS_ADMIN_ROLES,
  STAFF_ROLES,
  ROLES,
} from '../constants/roles.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';

/**
 * FET-06 — `/dashboard/clinical/:patientProfileId` (FET-07) predates
 * the unified patient workspace. Rather than break any existing deep
 * link/bookmark to it (master prompt §81 — no destructive changes),
 * it now redirects into the workspace's Gynecology tab, which
 * mounts the exact same `GynecologyPanel`.
 */
function ClinicalRecordRedirect() {
  const { patientProfileId } = useParams();
  return <Navigate to={`/dashboard/patients/${patientProfileId}?tab=gynecology`} replace />;
}

/**
 * FET-04 — one-time "your session expired" toast. `AuthProvider` sets
 * `sessionEvent: 'expired'` only when the axios interceptor
 * (`services/apiClient.js`) discovers the refresh token itself is
 * dead — not on an ordinary user-initiated sign-out — so this never
 * fires for a normal logout. Lives here (inside every provider, per
 * `main.jsx`'s nesting order) rather than inside `AuthProvider`
 * itself, since `useToast()` isn't available that high up the tree.
 */
function SessionExpiredWatcher() {
  const { sessionEvent, acknowledgeSessionEvent } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (sessionEvent === 'expired') {
      toast({
        title: 'Session expired',
        description: 'Please sign in again to continue.',
        variant: 'info',
        duration: 6000,
      });
      acknowledgeSessionEvent();
    }
  }, [sessionEvent, acknowledgeSessionEvent, toast]);

  return null;
}

export default function App() {
  return (
    <>
      <SessionExpiredWatcher />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Guest-only: redirect an already-authenticated user away */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Token-link pages: reachable regardless of auth state */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/verify/:token" element={<VerifyPrescriptionPage />} />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected — every /dashboard/* route renders inside the shared
            FET-02 app shell (sidebar + topbar). Any authenticated user
            reaches AppShell; individual routes below layer on their own
            role gate via a nested ProtectedRoute where needed. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* FET-03 — any authenticated user (all roles) */}
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route element={<ProtectedRoute allowedRoles={STAFF_ROLES} />}>
              <Route path="/dashboard/my-profile" element={<MyProfilePage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['PATIENT']} />}>
              <Route path="/dashboard/my-details" element={<PatientMyDetailsPage />} />
            </Route>
            {/* FET-04 — any authenticated user (all roles) */}
            <Route path="/dashboard/security" element={<SecurityPage />} />

            {/* FET-09 — Appointment Calendar, Scheduling & Queue.
                Appointments: every role, incl. PATIENT (their own
                bookings/self-service — AppointmentsPage branches on
                role). Queue board is staff-only, same role set as
                the patient workspace (`PATIENT_ACCESS_ROLES`). */}
            <Route path="/dashboard/appointments" element={<AppointmentsPage />} />
            <Route element={<ProtectedRoute allowedRoles={PATIENT_ACCESS_ROLES} />}>
              <Route path="/dashboard/queue" element={<QueuePage />} />
            </Route>

            {/* FET-06 — Patient Management, Profile & unified Patient
                Workspace (Overview, Medical History, and — where the
                signed-in role qualifies — Gynecology, Pregnancy,
                Consultations, Appointments, plus honest placeholders
                for the modules not yet built). Mirrors `PATIENTS_READ`. */}
            <Route element={<ProtectedRoute allowedRoles={PATIENT_ACCESS_ROLES} />}>
              <Route path="/dashboard/patients" element={<PatientsListPage />} />
              <Route path="/dashboard/patients/:patientProfileId" element={<PatientWorkspacePage />} />
            </Route>

            {/* FET-08 — Consultation & Clinical Encounters: the full
                consultation workspace (create, examination/diagnosis/
                treatment-plan/follow-up, save draft, finalize, amend).
                Mirrors `MEDICAL_RECORDS_READ`/`WRITE`, same role set
                the Consultations tab itself is already gated on. */}
            <Route element={<ProtectedRoute allowedRoles={MEDICAL_RECORDS_WRITE_ROLES} />}>
              <Route
                path="/dashboard/patients/:patientProfileId/consultations/:encounterId"
                element={<ConsultationPage />}
              />
            </Route>

            {/* Prescription Workspace & Roster (Legal 8.5" × 14" Dual-Pane Workspace) */}
            <Route element={<ProtectedRoute allowedRoles={PRESCRIPTIONS_ROLES} />}>
              <Route path="/dashboard/prescriptions" element={<PrescriptionsPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={PRESCRIPTIONS_WRITE_ROLES} />}>
              <Route
                path="/dashboard/patients/:patientProfileId/prescriptions/new"
                element={<PrescriptionWorkspacePage />}
              />
              <Route
                path="/dashboard/patients/:patientProfileId/prescriptions/:prescriptionId/edit"
                element={<PrescriptionWorkspacePage />}
              />
            </Route>

            {/* FET-10 — Prescription, Medicine & A4 Prescription: the
                medicine reference-catalog management screen. */}
            <Route element={<ProtectedRoute allowedRoles={PRESCRIPTIONS_ROLES} />}>
              <Route path="/dashboard/medicines" element={<MedicinesPage />} />
            </Route>

            {/* FET-11 — Investigations, Medical Reports & File
                Management: cross-patient rosters backed by the real
                `GET /investigations`/`GET /reports` list endpoints
                (unlike FET-10's prescriptions, which has no such
                endpoint — see the medicines route comment above and
                `navConfig.js`). Ordering/uploading still only happens
                inside a specific patient's workspace tabs. Mirrors
                `INVESTIGATIONS_REPORTS_READ_ROLES`. */}
            <Route element={<ProtectedRoute allowedRoles={INVESTIGATIONS_REPORTS_READ_ROLES} />}>
              <Route path="/dashboard/investigations" element={<InvestigationsPage />} />
              <Route path="/dashboard/reports" element={<ReportsPage />} />
              <Route
                path="/dashboard/patients/:patientProfileId/lab-requisitions/new"
                element={<LabRequisitionWorkspacePage />}
              />
              <Route
                path="/dashboard/patients/:patientProfileId/lab-requisitions/:requisitionId"
                element={<LabRequisitionWorkspacePage />}
              />
              <Route
                path="/dashboard/lab-requisitions/new"
                element={<LabRequisitionWorkspacePage />}
              />
            </Route>
            {/* Checkpoint 19 — Report Intake Inbox: review patient-submitted reports before
                accepting them into the chart. Mirrors REPORTS_VERIFY (doctor + admin-tier). */}
            <Route element={<ProtectedRoute allowedRoles={REPORTS_VERIFY_ROLES} />}>
              <Route path="/dashboard/reports/intake" element={<DoctorReportIntakePage />} />
            </Route>

            {/* FET-21 — analytics dashboard (`GET /analytics/:domain`,
                BET-20). Mirrors `ANALYTICS_READ`, the permission every
                one of the six domains requires at minimum;
                `AnalyticsPage` itself further narrows which tabs a
                given role can see (billing/clinical need additional
                permissions this route-level gate alone doesn't
                guarantee). */}
            <Route element={<ProtectedRoute allowedRoles={ANALYTICS_ACCESS_ROLES} />}>
              <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
            </Route>

            {/* FET-21 — bulk export/import (`GET /exports/:entityType`,
                `POST /exports/patients/:id/medical-record`,
                `POST /imports/patients`). Gated on the union of
                `DATA_EXPORT_ROLES`/`DATA_IMPORT_ROLES`; `DataToolsPage`
                itself only renders the tab(s) the signed-in role
                actually holds one of those two permissions for. */}
            <Route element={<ProtectedRoute allowedRoles={DATA_TOOLS_ACCESS_ROLES} />}>
              <Route path="/dashboard/data-tools" element={<DataToolsPage />} />
            </Route>

            {/* FET-12 (Patient Portal) — billing/payments. PATIENT
                reaches their own invoices/payments self-service;
                `BILLING_STAFF_ROLES` reach the invoice roster + fee
                catalog instead — `BillingPage` itself branches on
                role (see `constants/roles.js`'s `BILLING_ACCESS_ROLES`
                comment for the exact split). */}
            <Route element={<ProtectedRoute allowedRoles={BILLING_ACCESS_ROLES} />}>
              <Route path="/dashboard/billing" element={<BillingPage />} />
            </Route>

            {/* FET-12 (Patient Portal) checkpoint 2 — secure patient-
                doctor messaging (BET-13). Restricted to PATIENT/
                DOCTOR — those are the only two roles `GET
                /conversations/me` returns anything for; admin-tier
                oversight of arbitrary conversations is the separate,
                not-yet-built FET-13 admin roster (`GET
                /conversations` with an explicit patient/doctor
                filter, mirrors `listConversationsForAdmin`'s own
                deliberately-narrow scope). */}
            <Route element={<ProtectedRoute allowedRoles={[ROLES.PATIENT, ROLES.DOCTOR]} />}>
              <Route path="/dashboard/messages" element={<MessagesPage />} />
            </Route>

            {/* FET-13 — full notification center (`GET
                /notifications/me`), the "See all notifications" the
                bell dropdown links to. Every authenticated role — a
                notification is always self-scoped (`recipient` ===
                the signed-in user), never gated by a permission the
                way Messages above is. */}
            <Route path="/dashboard/notifications" element={<NotificationsPage />} />

            {/* FET-12 (Patient Portal) checkpoint 2 — appointment-
                based secure video consultation (BET-14). Reached from
                a specific appointment's "Join video consultation"
                action, not a standalone roster — a video session is
                always scoped to one appointment. Same role
                restriction as Messages above; ownership/participation
                itself is re-verified server-side regardless
                (`assertIsSessionParticipant` — 404, not 403, on a
                mismatch, per master prompt §30/§80). */}
            <Route element={<ProtectedRoute allowedRoles={[ROLES.PATIENT, ROLES.DOCTOR]} />}>
              <Route path="/dashboard/video-calls/:appointmentId" element={<VideoConsultationPage />} />
            </Route>

            {/* FET-07 — Gynecology, Sensitive Records & Pregnancy.
                Old standalone route kept as a redirect into the
                FET-06 workspace so no existing link breaks. */}
            <Route element={<ProtectedRoute allowedRoles={SENSITIVE_RECORDS_ROLES} />}>
              <Route
                path="/dashboard/clinical/:patientProfileId"
                element={<ClinicalRecordRedirect />}
              />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]} />}>
              <Route path="/dashboard/my-records" element={<MyClinicalRecordsPage />} />
            </Route>

            {/* FET-05 — Super Admin Dashboard & Staff/RBAC Management.
                Mirrors who actually holds `users:read`/`roles:read` on
                the backend (SOFTWARE_OWNER, SUPER_ADMIN, DIRECTOR,
                ADMIN) — UX-only gate, `authorize()` on each route is
                the real boundary. */}
            <Route element={<ProtectedRoute allowedRoles={ADMIN_TIER_ROLES} />}>
              <Route path="/dashboard/staff" element={<StaffListPage />} />
              <Route path="/dashboard/staff/:id" element={<StaffDetailPage />} />
              <Route path="/dashboard/departments" element={<DepartmentsPage />} />
              <Route path="/dashboard/roles" element={<RolesPermissionsPage />} />
              {/* FET-16 — Website Management: navbar, hero banner,
                  services, certificates, homepage section layout. */}
              <Route path="/dashboard/website" element={<WebsiteManagementPage />} />
              {/* FET-19 — Social & External Integrations. Mirrors
                  `WEBSITE_MANAGE` exactly, same boundary the backend's
                  `integration.routes.js` gates every route on. */}
              <Route path="/dashboard/integrations" element={<IntegrationsPage />} />
              {/* FET-20 — Security Administration. `ADMIN_TIER_ROLES`
                  here is the same 4 roles as `SECURITY_ADMIN_READ_ROLES`
                  (mirrors `AUDIT_READ`, verified against
                  `security/permissions.js` — see that constant's own
                  comment in `constants/roles.js`); the page's own two
                  mutating actions are additionally gated live against
                  `usePermissions().has('system:admin')`. */}
              <Route path="/dashboard/security-admin" element={<SecurityAdminPage />} />
              {/* FET-20 — Audit Administration, checkpoint 1 (Audit
                  log, User activity, Administrative activity).
                  `ADMIN_TIER_ROLES` mirrors `AUDIT_READ` server-side,
                  the same boundary Security Administration above
                  uses — `modules/audit-logs`' admin viewer is gated
                  on the identical permission. */}
              <Route path="/dashboard/audit-admin" element={<AuditAdminPage />} />
            </Route>

            {/* User Account Management — restricted to SOFTWARE_OWNER
                and SUPER_ADMIN only. This is narrower than the general
                ADMIN_TIER_ROLES gate used for staff management above.
                Backend enforces this independently via the
                USER_ACCOUNTS_ADMIN permission on every /api/v1/users
                route — hiding the UI is NOT the security mechanism. */}
            <Route element={<ProtectedRoute allowedRoles={USER_ACCOUNTS_ADMIN_ROLES} />}>
              <Route path="/dashboard/accounts" element={<AllAccountsPage />} />
              <Route path="/dashboard/accounts/:id" element={<AccountDetailPage />} />
            </Route>

            {/* FET-20 — Backup Administration. Every route in
                `modules/backups` requires `SYSTEM_ADMIN` outright
                (today: SOFTWARE_OWNER, SUPER_ADMIN only) — unlike
                Security Administration above, there is no
                lower `AUDIT_READ` read tier for this module (see
                that module's own README: a full database dump and
                the ability to overwrite production data with one
                are both squarely the most privileged thing this
                application can do). `SYSTEM_ADMIN_ROLES` mirrors
                that exactly — a DIRECTOR/ADMIN does not even reach
                this route, let alone its mutating actions. */}
            <Route element={<ProtectedRoute allowedRoles={SYSTEM_ADMIN_ROLES} />}>
              <Route path="/dashboard/backups" element={<BackupsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
