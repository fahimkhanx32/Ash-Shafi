import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  FileText,
  Hash,
  Languages,
  Mail,
  MapPin,
  Phone,
  Siren,
  Stethoscope,
  User,
  UserRound,
  Users,
} from 'lucide-react';

import * as staffService from '../services/staffService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { PageHeader } from '../components/ui/page-header.jsx';
import {
  FormHero,
  FormSection,
  FloatInput,
  FloatSelect,
  FloatTextarea,
  FloatReadOnly,
  SaveBar,
} from '../components/ui/profile-form.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { ErrorState } from '../components/ui/empty-state.jsx';
import { STAFF_GENDERS, labelFor } from '../constants/staff.js';

const emptyDoctorDetails = {
  specialization: '',
  qualifications: '', // comma-separated in the UI, array on the wire
  registrationNumber: '',
  yearsOfExperience: '',
  bio: '',
  nameBangla: '',
  degreesBangla: '',
  designationBangla: '',
  departmentBangla: '',
  specialtyBangla: '',
};

const toDateInputValue = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

/**
 * Self-service counterpart to the admin-only StaffDetailPage. Any
 * authenticated staff member (a newly created doctor included) lands
 * here to fill in the details an admin never entered for them —
 * critically the Bangla name/degrees/designation used on the
 * prescription letterhead (`LegalPrescriptionDocument.jsx`), which
 * previously had no data source at all and always showed the
 * practice's hardcoded default doctor. Backed by the real
 * `PATCH /staff/me` endpoint — org-assigned fields (designation,
 * department, employment type/status) aren't editable here and stay
 * admin-only via `/dashboard/staff/:id`.
 */
export default function MyProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isDoctor = user?.role === 'DOCTOR';

  const [profile, setProfile] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState({
    phone: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: { name: '', relationship: '', phone: '' },
    doctorDetails: emptyDoctorDetails,
  });

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const data = await staffService.getMyStaffProfile();
      setProfile(data);
      setForm({
        phone: data.phone || '',
        gender: data.gender || '',
        dateOfBirth: toDateInputValue(data.dateOfBirth),
        address: data.address || '',
        emergencyContact: {
          name: data.emergencyContact?.name || '',
          relationship: data.emergencyContact?.relationship || '',
          phone: data.emergencyContact?.phone || '',
        },
        doctorDetails: {
          specialization: data.doctorDetails?.specialization || '',
          qualifications: (data.doctorDetails?.qualifications || []).join(', '),
          registrationNumber: data.doctorDetails?.registrationNumber || '',
          yearsOfExperience: data.doctorDetails?.yearsOfExperience ?? '',
          bio: data.doctorDetails?.bio || '',
          nameBangla: data.doctorDetails?.nameBangla || '',
          degreesBangla: data.doctorDetails?.degreesBangla || '',
          designationBangla: data.doctorDetails?.designationBangla || '',
          departmentBangla: data.doctorDetails?.departmentBangla || '',
          specialtyBangla: data.doctorDetails?.specialtyBangla || '',
        },
      });
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        phone: form.phone,
        address: form.address,
        emergencyContact: form.emergencyContact,
      };
      if (form.gender) payload.gender = form.gender;
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;

      if (isDoctor) {
        payload.doctorDetails = {
          specialization: form.doctorDetails.specialization,
          qualifications: form.doctorDetails.qualifications
            .split(',')
            .map((q) => q.trim())
            .filter(Boolean),
          registrationNumber: form.doctorDetails.registrationNumber,
          bio: form.doctorDetails.bio,
          nameBangla: form.doctorDetails.nameBangla,
          degreesBangla: form.doctorDetails.degreesBangla,
          designationBangla: form.doctorDetails.designationBangla,
          departmentBangla: form.doctorDetails.departmentBangla,
          specialtyBangla: form.doctorDetails.specialtyBangla,
        };
        if (form.doctorDetails.yearsOfExperience !== '') {
          payload.doctorDetails.yearsOfExperience = Number(form.doctorDetails.yearsOfExperience);
        }
      }

      const updated = await staffService.updateMyStaffProfile(payload);
      setProfile(updated);
      toast({ title: t('myProfile.saveSuccess', 'Profile updated.'), variant: 'success' });
    } catch (error) {
      setSaveError(extractApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') {
    return (
      <div>
        <PageHeader title={t('myProfile.title', 'My Profile')} />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div>
        <PageHeader title={t('myProfile.title', 'My Profile')} />
        <ErrorState description={errorMessage} onRetry={load} />
      </div>
    );
  }

  const setTop = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setEmergency = (key) => (e) =>
    setForm((f) => ({ ...f, emergencyContact: { ...f.emergencyContact, [key]: e.target.value } }));
  const setDoctor = (key) => (e) =>
    setForm((f) => ({ ...f, doctorDetails: { ...f.doctorDetails, [key]: e.target.value } }));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <FormHero
        icon={UserRound}
        title={t('myProfile.title', 'My Profile')}
        description={t(
          'myProfile.description',
          'Your own details — including your Bangla name and credentials shown on prescriptions.',
        )}
      />

      {saveError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      <FormSection icon={BadgeCheck} title={t('myProfile.identity', 'Identity')}>
        <FloatReadOnly label={t('myProfile.name', 'Name')} icon={User} value={profile?.user?.name} />
        <FloatReadOnly label={t('myProfile.email', 'Email')} icon={Mail} value={profile?.user?.email} />
        <FloatReadOnly label={t('myProfile.employeeId', 'Employee ID')} icon={Hash} value={profile?.employeeId} />
        <FloatReadOnly
          label={t('myProfile.designation', 'Designation')}
          icon={Briefcase}
          value={labelFor(profile?.designation) || profile?.designation}
        />
        {profile?.department ? (
          <FloatReadOnly label={t('myProfile.department', 'Department')} icon={Building2} value={profile.department} />
        ) : null}
      </FormSection>

      <FormSection icon={User} title={t('myProfile.personal', 'Personal details')}>
        <FloatInput label={t('myProfile.phone', 'Phone')} icon={Phone} type="tel" placeholder="Enter your phone number" value={form.phone} onChange={setTop('phone')} />
        <FloatSelect label={t('myProfile.gender', 'Gender')} icon={Users} value={form.gender} onChange={setTop('gender')}>
          <option value="">Select gender</option>
          {STAFF_GENDERS.map((g) => (
            <option key={g} value={g}>{labelFor(g)}</option>
          ))}
        </FloatSelect>
        <FloatInput label={t('myProfile.dateOfBirth', 'Date of birth')} icon={Calendar} type="date" value={form.dateOfBirth} onChange={setTop('dateOfBirth')} />
        <FloatInput label={t('myProfile.address', 'Address')} icon={MapPin} placeholder="Enter your address" value={form.address} onChange={setTop('address')} />
      </FormSection>

      <FormSection icon={Siren} title={t('myProfile.emergencyContact', 'Emergency contact')}>
        <FloatInput label={t('myProfile.contactName', 'Name')} icon={User} placeholder="Contact's full name" value={form.emergencyContact.name} onChange={setEmergency('name')} />
        <FloatInput label={t('myProfile.contactRelationship', 'Relationship')} icon={Users} placeholder="e.g. Spouse, parent" value={form.emergencyContact.relationship} onChange={setEmergency('relationship')} />
        <FloatInput label={t('myProfile.contactPhone', 'Phone')} icon={Phone} type="tel" placeholder="Contact's phone number" value={form.emergencyContact.phone} onChange={setEmergency('phone')} />
      </FormSection>

      {isDoctor ? (
        <FormSection icon={Stethoscope} title={t('myProfile.clinical', 'Clinical & prescription details')}>
          <p className="text-sm text-muted-foreground sm:col-span-2 -mt-2">
            {t(
              'myProfile.clinicalHint',
              'These appear on your printed prescriptions and lab requisitions — including the Bangla letterhead. Leave the Bangla fields blank to use the practice default.',
            )}
          </p>
          <FloatInput label={t('myProfile.specialization', 'Specialization (English)')} icon={Stethoscope} value={form.doctorDetails.specialization} onChange={setDoctor('specialization')} />
          <FloatInput label={t('myProfile.specialtyBangla', 'Specialty (Bangla)')} icon={Languages} value={form.doctorDetails.specialtyBangla} onChange={setDoctor('specialtyBangla')} placeholder="কিডনী রোগ ও কিডনি প্রতিস্থাপন বিশেষজ্ঞ" />
          <FloatInput label={t('myProfile.qualifications', 'Degrees (English, comma-separated)')} icon={BookOpen} value={form.doctorDetails.qualifications} onChange={setDoctor('qualifications')} placeholder="MBBS, MD (Nephrology), FRCP (Edin)" />
          <FloatInput label={t('myProfile.degreesBangla', 'Degrees (Bangla)')} icon={Languages} value={form.doctorDetails.degreesBangla} onChange={setDoctor('degreesBangla')} placeholder="এমবিবিএস, এমডি (নেফ্রোলজি), এফআরসিপি (এডিন)" />
          <FloatInput label={t('myProfile.nameBangla', 'Your name (Bangla)')} icon={Languages} value={form.doctorDetails.nameBangla} onChange={setDoctor('nameBangla')} placeholder="প্রফেসর ডা. ..." />
          <FloatInput label={t('myProfile.designationBangla', 'Designation (Bangla)')} icon={Languages} value={form.doctorDetails.designationBangla} onChange={setDoctor('designationBangla')} placeholder="অধ্যাপক ও বিভাগীয় প্রধান" />
          <FloatInput label={t('myProfile.departmentBangla', 'Department (Bangla)')} icon={Languages} value={form.doctorDetails.departmentBangla} onChange={setDoctor('departmentBangla')} placeholder="কিডনী রোগ ও ডায়ালাইসিস বিভাগ" />
          <FloatInput label={t('myProfile.registrationNumber', 'Registration number (BM&DC)')} icon={Hash} value={form.doctorDetails.registrationNumber} onChange={setDoctor('registrationNumber')} />
          <FloatInput label={t('myProfile.yearsOfExperience', 'Years of experience')} icon={Briefcase} type="number" min="0" max="80" value={form.doctorDetails.yearsOfExperience} onChange={setDoctor('yearsOfExperience')} />
          <FloatTextarea className="sm:col-span-2" label={t('myProfile.bio', 'Short bio')} icon={FileText} value={form.doctorDetails.bio} onChange={setDoctor('bio')} />
        </FormSection>
      ) : null}

      <SaveBar saving={saving} label={t('common.saveChanges', 'Save Changes')} savingLabel={t('common.saving', 'Saving...')} />
    </form>
  );
}
