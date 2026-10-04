import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, CheckCircle2, Pencil, Stethoscope, FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../providers/AuthProvider.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import * as encountersService from '../../services/encountersService.js';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { MEDICAL_RECORDS_WRITE_ROLES } from '../../constants/roles.js';
import { PageHeader } from '../../components/ui/page-header.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Alert, AlertDescription } from '../../components/ui/alert.jsx';
import { ErrorState, EmptyState } from '../../components/ui/empty-state.jsx';
import { Skeleton } from '../../components/ui/skeleton.jsx';
import EncounterClinicalFields from '../../components/clinical/EncounterClinicalFields.jsx';
import AmendEncounterDialog from '../../components/clinical/AmendEncounterDialog.jsx';
import { formatDate, formatDateTime } from '../../lib/dateFormat.js';

const emptyFields = {
  chiefComplaint: '',
  examinationFindings: '',
  vitals: {},
  diagnoses: [],
  clinicalFindings: '',
  assessment: '',
  treatmentPlan: '',
  instructions: '',
  followUp: {},
};

const toFormValue = (encounter) => ({
  chiefComplaint: encounter.chiefComplaint || '',
  examinationFindings: encounter.examinationFindings || '',
  vitals: encounter.vitals || {},
  diagnoses: encounter.diagnoses || [],
  clinicalFindings: encounter.clinicalFindings || '',
  assessment: encounter.assessment || '',
  treatmentPlan: encounter.treatmentPlan || '',
  instructions: encounter.instructions || '',
  followUp: encounter.followUp || {},
});

const statusVariant = (status) => {
  if (status === 'FINALIZED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'neutral';
};

/**
 * FET-08 — Consultation & Clinical Encounters: the full consultation
 * workspace. Handles both "new consultation"
 * (`/dashboard/patients/:patientProfileId/consultations/new`) and
 * viewing/editing an existing one
 * (`/dashboard/patients/:patientProfileId/consultations/:encounterId`)
 * against the real `BET-09` API (`services/encountersService.js`).
 *
 * Follows the encounter state machine exactly as
 * `encounter.service.js` enforces it server-side: a DRAFT can be
 * saved repeatedly and finalized; once FINALIZED, the form goes
 * read-only and the only way to correct it is the traceable
 * `AmendEncounterDialog`. This page never tries to work around that
 * — the UI's read-only state is a mirror of the backend's real 409
 * (`ENCOUNTER_FINALIZED`), not an independent rule.
 *
 * "Previous consultations" and basic patient context (name, patient
 * ID, allergies) are shown alongside the form per the roadmap's
 * "patient history during consultation" / "previous consultations"
 * bullets. "Related investigations/prescriptions/reports" are shown
 * as an honest not-yet-available note — `Encounter.relatedInvestigations`/
 * `relatedPrescriptions` are real forward-looking refs on the model
 * (BET-09) but nothing populates them yet, since the Investigations
 * (BET-12) and Prescriptions (BET-11) modules have no frontend of
 * their own until their own FET tasks — faking a list here would
 * violate master prompt §79.
 *
 * FET-17 — fully localized, including the encounter status badges
 * (`clinical.encounter.status.*`) and two raw-date bypasses
 * (`toLocaleDateString`/`toLocaleString` → shared `formatDate`/
 * `formatDateTime`).
 */
export default function ConsultationPage() {
  const { t } = useTranslation();
  const { patientProfileId, encounterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { toast } = useToast();

  const isNew = encounterId === 'new';
  const canWrite = MEDICAL_RECORDS_WRITE_ROLES.includes(user?.role);

  const encounterStatusLabel = (status) => t(`clinical.encounter.status.${status}`, status);

  const [patient, setPatient] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [previousEncounters, setPreviousEncounters] = useState([]);
  const [fields, setFields] = useState(emptyFields);
  const [encounterDate, setEncounterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const [patientProfile, allEncounters] = await Promise.all([
        patientsService.getPatient(patientProfileId),
        encountersService.listEncountersByPatient(patientProfileId),
      ]);
      setPatient(patientProfile);

      if (isNew) {
        setEncounter(null);
        setFields(emptyFields);
        setEncounterDate(new Date().toISOString().slice(0, 10));
        setPreviousEncounters(allEncounters);
      } else {
        const current = allEncounters.find((e) => (e._id || e.id) === encounterId);
        const full = current || (await encountersService.getEncounter(encounterId));
        setEncounter(full);
        setFields(toFormValue(full));
        setEncounterDate(new Date(full.encounterDate).toISOString().slice(0, 10));
        setPreviousEncounters(allEncounters.filter((e) => (e._id || e.id) !== encounterId));
      }
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [patientProfileId, encounterId, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveDraft = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');
    try {
      if (isNew) {
        const created = await encountersService.createEncounter(patientProfileId, {
          encounterDate,
          ...fields,
        });
        toast({ title: t('clinical.consultation.savedToastTitle'), description: t('clinical.consultation.savedToastDescription'), variant: 'success' });
        navigate(`/dashboard/patients/${patientProfileId}/consultations/${created._id || created.id}`, {
          replace: true,
        });
      } else {
        const updated = await encountersService.updateEncounter(encounter._id || encounter.id, {
          encounterDate,
          ...fields,
        });
        setEncounter(updated);
        setFields(toFormValue(updated));
        toast({ title: t('clinical.consultation.draftSavedToastTitle'), variant: 'success' });
      }
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    const ok = await confirm({
      title: t('clinical.consultation.finalizeConfirmTitle'),
      description: t('clinical.consultation.finalizeConfirmDescription'),
      confirmLabel: t('clinical.prescription.finalize'),
    });
    if (!ok) return;

    setFinalizing(true);
    setErrorMessage('');
    try {
      const finalized = await encountersService.finalizeEncounter(encounter._id || encounter.id);
      setEncounter(finalized);
      setFields(toFormValue(finalized));
      toast({ title: t('clinical.consultation.finalizedToastTitle'), variant: 'success' });
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
    } finally {
      setFinalizing(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state === 'error') {
    return <ErrorState description={errorMessage} onRetry={load} />;
  }

  const patientName = patient.fullName || `${patient.firstName} ${patient.lastName}`;
  const isFinalized = encounter?.status === 'FINALIZED';
  const readOnly = !canWrite || isFinalized;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t('dashboard.breadcrumb'), to: '/dashboard' },
          { label: t('nav.patients'), to: '/dashboard/patients' },
          { label: patientName, to: `/dashboard/patients/${patientProfileId}?tab=consultations` },
          { label: isNew ? t('clinical.consultation.newTitle') : t('clinical.consultation.title') },
        ]}
        title={isNew ? t('clinical.consultation.newTitle') : t('clinical.consultation.title')}
        description={
          <span className="inline-flex items-center gap-2">
            <span>{patientName}</span>
            <span className="font-mono text-xs">{patient.patientId}</span>
            {encounter ? (
              <Badge variant={statusVariant(encounter.status)}>{encounterStatusLabel(encounter.status)}</Badge>
            ) : (
              <Badge variant="warning">{encounterStatusLabel('DRAFT')}</Badge>
            )}
          </span>
        }
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              {!isFinalized ? (
                <Button type="submit" form="consultation-form" size="sm" disabled={saving}>
                  <Save size={14} /> {saving ? t('common.saving') : t('clinical.prescription.saveDraft')}
                </Button>
              ) : null}
              {!isNew && !isFinalized ? (
                <Button type="button" size="sm" variant="outline" onClick={handleFinalize} disabled={finalizing}>
                  <CheckCircle2 size={14} /> {finalizing ? t('clinical.prescription.finalizing') : t('clinical.prescription.finalize')}
                </Button>
              ) : null}
              {isFinalized ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setAmendOpen(true)}>
                  <Pencil size={14} /> {t('clinical.report.amend')}
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <form id="consultation-form" onSubmit={handleSaveDraft} className="space-y-5">
          <div className="rounded-xl border border-border p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Stethoscope size={16} aria-hidden="true" /> {t('clinical.consultation.detailsHeading')}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium space-y-1">
                {t('clinical.consultation.encounterDate')}
                <input
                  type="date"
                  disabled={readOnly}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={encounterDate}
                  onChange={(e) => setEncounterDate(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                {t('clinical.fields.provider')}
                <input
                  disabled
                  className="w-full h-10 rounded-lg border border-border bg-muted px-3 text-sm opacity-80"
                  value={encounter?.provider?.name || (isNew ? user?.name || '' : '—')}
                />
              </label>
            </div>

            <EncounterClinicalFields value={fields} onChange={setFields} disabled={readOnly} />
          </div>

          {isFinalized ? (
            <p className="text-xs text-muted-foreground">
              {t('clinical.consultation.finalizedNoticePrefix')}{' '}
              {encounter.finalizedAt
                ? t('clinical.consultation.finalizedNoticeOn', { when: formatDateTime(encounter.finalizedAt) })
                : ''}{' '}
              {t('clinical.consultation.finalizedNoticeSuffix')}
            </p>
          ) : null}
        </form>

        <div className="space-y-5">
          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="text-sm font-semibold">{t('clinical.consultation.patientHistory')}</div>
            {patient.medicalHistoryRedacted ? (
              <p className="text-xs text-muted-foreground">{t('clinical.consultation.historyRedacted')}</p>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  {t('clinical.consultation.allergiesLabel')}{' '}
                  {patient.allergies?.length
                    ? patient.allergies.map((a) => a.allergen).join(', ')
                    : t('clinical.consultation.noneRecorded')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('clinical.consultation.chronicConditionsLabel')}{' '}
                  {patient.chronicConditions?.length
                    ? patient.chronicConditions.map((c) => c.condition).join(', ')
                    : t('clinical.consultation.noneRecorded')}
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="text-sm font-semibold">{t('clinical.consultation.previousConsultations')}</div>
            {previousEncounters.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('clinical.consultation.noEarlierConsultations')}</p>
            ) : (
              <ul className="space-y-1.5">
                {previousEncounters.map((item) => (
                  <li key={item._id || item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/dashboard/patients/${patientProfileId}/consultations/${item._id || item.id}`)
                      }
                      className="w-full text-left text-xs rounded-lg border border-border px-2.5 py-2 hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{formatDate(item.encounterDate)}</span>
                        <Badge variant={statusVariant(item.status)}>{encounterStatusLabel(item.status)}</Badge>
                      </div>
                      {item.chiefComplaint ? (
                        <div className="truncate text-muted-foreground mt-0.5">{item.chiefComplaint}</div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-border p-4 space-y-2">
            <div className="text-sm font-semibold">{t('clinical.consultation.relatedRecords')}</div>
            <EmptyState
              icon={FlaskConical}
              title={t('clinical.consultation.relatedRecordsUnavailableTitle')}
              description={t('clinical.consultation.relatedRecordsUnavailableDescription')}
            />
          </div>
        </div>
      </div>

      {encounter ? (
        <AmendEncounterDialog
          open={amendOpen}
          onOpenChange={setAmendOpen}
          encounter={encounter}
          onAmended={(updated) => {
            setEncounter(updated);
            setFields(toFormValue(updated));
          }}
        />
      ) : null}
    </div>
  );
}
