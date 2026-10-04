import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Users,
  Stethoscope,
  ShieldCheck,
  UserCog,
  Activity,
  Database,
  ArrowRight,
  UserPlus,
  HeartPulse,
  FileSignature,
} from 'lucide-react';

import * as usersService from '../../services/usersService.js';
import * as staffService from '../../services/staffService.js';
import * as rolesService from '../../services/rolesService.js';
import * as patientsService from '../../services/patientsService.js';
import * as systemHealthService from '../../services/systemHealthService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card.jsx';
import { Badge } from '../ui/badge.jsx';
import { buttonVariants } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Skeleton } from '../ui/skeleton.jsx';

function StatCard({ icon: Icon, label, value, to, loading }) {
  const body = (
    <Card className="h-full">
      <CardContent className="pt-6 flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-accent text-accent-foreground grid place-items-center">
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? (
            <Skeleton className="h-7 w-14 mt-1" />
          ) : (
            <div className="text-2xl font-bold tracking-tight">{value ?? '—'}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return to ? (
    <Link to={to} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * FET-05 — Super Admin / Director / Owner dashboard. Every number on
 * this page comes from a real, already-working backend endpoint
 */
export default function OwnerDashboard({ user }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null); // { users, staff, doctors, roles, patients }
  const [statsState, setStatsState] = useState('loading');
  const [statsError, setStatsError] = useState('');

  const [health, setHealth] = useState(null); // { liveness, readiness }
  const [healthState, setHealthState] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      usersService.listUsers({ limit: 1 }),
      staffService.listStaffProfiles({ limit: 1 }),
      staffService.listDoctors({ limit: 1 }),
      rolesService.listRoles(),
      patientsService.listPatients({ limit: 1 }),
    ])
      .then(([users, staff, doctors, roles, patients]) => {
        if (cancelled) return;
        setStats({
          users: users.pagination?.total ?? users.items.length,
          staff: staff.pagination?.total ?? staff.items.length,
          doctors: doctors.pagination?.total ?? doctors.items.length,
          roles: roles.length,
          patients: patients.pagination?.total ?? patients.items.length,
        });
        setStatsState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setStatsError(extractApiError(error).message);
        setStatsState('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      systemHealthService.getLiveness().catch(() => null),
      systemHealthService.getReadiness().catch(() => null),
    ]).then(([liveness, readiness]) => {
      if (cancelled) return;
      setHealth({ liveness, readiness });
      setHealthState('ready');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const databaseHealthy = health?.readiness?.checks?.database?.readyState === 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.welcomeUser', 'Welcome, {{name}}', { name: user?.name })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('dashboard.systemOverviewFor', 'System overview for {{role}}.', { role: user?.role })}
        </p>
      </div>

      {statsState === 'error' ? (
        <Alert variant="destructive">
          <AlertDescription>{statsError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label={t('dashboard.totalUsers', 'Total users')} value={stats?.users} to="/dashboard/staff" loading={statsState === 'loading'} />
        <StatCard icon={UserCog} label={t('dashboard.staffProfiles', 'Staff profiles')} value={stats?.staff} to="/dashboard/staff" loading={statsState === 'loading'} />
        <StatCard icon={Stethoscope} label={t('dashboard.doctors', 'Doctors')} value={stats?.doctors} to="/dashboard/staff?designation=DOCTOR" loading={statsState === 'loading'} />
        <StatCard icon={ShieldCheck} label={t('dashboard.roles', 'Roles')} value={stats?.roles} to="/dashboard/roles" loading={statsState === 'loading'} />
        <StatCard icon={HeartPulse} label={t('dashboard.patients', 'Patients')} value={stats?.patients} to="/dashboard/patients" loading={statsState === 'loading'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.quickActions', 'Quick actions')}</CardTitle>
            <CardDescription>{t('dashboard.commonAdminTasks', 'Common administration tasks.')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/dashboard/staff" className={buttonVariants({ size: 'sm' })}>
              <UserPlus size={15} /> {t('staff.addStaff', 'Add staff or doctor')}
            </Link>
            <Link to="/dashboard/prescriptions" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <FileSignature size={15} /> {t('clinical.prescriptions.title', 'Prescriptions')}
            </Link>
            <Link to="/dashboard/patients" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <HeartPulse size={15} /> {t('dashboard.managePatients', 'Manage patients')}
            </Link>
            <Link to="/dashboard/staff" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Users size={15} /> {t('dashboard.manageUsers', 'Manage users')}
            </Link>
            <Link to="/dashboard/roles" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ShieldCheck size={15} /> {t('roles.title', 'Roles & permissions')}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} /> {t('dashboard.systemHealth', 'System health')}
            </CardTitle>
            <CardDescription>{t('dashboard.systemHealthDesc', "Live from the API's health endpoints.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthState === 'loading' ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Activity size={14} /> API
                  </span>
                  <Badge variant={health?.liveness ? 'success' : 'destructive'}>
                    {health?.liveness ? t('common.active', 'Online') : t('common.inactive', 'Unreachable')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Database size={14} /> Database
                  </span>
                  <Badge variant={databaseHealthy ? 'success' : 'destructive'}>
                    {databaseHealthy ? t('common.active', 'Connected') : t('common.inactive', 'Unavailable')}
                  </Badge>
                </div>
                {health?.liveness?.environment ? (
                  <p className="text-xs text-muted-foreground pt-1">
                    Environment: {health.liveness.environment} · v{health.liveness.version || '—'}
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.recentActivity', 'Recent activity')}</CardTitle>
          <CardDescription>{t('audit.title', 'Audit log')}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t('audit.pageDescription', 'System-wide audit trail for security events, clinical access, file downloads, and admin operations.')}
        </CardContent>
      </Card>

      <div>
        <Link
          to="/dashboard/staff"
          className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          {t('dashboard.goToStaffManagement', 'Go to staff & user management')} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
