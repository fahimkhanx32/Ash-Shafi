import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, BadgeCheck, Award, Clock3, Building2, Hash, HeartPulse, FileSignature, Plus } from 'lucide-react';

import * as staffService from '../../services/staffService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Button } from '../ui/button.jsx';

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-accent text-accent-foreground grid place-items-center">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value || '—'}</div>
      </div>
    </div>
  );
}

/**
 * Real data only: pulled live from GET /staff/me
 */
export default function DoctorDashboard({ user }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    staffService
      .getMyStaffProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const doctorDetails = profile?.doctorDetails;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.welcomeDoctor', 'Welcome, Dr. {{name}}', { name: user?.name })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('dashboard.profileOverview', "Here's your profile overview.")}
        </p>
      </div>

      {state === 'loading' && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          {t('dashboard.loadingProfile', 'Loading your profile…')}
        </div>
      )}

      {state === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>
            {errorMessage}
            {errorMessage?.toLowerCase().includes('not found') && (
              <>
                {' '}
                {t('dashboard.noStaffProfile', 'Your account doesn’t have a staff profile set up yet — ask an administrator to create one.')}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {state === 'ready' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatTile icon={Stethoscope} label={t('staff.specialization', 'Specialization')} value={doctorDetails?.specialization} />
            <StatTile icon={BadgeCheck} label={t('staff.registrationNumber', 'Registration number')} value={doctorDetails?.registrationNumber} />
            <StatTile
              icon={Clock3}
              label={t('staff.yearsOfExperience', 'Experience')}
              value={
                doctorDetails?.yearsOfExperience
                  ? `${doctorDetails.yearsOfExperience} years`
                  : undefined
              }
            />
            <StatTile icon={Building2} label={t('staff.colDepartment', 'Department')} value={profile?.department} />
            <StatTile icon={Hash} label={t('staff.employeeId', 'Employee ID')} value={profile?.employeeId} />
            <StatTile icon={Award} label={t('staff.colDesignation', 'Designation')} value={profile?.designation} />
          </div>

          {doctorDetails?.qualifications?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('staff.qualifications', 'Qualifications')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {doctorDetails.qualifications.map((q) => (
                  <span
                    key={q}
                    className="rounded-full bg-accent text-accent-foreground text-xs font-medium px-3 py-1.5"
                  >
                    {q}
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          {doctorDetails?.bio && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('staff.about', 'About')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                {doctorDetails.bio}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PrescriptionsEntryCard />
            <PatientsEntryCard />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.todayAppointments', "Today's appointments")}</CardTitle>
              <CardDescription>{t('appointments.title', 'Appointments')}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t('appointments.descriptionStaff', 'Calendar, scheduling and booking.')}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PrescriptionsEntryCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <FileSignature size={18} className="text-primary" /> {t('clinical.prescriptions.title', 'Prescriptions')}
        </CardTitle>
        <CardDescription>
          {t('clinical.prescriptions.doctorCardDesc', 'Write, draft, manage, and print legal 8.5" × 14" prescriptions with QR verification.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Button size="sm" onClick={() => navigate('/dashboard/prescriptions')} className="gap-1.5">
          <FileSignature size={14} /> {t('clinical.prescriptions.viewAll', 'View Prescriptions')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/patients')} className="gap-1.5">
          <Plus size={14} /> {t('clinical.prescriptions.writeNew', 'Write Prescription')}
        </Button>
      </CardContent>
    </Card>
  );
}

function PatientsEntryCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HeartPulse size={18} /> {t('patients.title', 'Patients')}
        </CardTitle>
        <CardDescription>
          {t('dashboard.patientsDesc', 'Search your patients, open a chart, and review medical, gynecology, and pregnancy records.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/patients')}>
          {t('dashboard.openPatients', 'Open patients')}
        </Button>
      </CardContent>
    </Card>
  );
}
