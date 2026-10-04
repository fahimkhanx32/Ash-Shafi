import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, ShieldAlert, ClipboardList } from 'lucide-react';

import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import ArrayRecordSection from '../clinical/ArrayRecordSection.jsx';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';

const emptySmoking = {
  cigarettesPerDay: '',
  yearsSmoked: '',
  startDate: '',
  quitDate: '',
  packYears: null,
  notes: '',
};

const emptySocial = {
  smokingStatus: 'UNKNOWN',
  smokingDetails: '',
  smoking: emptySmoking,
  alcoholUse: 'UNKNOWN',
  alcoholDetails: '',
  exerciseFrequency: 'UNKNOWN',
  dietaryRestrictions: '',
  occupation: '',
  maritalStatus: 'UNKNOWN',
  notes: '',
};

export default function MedicalHistoryTab({ profile, canWrite, onUpdated }) {
  const { t } = useTranslation();
  const id = profile.id || profile._id;
  const [social, setSocial] = useState({ ...emptySocial, ...profile.socialHistory });
  const [savingSocial, setSavingSocial] = useState(false);
  const [error, setError] = useState('');

  const refreshAfter = (promise) => promise.then((updated) => onUpdated?.(updated));

  const smoking = social.smoking || emptySmoking;
  const updateSmoking = (key, val) => setSocial((p) => ({ ...p, smoking: { ...(p.smoking || emptySmoking), [key]: val } }));

  // Live pack-years preview — the authoritative value is recomputed
  // server-side on save (see patient-profile.model.js), same pattern as
  // the prescription BMI preview.
  const packYearsPreview = (() => {
    const perDay = Number(smoking.cigarettesPerDay);
    const years = Number(smoking.yearsSmoked);
    if (!perDay || !years || perDay <= 0 || years <= 0) return null;
    return Math.round(((perDay / 20) * years) * 10) / 10;
  })();

  const handleSaveSocial = async (event) => {
    event.preventDefault();
    setSavingSocial(true);
    setError('');
    try {
      const updated = await patientsService.updateSocialHistory(id, social);
      onUpdated?.(updated);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSavingSocial(false);
    }
  };

  return (
    <div className="space-y-5">
      <Alert>
        <ShieldAlert size={16} className="shrink-0" />
        <AlertDescription>
          {t('clinical.medHistoryAlert', 'General medical history only — reproductive/sexual-health history lives in the separate Gynecology tab with its own access controls.')}
        </AlertDescription>
      </Alert>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ArrayRecordSection
        title={t('clinical.allergies', 'Allergies')}
        items={profile.allergies}
        canWrite={canWrite}
        emptyLabel={t('clinical.noAllergies', 'No known allergies recorded.')}
        fields={[
          { name: 'allergen', label: 'Allergen', required: true },
          {
            name: 'severity',
            label: 'Severity',
            type: 'select',
            options: ['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'],
          },
          { name: 'reaction', label: 'Reaction' },
          { name: 'diagnosedDate', label: 'Diagnosed date', type: 'date' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(patientsService.allergies.add(id, payload))}
        onRemove={(itemId) => refreshAfter(patientsService.allergies.remove(id, itemId))}
      />

      <ArrayRecordSection
        title={t('clinical.chronicConditions', 'Chronic conditions')}
        items={profile.chronicConditions}
        canWrite={canWrite}
        fields={[
          { name: 'condition', label: 'Condition', required: true },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: ['ACTIVE', 'MANAGED', 'RESOLVED', 'CHRONIC'],
          },
          { name: 'diagnosedDate', label: 'Diagnosed date', type: 'date' },
          { name: 'treatment', label: 'Treatment', type: 'textarea' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(patientsService.chronicConditions.add(id, payload))}
        onRemove={(itemId) => refreshAfter(patientsService.chronicConditions.remove(id, itemId))}
      />

      <ArrayRecordSection
        title={t('clinical.surgeryHistory', 'Surgery history')}
        items={profile.surgeryHistory}
        canWrite={canWrite}
        fields={[
          { name: 'procedure', label: 'Procedure', required: true },
          { name: 'surgeryDate', label: 'Date', type: 'date' },
          { name: 'hospital', label: 'Hospital' },
          { name: 'surgeon', label: 'Surgeon' },
          { name: 'complications', label: 'Complications', type: 'textarea' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(patientsService.surgeryHistory.add(id, payload))}
        onRemove={(itemId) => refreshAfter(patientsService.surgeryHistory.remove(id, itemId))}
      />

      <ArrayRecordSection
        title={t('clinical.medicationHistory', 'Medication history')}
        items={profile.medicationHistory}
        canWrite={canWrite}
        fields={[
          { name: 'medicationName', label: 'Medication', required: true },
          { name: 'dosage', label: 'Dosage' },
          { name: 'frequency', label: 'Frequency' },
          { name: 'startDate', label: 'Start date', type: 'date' },
          { name: 'endDate', label: 'End date', type: 'date' },
          { name: 'isCurrent', label: 'Currently taking', type: 'checkbox' },
          { name: 'prescribedBy', label: 'Prescribed by' },
          { name: 'reason', label: 'Reason', type: 'textarea' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(patientsService.medicationHistory.add(id, payload))}
        onRemove={(itemId) => refreshAfter(patientsService.medicationHistory.remove(id, itemId))}
      />

      <ArrayRecordSection
        title={t('clinical.familyHistory', 'Family history')}
        items={profile.familyHistory}
        canWrite={canWrite}
        fields={[
          { name: 'relationship', label: 'Relationship', required: true },
          { name: 'condition', label: 'Condition', required: true },
          { name: 'ageOfOnset', label: 'Age of onset', type: 'number' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(patientsService.familyHistory.add(id, payload))}
        onRemove={(itemId) => refreshAfter(patientsService.familyHistory.remove(id, itemId))}
      />

      <ArrayRecordSection
        title={t('clinical.vaccinationHistory', 'Vaccination history')}
        items={profile.vaccinationHistory}
        canWrite={canWrite}
        fields={[
          { name: 'vaccineName', label: 'Vaccine', required: true },
          { name: 'dateAdministered', label: 'Date administered', type: 'date' },
          { name: 'doseNumber', label: 'Dose number', type: 'number' },
          { name: 'administeredBy', label: 'Administered by' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(patientsService.vaccinationHistory.add(id, payload))}
        onRemove={(itemId) => refreshAfter(patientsService.vaccinationHistory.remove(id, itemId))}
      />

      <form onSubmit={handleSaveSocial} className="rounded-xl border border-border p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <ClipboardList size={16} aria-hidden="true" /> {t('clinical.socialHistory', 'Social history')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-medium space-y-1">
            Smoking status
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.smokingStatus}
              onChange={(e) => setSocial((p) => ({ ...p, smokingStatus: e.target.value }))}
            >
              {['UNKNOWN', 'NEVER', 'FORMER', 'CURRENT'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1">
            Smoking details
            <input
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.smokingDetails}
              onChange={(e) => setSocial((p) => ({ ...p, smokingDetails: e.target.value }))}
            />
          </label>
        </div>

        {/* Structured smoking history — only meaningful once status isn't NEVER/UNKNOWN */}
        {social.smokingStatus === 'CURRENT' || social.smokingStatus === 'FORMER' ? (
          <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Smoking detail
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <label className="text-xs font-medium space-y-1">
                Cigarettes / day
                <input
                  type="number"
                  min="0"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={smoking.cigarettesPerDay ?? ''}
                  onChange={(e) => updateSmoking('cigarettesPerDay', e.target.value === '' ? null : Number(e.target.value))}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                Years smoked
                <input
                  type="number"
                  min="0"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={smoking.yearsSmoked ?? ''}
                  onChange={(e) => updateSmoking('yearsSmoked', e.target.value === '' ? null : Number(e.target.value))}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                Pack-years
                <div className="w-full h-10 rounded-lg border border-dashed border-border bg-muted/40 px-3 text-sm flex items-center">
                  {packYearsPreview ?? '—'}
                </div>
              </label>
              <label className="text-xs font-medium space-y-1">
                Start date
                <input
                  type="date"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={smoking.startDate ? String(smoking.startDate).slice(0, 10) : ''}
                  onChange={(e) => updateSmoking('startDate', e.target.value || null)}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                Quit date
                <input
                  type="date"
                  disabled={!canWrite || social.smokingStatus !== 'FORMER'}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={smoking.quitDate ? String(smoking.quitDate).slice(0, 10) : ''}
                  onChange={(e) => updateSmoking('quitDate', e.target.value || null)}
                />
              </label>
              <label className="text-xs font-medium space-y-1 sm:col-span-2 md:col-span-1">
                Smoking notes
                <input
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={smoking.notes ?? ''}
                  onChange={(e) => updateSmoking('notes', e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-medium space-y-1">
            Alcohol use
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.alcoholUse}
              onChange={(e) => setSocial((p) => ({ ...p, alcoholUse: e.target.value }))}
            >
              {['UNKNOWN', 'NEVER', 'OCCASIONAL', 'MODERATE', 'HEAVY', 'FORMER'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1">
            Alcohol details
            <input
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.alcoholDetails}
              onChange={(e) => setSocial((p) => ({ ...p, alcoholDetails: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            Exercise frequency
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.exerciseFrequency}
              onChange={(e) => setSocial((p) => ({ ...p, exerciseFrequency: e.target.value }))}
            >
              {['UNKNOWN', 'NONE', 'RARELY', 'WEEKLY', 'DAILY'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1">
            Marital status
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.maritalStatus}
              onChange={(e) => setSocial((p) => ({ ...p, maritalStatus: e.target.value }))}
            >
              {['UNKNOWN', 'SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'OTHER'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1">
            Occupation
            <input
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.occupation}
              onChange={(e) => setSocial((p) => ({ ...p, occupation: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            Dietary restrictions
            <input
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={social.dietaryRestrictions}
              onChange={(e) => setSocial((p) => ({ ...p, dietaryRestrictions: e.target.value }))}
            />
          </label>
        </div>
        <label className="text-xs font-medium space-y-1 block">
          Notes
          <textarea
            disabled={!canWrite}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
            value={social.notes}
            onChange={(e) => setSocial((p) => ({ ...p, notes: e.target.value }))}
          />
        </label>
        {canWrite ? (
          <Button type="submit" size="sm" disabled={savingSocial}>
            <Save size={14} /> {savingSocial ? t('common.saving', 'Saving…') : t('clinical.saveSocialHistory', 'Save social history')}
          </Button>
        ) : null}
      </form>
    </div>
  );
}
