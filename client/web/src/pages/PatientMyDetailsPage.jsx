import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Calendar, Droplet, Globe, Languages, Mail, MapPin, Phone, Siren, Smartphone, User, UserRound, Users, } from 'lucide-react';
import { FaFacebookMessenger, FaWhatsapp } from "react-icons/fa";

import * as patientsService from '../services/patientsService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { FormHero, FormSection, FloatInput, FloatSelect, SaveBar } from '../components/ui/profile-form.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { ErrorState } from '../components/ui/empty-state.jsx';
import { PATIENT_GENDERS, PATIENT_BLOOD_GROUPS } from '../constants/patients.js';

const COMM_METHODS = ['EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'MESSENGER'];
const LANGUAGES = [
  ['en', 'English'],
  ['bn', 'বাংলা'],
];

const emptyForm = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  bloodGroup: '',
  phone: '',
  alternatePhone: '',
  contactEmail: '',
  whatsappNumber: '',
  messengerUsername: '',
  nationality: '',
  address: { street: '', city: '', state: '', postalCode: '', country: '' },
  emergencyContact: { name: '', relationship: '', phone: '', email: '' },
  preferredLanguage: 'en',
  preferredCommunicationMethod: 'EMAIL',
};

const toDateInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10);
};

const fromProfile = (p) => ({
  firstName: p.firstName || '',
  lastName: p.lastName || '',
  gender: p.gender || '',
  dateOfBirth: toDateInput(p.dateOfBirth),
  bloodGroup: p.bloodGroup || '',
  phone: p.phone || '',
  alternatePhone: p.alternatePhone || '',
  contactEmail: p.contactEmail || '',
  whatsappNumber: p.whatsappNumber || '',
  messengerUsername: p.messengerUsername || '',
  nationality: p.nationality || '',
  address: { ...emptyForm.address, ...(p.address || {}) },
  emergencyContact: { ...emptyForm.emergencyContact, ...(p.emergencyContact || {}) },
  // Legacy values that are no longer offered fall back to English.
  preferredLanguage: LANGUAGES.some(([v]) => v === p.preferredLanguage) ? p.preferredLanguage : 'en',
  preferredCommunicationMethod: p.preferredCommunicationMethod || 'EMAIL',
});

// Only the fields the server's self-service allowlist accepts.
const toPayload = (f) => ({
  firstName: f.firstName.trim(),
  lastName: f.lastName.trim(),
  gender: f.gender,
  dateOfBirth: f.dateOfBirth,
  bloodGroup: f.bloodGroup || null,
  phone: f.phone,
  alternatePhone: f.alternatePhone,
  contactEmail: f.contactEmail,
  whatsappNumber: f.whatsappNumber,
  messengerUsername: f.messengerUsername,
  nationality: f.nationality,
  address: f.address,
  emergencyContact: f.emergencyContact,
  preferredLanguage: f.preferredLanguage,
  preferredCommunicationMethod: f.preferredCommunicationMethod,
});

/**
 * Patient self-service "My details": a patient edits their own contact and
 * demographic details (or creates the profile if the account has none).
 * Clinical/administrative fields are intentionally absent — the server
 * rejects them on this endpoint too.
 */
export default function PatientMyDetailsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState('loading'); // loading | ready | error
  const [hasProfile, setHasProfile] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    patientsService
      .getMyPatientProfile()
      .then((p) => {
        setForm(fromProfile(p));
        setHasProfile(true);
        setState('ready');
      })
      .catch((err) => {
        const e = extractApiError(err);
        if (e.code === 'PROFILE_NOT_FOUND') {
          setHasProfile(false);
          setForm(emptyForm);
          setState('ready');
        } else {
          setLoadError(e.message);
          setState('error');
        }
      });
  }, []);

  useEffect(load, [load]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setNested = (group, key) => (e) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: e.target.value } }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.gender || !form.dateOfBirth) {
      setError('First name, last name, gender and date of birth are required.');
      return;
    }
    setSaving(true);
    try {
      const wasCreating = !hasProfile;
      const saved = hasProfile
        ? await patientsService.updateMyPatientProfile(toPayload(form))
        : await patientsService.createMyPatientProfile(toPayload(form));
      setForm(fromProfile(saved));
      setHasProfile(true);
      toast({ title: 'Your details were saved', variant: 'success' });
      // First-time setup: continue to the dashboard, where booking now works.
      if (wasCreating) navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') {
    return <div className="h-64 w-full animate-pulse rounded-3xl bg-card/60" />;
  }
  if (state === 'error') {
    return <ErrorState description={loadError} onRetry={load} />;
  }

  const genderLabel = (g) => g.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

  return (
    <form onSubmit={handleSave} noValidate>
      <FormHero icon={UserRound} title={t('nav.myDetails', 'My details')} description={ hasProfile ? `Keep your personal and contact details up to date. Sign-in email: ${user?.email || '—'}` : 'Your account has no patient profile yet. Fill this in to book appointments and receive care.' } />

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormSection icon={User} title="Personal">
        <FloatInput label="First Name *" icon={User} placeholder="Enter your first name" value={form.firstName} onChange={set('firstName')} maxLength={100} />
        <FloatInput label="Last Name *" icon={User} placeholder="Enter your last name" value={form.lastName} onChange={set('lastName')} maxLength={100} />
        <FloatSelect label="Gender *" icon={Users} value={form.gender} onChange={set('gender')}>
          <option value="">Select gender</option>
          {PATIENT_GENDERS.map((g) => (
            <option key={g} value={g}>{genderLabel(g)}</option>
          ))}
        </FloatSelect>
        <FloatInput
          label="Date of Birth *"
          icon={Calendar}
          type="date"
          value={form.dateOfBirth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={set('dateOfBirth')}
        />
        <FloatSelect label="Blood Group" icon={Droplet} value={form.bloodGroup} onChange={set('bloodGroup')}>
          <option value="">Select blood group</option>
          {PATIENT_BLOOD_GROUPS.filter((b) => b !== 'UNKNOWN').map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </FloatSelect>
        <FloatInput label="Nationality (optional)" icon={Globe} placeholder="Enter your nationality" value={form.nationality} onChange={set('nationality')} maxLength={100} />
      </FormSection>

      <FormSection icon={Phone} title="Preferred contact method">
        <FloatInput label="Email" icon={Mail} type="email" placeholder="Enter your email address" value={form.contactEmail} onChange={set('contactEmail')} maxLength={150} />
        <FloatInput label="WhatsApp" icon={FaWhatsapp} type="tel" placeholder="Enter your WhatsApp number" value={form.whatsappNumber} onChange={set('whatsappNumber')} maxLength={30} />
        <FloatInput label="Messenger" icon={FaFacebookMessenger} placeholder="Enter your Facebook's Messenger username" value={form.messengerUsername} onChange={set('messengerUsername')} maxLength={100} />
        <FloatInput label="SMS" icon={Smartphone} type="tel" placeholder="Enter your phone number" value={form.phone} onChange={set('phone')} maxLength={30} />
        <FloatSelect label="Contact me first by" icon={Phone} value={form.preferredCommunicationMethod} onChange={set('preferredCommunicationMethod')}>
          {COMM_METHODS.map((m) => (
            <option key={m} value={m}>{genderLabel(m)}</option>
          ))}
        </FloatSelect>
        <FloatInput label="Alternate phone" icon={Phone} type="tel" placeholder="Another number we can reach" value={form.alternatePhone} onChange={set('alternatePhone')} maxLength={30} />
      </FormSection>

      <FormSection icon={MapPin} title="Address">
        <FloatInput label="Street" icon={MapPin} placeholder="House, road, area" value={form.address.street} onChange={setNested('address', 'street')} maxLength={200} />
        <FloatInput label="City" icon={MapPin} placeholder="City" value={form.address.city} onChange={setNested('address', 'city')} maxLength={100} />
        <FloatInput label="State / Division" icon={MapPin} placeholder="State or division" value={form.address.state} onChange={setNested('address', 'state')} maxLength={100} />
        <FloatInput label="Postal Code" icon={MapPin} placeholder="Postal code" value={form.address.postalCode} onChange={setNested('address', 'postalCode')} maxLength={20} />
        <FloatInput label="Country" icon={Globe} placeholder="Country" value={form.address.country} onChange={setNested('address', 'country')} maxLength={100} />
      </FormSection>

      <FormSection icon={Siren} title="Emergency contact">
        <FloatInput label="Name" icon={User} placeholder="Contact's full name" value={form.emergencyContact.name} onChange={setNested('emergencyContact', 'name')} maxLength={120} />
        <FloatInput label="Relationship" icon={User} placeholder="e.g. Spouse, parent" value={form.emergencyContact.relationship} onChange={setNested('emergencyContact', 'relationship')} maxLength={80} />
        <FloatInput label="Phone" icon={Phone} type="tel" placeholder="Contact's phone number" value={form.emergencyContact.phone} onChange={setNested('emergencyContact', 'phone')} maxLength={30} />
        <FloatInput label="Email" icon={Mail} type="email" placeholder="Contact's email address" value={form.emergencyContact.email} onChange={setNested('emergencyContact', 'email')} maxLength={150} />
      </FormSection>

      <FormSection icon={Languages} title="Language">
        <FloatSelect label="Preferred language" icon={Languages} value={form.preferredLanguage} onChange={set('preferredLanguage')}>
          {LANGUAGES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </FloatSelect>
      </FormSection>

      <SaveBar saving={saving} label={hasProfile ? 'Save Changes' : 'Create my profile'} />
    </form>
  );
}
