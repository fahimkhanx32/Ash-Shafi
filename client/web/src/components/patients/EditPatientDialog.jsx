import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import {
  PATIENT_GENDERS,
  PATIENT_BLOOD_GROUPS,
  PREFERRED_LANGUAGES,
  PREFERRED_COMMUNICATION_METHODS,
  labelFor,
} from '../../constants/patients.js';
import { FloatField, controlClass } from '../../components/ui/profile-form.jsx';

const inputClass = 'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

const buildForm = (profile) => ({
  firstName: profile?.firstName || '',
  lastName: profile?.lastName || '',
  gender: profile?.gender || 'FEMALE',
  dateOfBirth: toDateInput(profile?.dateOfBirth),
  bloodGroup: profile?.bloodGroup || '',
  phone: profile?.phone || '',
  alternatePhone: profile?.alternatePhone || '',
  nationality: profile?.nationality || '',
  nationalIdNumber: profile?.nationalIdNumber || '',
  street: profile?.address?.street || '',
  city: profile?.address?.city || '',
  state: profile?.address?.state || '',
  postalCode: profile?.address?.postalCode || '',
  country: profile?.address?.country || '',
  emergencyName: profile?.emergencyContact?.name || '',
  emergencyRelationship: profile?.emergencyContact?.relationship || '',
  emergencyPhone: profile?.emergencyContact?.phone || '',
  emergencyAlternatePhone: profile?.emergencyContact?.alternatePhone || '',
  emergencyEmail: profile?.emergencyContact?.email || '',
  emergencyAddress: profile?.emergencyContact?.address || '',
  preferredLanguage: profile?.preferredLanguage || 'en',
  preferredCommunicationMethod: profile?.preferredCommunicationMethod || 'EMAIL',
});

/**
 * FET-06 — edit a patient's demographics, contact info, emergency
 * contact, and preferences via `PATCH /patients/:id`
 * (`PATIENTS_WRITE`). Deliberately never touches the medical-history
 * fields — those have their own dedicated add/remove UI
 * (`MedicalHistoryTab`) gated on the separate `MEDICAL_RECORDS_WRITE`
 * permission, matching the backend's field-level separation.
 */
export default function EditPatientDialog({ open, onOpenChange, profile, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => buildForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (name) => (event) => {
    setForm((prev) => ({ ...prev, [name]: event.target.value }));
  };

  const handleClose = (nextOpen) => {
    if (nextOpen) setForm(buildForm(profile));
    if (!saving) setError('');
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await patientsService.updatePatient(profile.id || profile._id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        bloodGroup: form.bloodGroup || null,
        phone: form.phone.trim(),
        alternatePhone: form.alternatePhone.trim(),
        nationality: form.nationality.trim(),
        nationalIdNumber: form.nationalIdNumber.trim(),
        address: {
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
        },
        emergencyContact: {
          name: form.emergencyName.trim(),
          relationship: form.emergencyRelationship.trim(),
          phone: form.emergencyPhone.trim(),
          alternatePhone: form.emergencyAlternatePhone.trim(),
          email: form.emergencyEmail.trim(),
          address: form.emergencyAddress.trim(),
        },
        preferredLanguage: form.preferredLanguage,
        preferredCommunicationMethod: form.preferredCommunicationMethod,
      });
      onOpenChange(false);
      onSaved?.(updated);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-2xl">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{t('patients.editDialog.title')}</DialogTitle>
            <DialogDescription>{t('patients.editDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1 space-y-5">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t('patients.editDialog.sectionDemographics')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FloatField label={t('patients.editDialog.firstName')} surface="card">
                  <input required className={controlClass} value={form.firstName} onChange={set('firstName')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.lastName')} surface="card">
                  <input required className={controlClass} value={form.lastName} onChange={set('lastName')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.gender')} surface="card">
                  <select className={controlClass} value={form.gender} onChange={set('gender')}>
                    {PATIENT_GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {labelFor(g, t)}
                      </option>
                    ))}
                  </select>
                </FloatField>
                <FloatField label={t('patients.editDialog.dateOfBirth')} surface="card">
                  <input
                    required
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className={controlClass}
                    value={form.dateOfBirth}
                    onChange={set('dateOfBirth')}
                  />
                </FloatField>
                <FloatField label={t('patients.overview.bloodGroup')} surface="card">
                  <select className={controlClass} value={form.bloodGroup} onChange={set('bloodGroup')}>
                    <option value="">—</option>
                    {PATIENT_BLOOD_GROUPS.map((b) => (
                      <option key={b} value={b}>
                        {labelFor(b, t)}
                      </option>
                    ))}
                  </select>
                </FloatField>
                <FloatField label={t('patients.overview.nationality')} surface="card">
                  <input className={controlClass} value={form.nationality} onChange={set('nationality')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.nationalIdNumber')} surface="card">
                  <input
                    className={controlClass}
                    value={form.nationalIdNumber}
                    onChange={set('nationalIdNumber')}
                  />
                </FloatField>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t('patients.editDialog.sectionContact')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FloatField label={t('patients.overview.phone')} surface="card">
                  <input className={controlClass} value={form.phone} onChange={set('phone')} />
                </FloatField>
                <FloatField label={t('patients.overview.alternatePhone')} surface="card">
                  <input className={controlClass} value={form.alternatePhone} onChange={set('alternatePhone')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.street')} surface="card" className="sm:col-span-2">
                  <input className={controlClass} value={form.street} onChange={set('street')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.city')} surface="card">
                  <input className={controlClass} value={form.city} onChange={set('city')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.state')} surface="card">
                  <input className={controlClass} value={form.state} onChange={set('state')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.postalCode')} surface="card">
                  <input className={controlClass} value={form.postalCode} onChange={set('postalCode')} />
                </FloatField>
                <FloatField label={t('patients.editDialog.country')} surface="card">
                  <input className={controlClass} value={form.country} onChange={set('country')} />
                </FloatField>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t('patients.overview.emergencyContact')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FloatField label={t('patients.overview.name')} surface="card">
                  <input className={controlClass} value={form.emergencyName} onChange={set('emergencyName')} />
                </FloatField>
                <FloatField label={t('patients.overview.relationship')} surface="card">
                  <input
                    className={controlClass}
                    value={form.emergencyRelationship}
                    onChange={set('emergencyRelationship')}
                  />
                </FloatField>
                <FloatField label={t('patients.overview.phone')} surface="card">
                  <input
                    className={controlClass}
                    value={form.emergencyPhone}
                    onChange={set('emergencyPhone')}
                  />
                </FloatField>
                <FloatField label={t('patients.overview.alternatePhone')} surface="card">
                  <input
                    className={controlClass}
                    value={form.emergencyAlternatePhone}
                    onChange={set('emergencyAlternatePhone')}
                  />
                </FloatField>
                <FloatField label={t('patients.overview.email')} surface="card">
                  <input
                    type="email"
                    className={controlClass}
                    value={form.emergencyEmail}
                    onChange={set('emergencyEmail')}
                  />
                </FloatField>
                <FloatField label={t('patients.overview.address')} surface="card">
                  <input
                    className={controlClass}
                    value={form.emergencyAddress}
                    onChange={set('emergencyAddress')}
                  />
                </FloatField>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t('patients.editDialog.sectionPreferences')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FloatField label={t('patients.overview.preferredLanguage')} surface="card">
                  <select
                    className={controlClass}
                    value={form.preferredLanguage}
                    onChange={set('preferredLanguage')}
                  >
                    {PREFERRED_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {labelFor(l, t)}
                      </option>
                    ))}
                  </select>
                </FloatField>
                <FloatField label={t('patients.overview.preferredContactMethod')} surface="card">
                  <select
                    className={controlClass}
                    value={form.preferredCommunicationMethod}
                    onChange={set('preferredCommunicationMethod')}
                  >
                    {PREFERRED_COMMUNICATION_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {labelFor(m, t)}
                      </option>
                    ))}
                  </select>
                </FloatField>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('common.saving') : t('patients.editDialog.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
