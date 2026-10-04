import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as gynecologyService from '../../services/gynecologyService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import SensitiveDataNotice from './SensitiveDataNotice.jsx';
import ArrayRecordSection from './ArrayRecordSection.jsx';

const emptyMenstrual = {
  menarcheAge: '',
  cycleLengthDays: '',
  periodDurationDays: '',
  cycleRegularity: 'UNKNOWN',
  flow: 'UNKNOWN',
  dysmenorrhea: false,
  menopauseStatus: 'UNKNOWN',
  menopauseAge: '',
  notes: '',
};

const emptyReproductive = {
  totalPregnancies: '',
  totalLiveBirths: '',
  totalMiscarriages: '',
  totalTerminations: '',
  notes: '',
};

// Mirrors `sexualHistorySchema` in the backend model — see that
// model's docstring for why this is kept separate from
// `contraceptionHistory` (birth-control method) and `stiHistory`
// (diagnosed infections). `protectionMethods` is edited here as a
// comma-separated string and split/joined at the request boundary,
// matching how `treatmentsTried` is handled on the fertility form
// elsewhere in this codebase — no new list-editing pattern needed.
const emptySexual = {
  isSexuallyActive: 'UNKNOWN',
  ageAtFirstIntercourse: '',
  numberOfLifetimePartners: '',
  numberOfPartnersLast12Months: '',
  partnerHistoryNotes: '',
  relevantSexualPractices: '',
  exposureHistory: '',
  condomOrProtectionUse: 'UNKNOWN',
  protectionMethods: '',
  notes: '',
};

const numOrNull = (v) => (v === '' || v === undefined ? null : Number(v));

/**
 * FET-07 — Gynecology & Sensitive Records panel.
 *
 * `patientProfileId` drives the clinician view (GET/POST
 * /gynecology/patient/:id, requires SENSITIVE_RECORDS_READ/WRITE).
 * `selfMode` drives the patient's own read-only view (GET
 * /gynecology/me) — same component, no duplicated fetch logic. Every
 * access still runs through the backend's provider-based access +
 * audit-log check (BET-07); a denial here is a real 403, not a UI
 * gate.
 *
 * FET-17 — every static string below (headings, field labels, enum
 * option lists, `ArrayRecordSection` titles/field configs) now
 * resolves through `t()`. Enum option values (`UNKNOWN`, `REGULAR`,
 * `ACTIVE`, …) are looked up via `clinical.gyn.enum.*` with the raw
 * backend value as a fallback, so an option this pass didn't
 * anticipate still renders instead of disappearing.
 */
export default function GynecologyPanel({ patientProfileId, selfMode = false, canWrite = false }) {
  const { t } = useTranslation();
  const [state, setState] = useState('loading'); // loading | ready | not_found | error
  const [record, setRecord] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [menstrual, setMenstrual] = useState(emptyMenstrual);
  const [reproductive, setReproductive] = useState(emptyReproductive);
  const [sexual, setSexual] = useState(emptySexual);
  const [savingSummary, setSavingSummary] = useState(false);
  const [creating, setCreating] = useState(false);

  const enumLabel = (value) => t(`clinical.gyn.enum.${value}`, value);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = selfMode
        ? await gynecologyService.getMyGynecologyRecord()
        : await gynecologyService.getGynecologyRecordByPatientProfileId(patientProfileId);
      setRecord(data);
      setMenstrual({ ...emptyMenstrual, ...data.menstrualHistory });
      setReproductive({ ...emptyReproductive, ...data.reproductiveHistory });
      setSexual({
        ...emptySexual,
        ...data.sexualHistory,
        protectionMethods: (data.sexualHistory?.protectionMethods || []).join(', '),
      });
      setState('ready');
    } catch (error) {
      const apiError = extractApiError(error);
      if (error?.response?.status === 404) {
        setState('not_found');
      } else {
        setErrorMessage(apiError.message);
        setState('error');
      }
    }
  }, [patientProfileId, selfMode]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setErrorMessage('');
    try {
      const data = await gynecologyService.createGynecologyRecord(patientProfileId, {});
      setRecord(data);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSummary = async (event) => {
    event.preventDefault();
    setSavingSummary(true);
    setErrorMessage('');
    try {
      const updated = await gynecologyService.updateGynecologyRecord(record._id, {
        menstrualHistory: {
          ...menstrual,
          menarcheAge: numOrNull(menstrual.menarcheAge),
          cycleLengthDays: numOrNull(menstrual.cycleLengthDays),
          periodDurationDays: numOrNull(menstrual.periodDurationDays),
          menopauseAge: numOrNull(menstrual.menopauseAge),
        },
        reproductiveHistory: {
          ...reproductive,
          totalPregnancies: numOrNull(reproductive.totalPregnancies),
          totalLiveBirths: numOrNull(reproductive.totalLiveBirths),
          totalMiscarriages: numOrNull(reproductive.totalMiscarriages),
          totalTerminations: numOrNull(reproductive.totalTerminations),
        },
        sexualHistory: {
          ...sexual,
          ageAtFirstIntercourse: numOrNull(sexual.ageAtFirstIntercourse),
          numberOfLifetimePartners: numOrNull(sexual.numberOfLifetimePartners),
          numberOfPartnersLast12Months: numOrNull(sexual.numberOfPartnersLast12Months),
          protectionMethods: sexual.protectionMethods
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean),
        },
      });
      setRecord(updated);
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
    } finally {
      setSavingSummary(false);
    }
  };

  const refreshAfter = (promise) => promise.then((updated) => setRecord(updated));

  if (state === 'loading') {
    return <p className="text-sm text-muted-foreground">{t('clinical.gyn.loading')}</p>;
  }

  if (state === 'not_found') {
    return (
      <div className="space-y-3">
        <SensitiveDataNotice />
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {selfMode ? t('clinical.gyn.notFoundSelf') : t('clinical.gyn.notFoundOther')}
        </p>
        {canWrite && !selfMode ? (
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? t('clinical.gyn.creating') : t('clinical.gyn.createRecord')}
          </Button>
        ) : null}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <SensitiveDataNotice />

      <form onSubmit={handleSaveSummary} className="rounded-xl border border-border p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <HeartPulse size={16} aria-hidden="true" /> {t('clinical.gyn.summaryHeading')}
        </div>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.menarcheAge')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={menstrual.menarcheAge}
              onChange={(e) => setMenstrual((p) => ({ ...p, menarcheAge: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.cycleLengthDays')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={menstrual.cycleLengthDays}
              onChange={(e) => setMenstrual((p) => ({ ...p, cycleLengthDays: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.periodDurationDays')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={menstrual.periodDurationDays}
              onChange={(e) => setMenstrual((p) => ({ ...p, periodDurationDays: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.regularity')}
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={menstrual.cycleRegularity}
              onChange={(e) => setMenstrual((p) => ({ ...p, cycleRegularity: e.target.value }))}
            >
              {['UNKNOWN', 'REGULAR', 'IRREGULAR'].map((v) => (
                <option key={v} value={v}>
                  {enumLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.flow')}
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={menstrual.flow}
              onChange={(e) => setMenstrual((p) => ({ ...p, flow: e.target.value }))}
            >
              {['UNKNOWN', 'LIGHT', 'MODERATE', 'HEAVY', 'VARIABLE'].map((v) => (
                <option key={v} value={v}>
                  {enumLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1 flex flex-col justify-end">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!canWrite}
                checked={menstrual.dysmenorrhea}
                onChange={(e) => setMenstrual((p) => ({ ...p, dysmenorrhea: e.target.checked }))}
              />
              {t('clinical.gyn.dysmenorrhea')}
            </span>
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.menopauseStatus')}
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={menstrual.menopauseStatus}
              onChange={(e) => setMenstrual((p) => ({ ...p, menopauseStatus: e.target.value }))}
            >
              {['UNKNOWN', 'PREMENOPAUSAL', 'PERIMENOPAUSAL', 'POSTMENOPAUSAL'].map((v) => (
                <option key={v} value={v}>
                  {enumLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.menopauseAge')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={menstrual.menopauseAge}
              onChange={(e) => setMenstrual((p) => ({ ...p, menopauseAge: e.target.value }))}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.totalPregnancies')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={reproductive.totalPregnancies}
              onChange={(e) => setReproductive((p) => ({ ...p, totalPregnancies: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.liveBirths')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={reproductive.totalLiveBirths}
              onChange={(e) => setReproductive((p) => ({ ...p, totalLiveBirths: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.miscarriages')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={reproductive.totalMiscarriages}
              onChange={(e) => setReproductive((p) => ({ ...p, totalMiscarriages: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.terminations')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={reproductive.totalTerminations}
              onChange={(e) => setReproductive((p) => ({ ...p, totalTerminations: e.target.value }))}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.sexuallyActive')}
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={sexual.isSexuallyActive}
              onChange={(e) => setSexual((p) => ({ ...p, isSexuallyActive: e.target.value }))}
            >
              {['UNKNOWN', 'YES', 'NO'].map((v) => (
                <option key={v} value={v}>
                  {enumLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.ageAtFirstIntercourse')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={sexual.ageAtFirstIntercourse}
              onChange={(e) => setSexual((p) => ({ ...p, ageAtFirstIntercourse: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.lifetimePartners')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={sexual.numberOfLifetimePartners}
              onChange={(e) => setSexual((p) => ({ ...p, numberOfLifetimePartners: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.partnersLast12Months')}
            <input
              type="number"
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={sexual.numberOfPartnersLast12Months}
              onChange={(e) =>
                setSexual((p) => ({ ...p, numberOfPartnersLast12Months: e.target.value }))
              }
            />
          </label>
          <label className="text-xs font-medium space-y-1">
            {t('clinical.gyn.protectionUse')}
            <select
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={sexual.condomOrProtectionUse}
              onChange={(e) => setSexual((p) => ({ ...p, condomOrProtectionUse: e.target.value }))}
            >
              {['UNKNOWN', 'ALWAYS', 'USUALLY', 'SOMETIMES', 'NEVER', 'NOT_APPLICABLE'].map((v) => (
                <option key={v} value={v}>
                  {enumLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1 sm:col-span-1">
            {t('clinical.gyn.protectionMethods')}
            <input
              disabled={!canWrite}
              placeholder={t('clinical.gyn.protectionMethodsPlaceholder')}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={sexual.protectionMethods}
              onChange={(e) => setSexual((p) => ({ ...p, protectionMethods: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1 sm:col-span-2">
            {t('clinical.gyn.partnerHistoryNotes')}
            <input
              disabled={!canWrite}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
              value={sexual.partnerHistoryNotes}
              onChange={(e) => setSexual((p) => ({ ...p, partnerHistoryNotes: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1 sm:col-span-2">
            {t('clinical.gyn.relevantSexualPractices')}
            <textarea
              rows={2}
              disabled={!canWrite}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={sexual.relevantSexualPractices}
              onChange={(e) => setSexual((p) => ({ ...p, relevantSexualPractices: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1 sm:col-span-2">
            {t('clinical.gyn.exposureHistory')}
            <textarea
              rows={2}
              disabled={!canWrite}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={sexual.exposureHistory}
              onChange={(e) => setSexual((p) => ({ ...p, exposureHistory: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium space-y-1 sm:col-span-2">
            {t('clinical.fields.notes')}
            <textarea
              rows={2}
              disabled={!canWrite}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={sexual.notes}
              onChange={(e) => setSexual((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
        </div>

        {canWrite ? (
          <Button type="submit" size="sm" disabled={savingSummary}>
            <Save size={14} /> {savingSummary ? t('common.saving') : t('clinical.gyn.saveSummary')}
          </Button>
        ) : null}
      </form>

      <ArrayRecordSection
        title={t('clinical.gyn.conditions.title')}
        items={record.gynecologicalConditions}
        canWrite={canWrite}
        fields={[
          { name: 'condition', label: t('clinical.gyn.conditions.condition'), required: true },
          { name: 'diagnosedDate', label: t('clinical.fields.diagnosedDate'), type: 'date' },
          {
            name: 'status',
            label: t('clinical.fields.status'),
            type: 'select',
            options: ['ACTIVE', 'MANAGED', 'RESOLVED', 'CHRONIC'],
            optionLabel: enumLabel,
          },
          { name: 'notes', label: t('clinical.fields.notes'), type: 'textarea' },
        ]}
        onAdd={(payload) =>
          refreshAfter(gynecologyService.conditions.add(record._id, payload))
        }
        onRemove={(itemId) =>
          refreshAfter(gynecologyService.conditions.remove(record._id, itemId))
        }
      />

      <ArrayRecordSection
        title={t('clinical.gyn.contraception.title')}
        items={record.contraceptionHistory}
        canWrite={canWrite}
        fields={[
          { name: 'method', label: t('clinical.fields.method'), required: true },
          { name: 'startDate', label: t('clinical.fields.startDate'), type: 'date' },
          { name: 'endDate', label: t('clinical.fields.endDate'), type: 'date' },
          { name: 'isCurrent', label: t('clinical.gyn.contraception.currentlyUsing'), type: 'checkbox' },
          { name: 'sideEffects', label: t('clinical.gyn.contraception.sideEffects') },
          { name: 'notes', label: t('clinical.fields.notes'), type: 'textarea' },
        ]}
        onAdd={(payload) =>
          refreshAfter(gynecologyService.contraception.add(record._id, payload))
        }
        onRemove={(itemId) =>
          refreshAfter(gynecologyService.contraception.remove(record._id, itemId))
        }
      />

      <ArrayRecordSection
        title={t('clinical.gyn.sti.title')}
        items={record.stiHistory}
        canWrite={canWrite}
        fields={[
          { name: 'infection', label: t('clinical.gyn.sti.infection'), required: true },
          { name: 'diagnosedDate', label: t('clinical.fields.diagnosedDate'), type: 'date' },
          { name: 'treated', label: t('clinical.gyn.sti.treated'), type: 'checkbox' },
          { name: 'treatmentDetails', label: t('clinical.gyn.sti.treatmentDetails'), type: 'textarea' },
          { name: 'notes', label: t('clinical.fields.notes'), type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(gynecologyService.stiHistory.add(record._id, payload))}
        onRemove={(itemId) =>
          refreshAfter(gynecologyService.stiHistory.remove(record._id, itemId))
        }
      />

      <ArrayRecordSection
        title={t('clinical.gyn.cervical.title')}
        items={record.cervicalScreenings}
        canWrite={canWrite}
        fields={[
          {
            name: 'screeningType',
            label: t('clinical.fields.type'),
            type: 'select',
            required: true,
            options: ['PAP_SMEAR', 'HPV_TEST', 'COLPOSCOPY', 'BIOPSY', 'OTHER'],
            optionLabel: enumLabel,
          },
          { name: 'date', label: t('clinical.fields.date'), type: 'date' },
          { name: 'result', label: t('clinical.fields.result') },
          { name: 'nextDueDate', label: t('clinical.gyn.cervical.nextDueDate'), type: 'date' },
          { name: 'provider', label: t('clinical.fields.provider') },
        ]}
        onAdd={(payload) =>
          refreshAfter(gynecologyService.cervicalScreenings.add(record._id, payload))
        }
        onRemove={(itemId) =>
          refreshAfter(gynecologyService.cervicalScreenings.remove(record._id, itemId))
        }
      />

      <ArrayRecordSection
        title={t('clinical.gyn.breast.title')}
        items={record.breastRecords}
        canWrite={canWrite}
        fields={[
          {
            name: 'examType',
            label: t('clinical.gyn.breast.examType'),
            type: 'select',
            required: true,
            options: ['SELF_EXAM', 'CLINICAL_EXAM', 'MAMMOGRAM', 'ULTRASOUND', 'BIOPSY', 'OTHER'],
            optionLabel: enumLabel,
          },
          { name: 'date', label: t('clinical.fields.date'), type: 'date' },
          { name: 'findings', label: t('clinical.fields.findings'), type: 'textarea' },
          { name: 'result', label: t('clinical.fields.result') },
        ]}
        onAdd={(payload) =>
          refreshAfter(gynecologyService.breastRecords.add(record._id, payload))
        }
        onRemove={(itemId) =>
          refreshAfter(gynecologyService.breastRecords.remove(record._id, itemId))
        }
      />

      <ArrayRecordSection
        title={t('clinical.gyn.procedures.title')}
        items={record.procedures}
        canWrite={canWrite}
        fields={[
          { name: 'procedure', label: t('clinical.fields.procedure'), required: true },
          { name: 'date', label: t('clinical.fields.date'), type: 'date' },
          { name: 'provider', label: t('clinical.fields.provider') },
          { name: 'hospital', label: t('clinical.fields.hospital') },
          { name: 'findings', label: t('clinical.fields.findings'), type: 'textarea' },
        ]}
        onAdd={(payload) => refreshAfter(gynecologyService.procedures.add(record._id, payload))}
        onRemove={(itemId) =>
          refreshAfter(gynecologyService.procedures.remove(record._id, itemId))
        }
      />
    </div>
  );
}
