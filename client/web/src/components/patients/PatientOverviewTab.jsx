import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, UserX, UserCheck, Phone, MapPin, Languages, ShieldAlert } from 'lucide-react';

import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { labelFor, patientStatusVariant } from '../../constants/patients.js';
import EditPatientDialog from './EditPatientDialog.jsx';

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon ? <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value || '—'}</div>
      </div>
    </div>
  );
}

/**
 * FET-06 — Patient Profile: demographics, emergency contact,
 * preferences, contact information, patient overview. All fields
 * come straight from `PatientProfile` (`GET /patients/:id`) — no
 * derived/estimated data.
 *
 * FET-17 — every label/value in this tab now goes through `t()`;
 * `labelFor(value, t)` resolves the enum labels through the shared
 * `patients.enum.*` key groups (see `constants/patients.js`).
 */
export default function PatientOverviewTab({ profile, canWrite, onUpdated }) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');

  const address = [profile.address?.street, profile.address?.city, profile.address?.state, profile.address?.country]
    .filter(Boolean)
    .join(', ');

  const emergency = profile.emergencyContact || {};
  const hasEmergencyContact = emergency.name || emergency.phone;

  const toggleStatus = async () => {
    setStatusBusy(true);
    setStatusError('');
    try {
      const updated =
        profile.patientStatus === 'INACTIVE'
          ? await patientsService.reactivatePatient(profile.id || profile._id)
          : await patientsService.deactivatePatient(profile.id || profile._id);
      onUpdated?.(updated);
    } catch (err) {
      setStatusError(extractApiError(err).message);
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {statusError ? (
        <Alert variant="destructive">
          <AlertDescription>{statusError}</AlertDescription>
        </Alert>
      ) : null}

      {profile.medicalHistoryRedacted ? (
        <Alert>
          <ShieldAlert size={16} className="shrink-0" />
          <AlertDescription>{t('patients.overview.medicalHistoryHidden')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{profile.fullName || `${profile.firstName} ${profile.lastName}`}</h2>
              <Badge variant={patientStatusVariant(profile.patientStatus)}>
                {labelFor(profile.patientStatus, t)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {profile.patientId} · {labelFor(profile.gender, t)}
              {profile.age !== null && profile.age !== undefined ? ` · ${t('patients.overview.ageYears', { count: profile.age })}` : ''}
            </p>
          </div>
          {canWrite ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil size={14} /> {t('common.edit')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={statusBusy || profile.patientStatus === 'DECEASED'}
                onClick={toggleStatus}
              >
                {profile.patientStatus === 'INACTIVE' ? (
                  <>
                    <UserCheck size={14} /> {t('patients.overview.reactivate')}
                  </>
                ) : (
                  <>
                    <UserX size={14} /> {t('patients.overview.deactivate')}
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow icon={Phone} label={t('patients.overview.phone')} value={profile.phone} />
          <InfoRow icon={Phone} label={t('patients.overview.alternatePhone')} value={profile.alternatePhone} />
          <InfoRow icon={MapPin} label={t('patients.overview.address')} value={address} />
          <InfoRow label={t('patients.overview.bloodGroup')} value={labelFor(profile.bloodGroup, t)} />
          <InfoRow label={t('patients.overview.nationality')} value={profile.nationality} />
          <InfoRow label={t('patients.overview.nationalId')} value={profile.nationalIdNumber} />
          <InfoRow icon={Languages} label={t('patients.overview.preferredLanguage')} value={labelFor(profile.preferredLanguage, t)} />
          <InfoRow label={t('patients.overview.preferredContactMethod')} value={labelFor(profile.preferredCommunicationMethod, t)} />
          <InfoRow label={t('patients.overview.registered')} value={profile.registrationDate?.slice(0, 10)} />
          <InfoRow label={t('patients.overview.primaryCareProvider')} value={profile.primaryCareProvider?.name} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 sm:p-5">
        <div className="font-semibold text-sm mb-3">{t('patients.overview.emergencyContact')}</div>
        {hasEmergencyContact ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label={t('patients.overview.name')} value={emergency.name} />
            <InfoRow label={t('patients.overview.relationship')} value={emergency.relationship} />
            <InfoRow icon={Phone} label={t('patients.overview.phone')} value={emergency.phone} />
            <InfoRow icon={Phone} label={t('patients.overview.alternatePhone')} value={emergency.alternatePhone} />
            <InfoRow label={t('patients.overview.email')} value={emergency.email} />
            <InfoRow icon={MapPin} label={t('patients.overview.address')} value={emergency.address} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('patients.overview.noEmergencyContact')}</p>
        )}
      </div>

      {profile.medicalNotes ? (
        <div className="rounded-xl border border-border p-4 sm:p-5">
          <div className="font-semibold text-sm mb-2">{t('patients.overview.medicalNotes')}</div>
          <p className="text-sm whitespace-pre-wrap">{profile.medicalNotes}</p>
        </div>
      ) : null}

      <EditPatientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        onSaved={onUpdated}
      />
    </div>
  );
}
