import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserCheck, UserPlus, Link as LinkIcon } from 'lucide-react';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { PATIENT_GENDERS, PREFERRED_LANGUAGES, labelFor } from '../../constants/patients.js';
import { FloatField, FloatSelect, controlClass } from '../../components/ui/profile-form.jsx';

const inputClass =
  'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];

const emptyForm = {
  firstName: '',
  lastName: '',
  gender: 'MALE',
  dateOfBirth: '',
  age: '',
  phone: '',
  bloodGroup: 'UNKNOWN',
  preferredLanguage: 'en',
  linkAccount: '',
};

export default function RegisterPatientDialog({ open, onOpenChange, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [showLinkAccount, setShowLinkAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (name) => (event) => {
    const val = event.target.value;
    setForm((prev) => {
      const next = { ...prev, [name]: val };
      // If age is typed, compute approximate DOB
      if (name === 'age' && val && !isNaN(val)) {
        const approxYear = new Date().getFullYear() - parseInt(val, 10);
        next.dateOfBirth = `${approxYear}-01-01`;
      }
      return next;
    });
  };

  const reset = () => {
    setForm(emptyForm);
    setShowLinkAccount(false);
    setError('');
  };

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    let effectiveDob = form.dateOfBirth;
    if (!effectiveDob && form.age) {
      const approxYear = new Date().getFullYear() - parseInt(form.age, 10);
      effectiveDob = `${approxYear}-01-01`;
    }

    if (!effectiveDob) {
      setError('Please provide a Date of Birth or Age.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        userId: form.linkAccount.trim() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateOfBirth: effectiveDob,
        phone: form.phone.trim() || undefined,
        bloodGroup: form.bloodGroup || undefined,
        preferredLanguage: form.preferredLanguage,
      };

      const created = await patientsService.createPatient(payload);
      reset();
      onOpenChange(false);
      onCreated?.(created);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-lg">
      {open ? (
        <div className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} className="text-primary" /> {t('patients.registerDialog.title', 'Register Patient')}
            </DialogTitle>
            <DialogDescription>
              {t('patients.registerDialog.quickDesc', 'Quickly create a patient profile to write prescriptions, schedule appointments, and manage medical records.')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 max-h-[68vh] overflow-y-auto px-1 pb-1 pt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <form id="register-patient-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FloatField label={<>{t('patients.registerDialog.firstName', 'First Name')} *</>} surface="card">
                  <input
                    required
                    autoFocus
                    className={controlClass}
                    placeholder="e.g. John"
                    value={form.firstName}
                    onChange={set('firstName')}
                  />
                </FloatField>
                <FloatField label={<>{t('patients.registerDialog.lastName', 'Last Name')} *</>} surface="card">
                  <input
                    required
                    className={controlClass}
                    placeholder="e.g. Doe"
                    value={form.lastName}
                    onChange={set('lastName')}
                  />
                </FloatField>

                <FloatSelect label={<>{t('patients.registerDialog.gender', 'Gender')} *</>} surface="card" value={form.gender} onChange={set('gender')}>
                  {PATIENT_GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {labelFor(g, t)}
                    </option>
                  ))}
                </FloatSelect>

                <FloatField label={t('patients.registerDialog.phone', 'Phone Number')} surface="card">
                  <input
                    className={controlClass}
                    placeholder="e.g. 017xxxxxxxx"
                    value={form.phone}
                    onChange={set('phone')}
                  />
                </FloatField>

                <FloatField label={<>{t('patients.registerDialog.dateOfBirth', 'Date of Birth')} *</>} surface="card">
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className={controlClass}
                    value={form.dateOfBirth}
                    onChange={set('dateOfBirth')}
                  />
                </FloatField>

                <FloatField label={t('patients.registerDialog.ageOrApprox', 'Or Age (Years)')} surface="card">
                  <input
                    type="number"
                    min="0"
                    max="130"
                    className={controlClass}
                    placeholder="e.g. 35"
                    value={form.age}
                    onChange={set('age')}
                  />
                </FloatField>

                <FloatSelect label="Blood Group" surface="card" value={form.bloodGroup} onChange={set('bloodGroup')}>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg === 'UNKNOWN' ? labelFor(bg, t) : bg}
                    </option>
                  ))}
                </FloatSelect>

                <FloatSelect label={t('patients.registerDialog.preferredLanguage', 'Language')} surface="card" value={form.preferredLanguage} onChange={set('preferredLanguage')}>
                  {PREFERRED_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {labelFor(l, t)}
                    </option>
                  ))}
                </FloatSelect>
              </div>

              {/* Optional Portal Account Linking */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowLinkAccount(!showLinkAccount)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <LinkIcon size={12} />
                  {showLinkAccount
                    ? 'Hide online portal linking'
                    : 'Optionally link existing online account (email or username)'}
                </button>

                {showLinkAccount && (
                  <div className="mt-2">
                    <FloatField label="Account ID / Email / Username" surface="card">
                      <input
                        className={controlClass}
                        placeholder="e.g. patient@ashshafi.local"
                        value={form.linkAccount}
                        onChange={set('linkAccount')}
                      />
                    </FloatField>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Leave blank to auto-create a walk-in patient account automatically.
                    </p>
                  </div>
                )}
              </div>
            </form>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" form="register-patient-form" size="sm" disabled={saving} className="gap-1.5">
              <UserCheck size={14} />
              {saving ? t('patients.registerDialog.creating', 'Registering…') : t('patients.registerDialog.createProfile', 'Register Patient')}
            </Button>
          </DialogFooter>
        </div>
      ) : null}
    </Dialog>
  );
}
