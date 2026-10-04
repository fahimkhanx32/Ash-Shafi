import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  User,
  ClipboardList,
  HeartPulse,
  Baby,
  Stethoscope,
  CalendarClock,
  Pill,
  FlaskConical,
  FileText,
  Receipt,
  MessageSquare,
  FolderOpen,
  Clock,
} from 'lucide-react';

import { useAuth } from '../providers/AuthProvider.jsx';
import * as patientsService from '../services/patientsService.js';
import { extractApiError } from '../services/apiClient.js';
import {
  SENSITIVE_RECORDS_ROLES,
  PATIENT_WRITE_ROLES,
  MEDICAL_RECORDS_WRITE_ROLES,
  PRESCRIPTIONS_ROLES,
  INVESTIGATIONS_REPORTS_READ_ROLES,
  INVESTIGATIONS_WRITE_ROLES,
  REPORTS_WRITE_ROLES,
  REPORTS_VERIFY_ROLES,
  INVOICE_WRITE_ROLES,
  ROLES,
} from '../constants/roles.js';
import { labelFor, patientStatusVariant } from '../constants/patients.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { ErrorState } from '../components/ui/empty-state.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import PatientOverviewTab from '../components/patients/PatientOverviewTab.jsx';
import MedicalHistoryTab from '../components/patients/MedicalHistoryTab.jsx';
import ConsultationsTab from '../components/patients/ConsultationsTab.jsx';
import AppointmentsTab from '../components/patients/AppointmentsTab.jsx';
import PrescriptionsTab from '../components/patients/PrescriptionsTab.jsx';
import InvestigationsTab from '../components/patients/InvestigationsTab.jsx';
import ReportsTab from '../components/patients/ReportsTab.jsx';
import PatientBillingTab from '../components/patients/PatientBillingTab.jsx';
import ComingSoonTab from '../components/patients/ComingSoonTab.jsx';
import PatientMedicalTimeline from '../components/patients/PatientMedicalTimeline.jsx';
import PatientDocumentsTab from '../components/patients/PatientDocumentsTab.jsx';
import GynecologyPanel from '../components/clinical/GynecologyPanel.jsx';
import PregnancyPanel from '../components/clinical/PregnancyPanel.jsx';

export default function PatientWorkspacePage() {
  const { t } = useTranslation();
  const { patientProfileId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const canWritePatient = PATIENT_WRITE_ROLES.includes(user?.role);
  const canWriteMedicalHistory = MEDICAL_RECORDS_WRITE_ROLES.includes(user?.role);
  const canAccessSensitive = SENSITIVE_RECORDS_ROLES.includes(user?.role);
  const canSeeMedicalHistory = Boolean(profile) && !profile.medicalHistoryRedacted;
  const canSeeConsultations = canWriteMedicalHistory;
  const canWritePrescriptions = PRESCRIPTIONS_ROLES.includes(user?.role);
  const canSeeInvestigationsReports = INVESTIGATIONS_REPORTS_READ_ROLES.includes(user?.role);
  const canWriteInvestigations = INVESTIGATIONS_WRITE_ROLES.includes(user?.role);
  const canWriteReports = REPORTS_WRITE_ROLES.includes(user?.role);
  const canVerifyReports = REPORTS_VERIFY_ROLES.includes(user?.role);
  const canAccessBilling = INVOICE_WRITE_ROLES.includes(user?.role);
  const isDoctorBilling = user?.role === ROLES.DOCTOR;

  const load = useCallback(() => {
    setState('loading');
    setErrorMessage('');
    patientsService
      .getPatient(patientProfileId)
      .then((data) => {
        setProfile(data);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  }, [patientProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs = [
    { value: 'overview', label: t('patientDashboard.tabOverview', 'Overview'), icon: User },
    { value: 'timeline', label: t('patientDashboard.tabTimeline', 'Medical Timeline'), icon: Clock },
    canSeeMedicalHistory && { value: 'medical-history', label: t('patientDashboard.tabMedicalHistory', 'Medical history'), icon: ClipboardList },
    canAccessSensitive && { value: 'gynecology', label: t('patientDashboard.tabGynecology', 'Gynecology'), icon: HeartPulse },
    canAccessSensitive && { value: 'pregnancy', label: t('patientDashboard.tabPregnancy', 'Pregnancy'), icon: Baby },
    canSeeConsultations && { value: 'consultations', label: t('patientDashboard.tabConsultations', 'Consultations'), icon: Stethoscope },
    { value: 'appointments', label: t('patientDashboard.tabAppointments', 'Appointments'), icon: CalendarClock },
    canWritePrescriptions && { value: 'prescriptions', label: t('patientDashboard.tabPrescriptions', 'Prescriptions'), icon: Pill },
    canSeeInvestigationsReports && { value: 'investigations', label: t('patientDashboard.tabInvestigations', 'Investigations'), icon: FlaskConical },
    canSeeInvestigationsReports && { value: 'reports', label: t('patientDashboard.tabReports', 'Reports'), icon: FileText },
    { value: 'documents', label: t('patientDashboard.tabDocuments', 'Documents'), icon: FolderOpen },
    canAccessBilling && { value: 'billing', label: t('patientDashboard.tabBilling', 'Billing'), icon: Receipt },
    { value: 'messages', label: t('patientDashboard.tabMessages', 'Messages'), icon: MessageSquare },
  ].filter(Boolean);

  const activeTab = tabs.some((t) => t.value === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const setActiveTab = (value) => setSearchParams({ tab: value }, { replace: true });

  if (state === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state === 'error') {
    return <ErrorState description={errorMessage} onRetry={load} />;
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('patients.title', 'Patients'), to: '/dashboard/patients' },
          { label: profile.fullName || `${profile.firstName} ${profile.lastName}` },
        ]}
        title={profile.fullName || `${profile.firstName} ${profile.lastName}`}
        description={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{profile.patientId}</span>
            <Badge variant={patientStatusVariant(profile.patientStatus)}>
              {labelFor(profile.patientStatus)}
            </Badge>
          </span>
        }
      />

      <TabList tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <PatientOverviewTab profile={profile} canWrite={canWritePatient} onUpdated={setProfile} />
      ) : null}

      {activeTab === 'timeline' ? (
        <PatientMedicalTimeline
          patientProfileId={patientProfileId}
          patientName={profile.fullName || `${profile.firstName} ${profile.lastName}`}
          canUpload={canWriteReports}
          canVerify={canVerifyReports}
        />
      ) : null}

      {activeTab === 'medical-history' && canSeeMedicalHistory ? (
        <MedicalHistoryTab profile={profile} canWrite={canWriteMedicalHistory} onUpdated={setProfile} />
      ) : null}

      {activeTab === 'gynecology' && canAccessSensitive ? (
        <GynecologyPanel patientProfileId={patientProfileId} canWrite={canAccessSensitive} />
      ) : null}

      {activeTab === 'pregnancy' && canAccessSensitive ? (
        <PregnancyPanel patientProfileId={patientProfileId} canWrite={canAccessSensitive} />
      ) : null}

      {activeTab === 'consultations' && canSeeConsultations ? (
        <ConsultationsTab patientProfileId={patientProfileId} canWrite={canWriteMedicalHistory} />
      ) : null}

      {activeTab === 'appointments' ? <AppointmentsTab patientProfileId={patientProfileId} /> : null}

      {activeTab === 'prescriptions' && canWritePrescriptions ? (
        <PrescriptionsTab patientProfileId={patientProfileId} canWrite={canWritePrescriptions} />
      ) : null}

      {activeTab === 'investigations' && canSeeInvestigationsReports ? (
        <InvestigationsTab patientProfileId={patientProfileId} canWrite={canWriteInvestigations} />
      ) : null}

      {activeTab === 'reports' && canSeeInvestigationsReports ? (
        <ReportsTab
          patientProfileId={patientProfileId}
          canWrite={canWriteReports}
          canVerify={canVerifyReports}
        />
      ) : null}

      {activeTab === 'billing' && canAccessBilling ? (
        <PatientBillingTab
          patientProfileId={patientProfileId}
          patientLabel={profile.fullName || `${profile.firstName} ${profile.lastName}`}
          canWrite={canAccessBilling}
          isDoctor={isDoctorBilling}
        />
      ) : null}

      {activeTab === 'messages' ? (
        <ComingSoonTab
          icon={MessageSquare}
          title={t('patientDashboard.tabMessages', 'Messages')}
          description={t('common.comingSoon', 'Coming soon')}
        />
      ) : null}

      {activeTab === 'documents' ? (
        <PatientDocumentsTab
          patientProfileId={patientProfileId}
          patientName={profile.fullName || `${profile.firstName} ${profile.lastName}`}
          canUpload={canWriteReports}
          canVerify={canVerifyReports}
        />
      ) : null}
    </div>
  );
}
