import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldOff,
  Save,
  Pencil,
  X,
  Stethoscope,
  Lock,
} from 'lucide-react';

import * as staffService from '../services/staffService.js';
import * as usersService from '../services/usersService.js';
import { extractApiError } from '../services/apiClient.js';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { ErrorState } from '../components/ui/empty-state.jsx';
import {
  STAFF_DESIGNATIONS,
  STAFF_EMPLOYMENT_TYPES,
  STAFF_EMPLOYMENT_STATUSES,
  USER_STATUSES,
  labelFor,
} from '../constants/staff.js';
import { ADMIN_ASSIGNABLE_ROLES } from '../constants/roles.js';
import { formatDate } from '../lib/dateFormat.js';
import { FloatField, controlClass } from '../components/ui/profile-form.jsx';

const inputClass =
  'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const statusVariant = (status) => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ON_LEAVE') return 'warning';
  if (status === 'SUSPENDED' || status === 'TERMINATED' || status === 'INACTIVE') return 'destructive';
  return 'neutral';
};

export default function StaffDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [profile, setProfile] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [employmentStatusDraft, setEmploymentStatusDraft] = useState('');
  const [savingEmploymentStatus, setSavingEmploymentStatus] = useState(false);

  const [roleDraft, setRoleDraft] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const [accountStatusDraft, setAccountStatusDraft] = useState('');
  const [savingAccountStatus, setSavingAccountStatus] = useState(false);

  const [togglingActive, setTogglingActive] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = await staffService.getStaffProfile(id);
      setProfile(data);
      setEmploymentStatusDraft(data.employmentStatus);
      setRoleDraft(data.user?.role || '');
      setAccountStatusDraft(data.user?.status || '');
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    setForm({
      designation: profile.designation,
      customDesignationLabel: profile.customDesignationLabel || '',
      department: profile.department || '',
      phone: profile.phone || '',
      employmentType: profile.employmentType || 'FULL_TIME',
      specialization: profile.doctorDetails?.specialization || '',
      registrationNumber: profile.doctorDetails?.registrationNumber || '',
      yearsOfExperience: profile.doctorDetails?.yearsOfExperience ?? '',
      bio: profile.doctorDetails?.bio || '',
    });
    setSaveError('');
    setEditing(true);
  };

  const set = (name) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        designation: form.designation,
        department: form.department.trim(),
        phone: form.phone.trim(),
        employmentType: form.employmentType,
        ...(form.designation === 'OTHER'
          ? { customDesignationLabel: form.customDesignationLabel.trim() }
          : {}),
        ...(form.designation === 'DOCTOR'
          ? {
              doctorDetails: {
                specialization: form.specialization.trim(),
                registrationNumber: form.registrationNumber.trim(),
                bio: form.bio.trim(),
                ...(form.yearsOfExperience !== ''
                  ? { yearsOfExperience: Number(form.yearsOfExperience) }
                  : {}),
              },
            }
          : {}),
      };
      const updated = await staffService.updateStaffProfile(id, payload);
      setProfile(updated);
      setEditing(false);
      toast({ title: t('staff.profileUpdated', 'Staff profile updated'), variant: 'success' });
    } catch (error) {
      setSaveError(extractApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmploymentStatus = async () => {
    if (employmentStatusDraft === profile.employmentStatus) return;
    setSavingEmploymentStatus(true);
    try {
      const updated = await staffService.setStaffEmploymentStatus(id, employmentStatusDraft);
      setProfile(updated);
      toast({ title: t('staff.employmentStatusUpdated', 'Employment status updated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('staff.cannotUpdateEmploymentStatus', 'Could not update employment status'), description: extractApiError(error).message, variant: 'destructive' });
      setEmploymentStatusDraft(profile.employmentStatus);
    } finally {
      setSavingEmploymentStatus(false);
    }
  };

  const handleToggleProfileActive = async () => {
    const activating = !profile.isActive;
    const ok = await confirm({
      title: activating ? t('staff.reactivateTitle', 'Reactivate staff profile?') : t('staff.deactivateTitle', 'Deactivate staff profile?'),
      description: activating
        ? t('staff.reactivateDesc', 'This restores their HR profile. Their login account is managed separately below.')
        : t('staff.deactivateDesc', 'This deactivates their HR profile. It does not sign them out or disable their login — use the account status control below for that.'),
      confirmLabel: activating ? t('common.reactivate', 'Reactivate') : t('common.deactivate', 'Deactivate'),
      variant: activating ? 'default' : 'destructive',
    });
    if (!ok) return;

    setTogglingActive(true);
    try {
      const updated = activating
        ? await staffService.reactivateStaffProfile(id)
        : await staffService.deactivateStaffProfile(id);
      setProfile(updated);
      toast({ title: activating ? t('staff.profileReactivated', 'Staff profile reactivated') : t('staff.profileDeactivated', 'Staff profile deactivated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('common.actionFailed', 'Action failed'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setTogglingActive(false);
    }
  };

  const handleSaveRole = async () => {
    if (roleDraft === profile.user?.role) return;
    const ok = await confirm({
      title: t('accounts.changeRoleTitle', 'Change account role?'),
      description: t('accounts.changeRoleDesc', 'This changes what {{name}} can access system-wide.', { name: profile.user?.name }),
      confirmLabel: t('accounts.changeRole', 'Change role'),
    });
    if (!ok) return;

    setSavingRole(true);
    try {
      const updatedUser = await usersService.changeUserRole(profile.user.id, roleDraft);
      setProfile((prev) => ({ ...prev, user: { ...prev.user, ...updatedUser } }));
      toast({ title: t('accounts.roleUpdated', 'Account role updated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('accounts.cannotChangeRole', 'Could not change role'), description: extractApiError(error).message, variant: 'destructive' });
      setRoleDraft(profile.user?.role || '');
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveAccountStatus = async () => {
    if (accountStatusDraft === profile.user?.status) return;
    const suspending = accountStatusDraft !== 'ACTIVE';
    const ok = await confirm({
      title: suspending ? t('accounts.restrictTitle', 'Restrict this login account?') : t('accounts.restoreTitle', 'Restore this login account?'),
      description: suspending
        ? t('accounts.restrictDesc', '{{name}} will no longer be able to sign in.', { name: profile.user?.name })
        : t('accounts.restoreDesc', '{{name}} will be able to sign in again.', { name: profile.user?.name }),
      confirmLabel: suspending ? t('accounts.restrictAccess', 'Restrict access') : t('accounts.restoreAccess', 'Restore access'),
      variant: suspending ? 'destructive' : 'default',
    });
    if (!ok) return;

    setSavingAccountStatus(true);
    try {
      const updatedUser = await usersService.setUserStatus(profile.user.id, accountStatusDraft);
      setProfile((prev) => ({ ...prev, user: { ...prev.user, ...updatedUser } }));
      toast({ title: t('accounts.statusUpdated', 'Account status updated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('accounts.cannotUpdateStatus', 'Could not update account status'), description: extractApiError(error).message, variant: 'destructive' });
      setAccountStatusDraft(profile.user?.status || '');
    } finally {
      setSavingAccountStatus(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state === 'error') {
    return <ErrorState description={errorMessage} onRetry={load} />;
  }

  const isProtected = Boolean(profile.user?.isProtected);

  return (
    <div className="max-w-3xl">
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('staff.title', 'Staff'), to: '/dashboard/staff' },
          { label: profile.user?.name || t('staff.profile', 'Profile') },
        ]}
        title={profile.user?.name}
        description={
          <>
            {profile.employeeId} ·{' '}
            {profile.designation === 'OTHER'
              ? profile.customDesignationLabel || labelFor('OTHER')
              : labelFor(profile.designation)}
          </>
        }
        actions={
          !editing ? (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil size={14} /> {t('staff.editProfile', 'Edit profile')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-5">
        {isProtected ? (
          <Alert>
            <Lock size={14} />
            <AlertDescription>
              {t('accounts.protectedAlert', "This is a system-protected account. Its role and login access can't be changed through ordinary staff management.")}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('accounts.loginAccount', 'Login account')}</CardTitle>
            <CardDescription>{t('accounts.loginAccountDesc', 'Identity, RBAC role, and sign-in access.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{t('common.email', 'Email')}</div>
                <div>{profile.user?.email}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('common.username', 'Username')}</div>
                <div>{profile.user?.username}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <div className="flex items-start gap-2">
<FloatField label={t('staff.colAccountRole', 'Account role')} surface="card" className="flex-1">
<select
                    className={controlClass}
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value)}
                    disabled={isProtected || savingRole}
                  >
                    {!ADMIN_ASSIGNABLE_ROLES.includes(profile.user?.role) ? (
                      <option value={profile.user?.role}>{labelFor(profile.user?.role)}</option>
                    ) : null}
                    {ADMIN_ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {labelFor(role)}
                      </option>
                    ))}
                  </select>
</FloatField>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isProtected || savingRole || roleDraft === profile.user?.role}
                    onClick={handleSaveRole}
                  >
                    {savingRole ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-start gap-2">
<FloatField label={t('staff.colAccountStatus', 'Account status')} surface="card" className="flex-1">
<select
                    className={controlClass}
                    value={accountStatusDraft}
                    onChange={(e) => setAccountStatusDraft(e.target.value)}
                    disabled={isProtected || savingAccountStatus}
                  >
                    {USER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {labelFor(status)}
                      </option>
                    ))}
                  </select>
</FloatField>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isProtected || savingAccountStatus || accountStatusDraft === profile.user?.status}
                    onClick={handleSaveAccountStatus}
                  >
                    {savingAccountStatus ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">{t('accounts.current', 'Current:')}</span>
              <Badge variant="primary">{labelFor(profile.user?.role)}</Badge>
              <Badge variant={statusVariant(profile.user?.status)}>{labelFor(profile.user?.status)}</Badge>
              {isProtected ? (
                <Badge variant="info">
                  <ShieldCheck size={11} className="mr-1" /> {t('accounts.protected', 'Protected')}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('staff.staffProfile', 'Staff profile')}</CardTitle>
              <CardDescription>{t('staff.orgDetails', 'Organizational / HR details.')}</CardDescription>
            </div>
            <Badge variant={profile.isActive ? 'success' : 'destructive'}>
              {profile.isActive ? t('staff.activeProfile', 'Active profile') : t('staff.inactiveProfile', 'Inactive profile')}
            </Badge>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {saveError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FloatField label={t('staff.colDesignation', 'Designation')} surface="card">
                    <select className={controlClass} value={form.designation} onChange={set('designation')}>
                      {STAFF_DESIGNATIONS.map((d) => (
                        <option key={d} value={d}>
                          {labelFor(d)}
                        </option>
                      ))}
                    </select>
                  </FloatField>
                  <FloatField label={t('staff.employmentType', 'Employment type')} surface="card">
                    <select
                      className={controlClass}
                      value={form.employmentType}
                      onChange={set('employmentType')}
                    >
                      {STAFF_EMPLOYMENT_TYPES.map((tVal) => (
                        <option key={tVal} value={tVal}>
                          {labelFor(tVal)}
                        </option>
                      ))}
                    </select>
                  </FloatField>
                  {form.designation === 'OTHER' ? (
                    <FloatField label={t('staff.customDesignationLabel', 'Custom designation label')} surface="card" className="sm:col-span-2">
                      <input
                        required
                        className={controlClass}
                        value={form.customDesignationLabel}
                        onChange={set('customDesignationLabel')}
                      />
                    </FloatField>
                  ) : null}
                  <FloatField label={t('staff.colDepartment', 'Department')} surface="card">
                    <input className={controlClass} value={form.department} onChange={set('department')} />
                  </FloatField>
                  <FloatField label={t('staff.phone', 'Phone')} surface="card">
                    <input className={controlClass} value={form.phone} onChange={set('phone')} />
                  </FloatField>
                </div>

                {form.designation === 'DOCTOR' ? (
                  <div className="rounded-xl border border-border p-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Stethoscope size={13} /> {t('staff.doctorDetails', 'Doctor details')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FloatField label={t('staff.specialization', 'Specialization')} surface="card">
                        <input
                          required
                          className={controlClass}
                          value={form.specialization}
                          onChange={set('specialization')}
                        />
                      </FloatField>
                      <FloatField label={t('staff.registrationNumber', 'Registration number')} surface="card">
                        <input
                          required
                          className={controlClass}
                          value={form.registrationNumber}
                          onChange={set('registrationNumber')}
                        />
                      </FloatField>
                      <FloatField label={t('staff.yearsOfExperience', 'Years of experience')} surface="card">
                        <input
                          type="number"
                          min="0"
                          className={controlClass}
                          value={form.yearsOfExperience}
                          onChange={set('yearsOfExperience')}
                        />
                      </FloatField>
                    </div>
                    <FloatField label={t('staff.about', 'Bio')} surface="card">
                      <textarea
                        className={`${controlClass} resize-y`}
                        value={form.bio}
                        onChange={set('bio')}
                      />
                    </FloatField>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                    <X size={14} /> {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    <Save size={14} /> {saving ? t('common.saving', 'Saving…') : t('common.saveChanges', 'Save changes')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">{t('staff.colDepartment', 'Department')}</div>
                  <div>{profile.department || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('staff.phone', 'Phone')}</div>
                  <div>{profile.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('staff.employmentType', 'Employment type')}</div>
                  <div>{labelFor(profile.employmentType)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('staff.joiningDate', 'Joining date')}</div>
                  <div>{formatDate(profile.joiningDate)}</div>
                </div>
                {profile.designation === 'DOCTOR' ? (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('staff.specialization', 'Specialization')}</div>
                      <div>{profile.doctorDetails?.specialization || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('staff.registrationNumber', 'Registration number')}</div>
                      <div>{profile.doctorDetails?.registrationNumber || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('staff.yearsOfExperience', 'Years of experience')}</div>
                      <div>{profile.doctorDetails?.yearsOfExperience ?? '—'}</div>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('staff.colEmploymentStatus', 'Employment status')}</CardTitle>
            <CardDescription>
              {t('staff.employmentStatusDesc', 'HR-facing status (separate from login access) — e.g. on leave, suspended, terminated.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <FloatField label={t('audit.colStatus', 'Status')} surface="card">
              <select
                className={controlClass}
                value={employmentStatusDraft}
                onChange={(e) => setEmploymentStatusDraft(e.target.value)}
                disabled={savingEmploymentStatus}
              >
                {STAFF_EMPLOYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {labelFor(status)}
                  </option>
                ))}
              </select>
            </FloatField>
            <Button
              size="sm"
              variant="outline"
              disabled={savingEmploymentStatus || employmentStatusDraft === profile.employmentStatus}
              onClick={handleSaveEmploymentStatus}
            >
              {savingEmploymentStatus ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
            </Button>

            <div className="ml-auto">
              <Button
                size="sm"
                variant={profile.isActive ? 'destructive' : 'default'}
                disabled={togglingActive}
                onClick={handleToggleProfileActive}
              >
                {profile.isActive ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                {togglingActive ? t('common.pleaseWait', 'Please wait…') : profile.isActive ? t('staff.deactivateProfile', 'Deactivate profile') : t('staff.reactivateProfile', 'Reactivate profile')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/staff')}>
            {t('staff.backToStaffList', 'Back to staff list')}
          </Button>
        </div>
      </div>
    </div>
  );
}
