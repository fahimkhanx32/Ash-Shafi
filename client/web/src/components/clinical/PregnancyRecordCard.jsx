import { useState } from 'react';
import { ChevronDown, ChevronUp, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as pregnancyService from '../../services/pregnancyService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import ArrayRecordSection from './ArrayRecordSection.jsx';
import { formatDate } from '../../lib/dateFormat.js';

const STATUS_STYLES = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25',
  DELIVERED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25',
  MISCARRIAGE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25',
  ECTOPIC: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25',
  TERMINATED: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/25',
  STILLBIRTH: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/25',
};

// FET-17 — was a raw `toLocaleDateString()` (always the browser's
// default locale, ignoring the app's selected language). Swapped for
// the shared `formatDate` helper so it follows en/bn like every
// other date on the page.
const fmtDate = (d) => (d ? formatDate(d) : '—');

export default function PregnancyRecordCard({ record, canWrite, onChanged }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [delivery, setDelivery] = useState(record.delivery || {});
  const [postpartum, setPostpartum] = useState(record.postpartum || {});
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingPostpartum, setSavingPostpartum] = useState(false);

  const enumLabel = (value) => t(`clinical.pregnancy.enum.${value}`, value);

  const refresh = (promise) =>
    promise
      .then((updated) => onChanged(updated))
      .catch((err) => setErrorMessage(extractApiError(err).message));

  const handleSaveDelivery = async (e) => {
    e.preventDefault();
    setSavingDelivery(true);
    setErrorMessage('');
    try {
      const updated = await pregnancyService.updateDelivery(record._id, delivery);
      onChanged(updated);
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleSavePostpartum = async (e) => {
    e.preventDefault();
    setSavingPostpartum(true);
    setErrorMessage('');
    try {
      const updated = await pregnancyService.updatePostpartum(record._id, postpartum);
      onChanged(updated);
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
    } finally {
      setSavingPostpartum(false);
    }
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-accent/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              STATUS_STYLES[record.status] || STATUS_STYLES.ACTIVE
            }`}
          >
            {enumLabel(record.status)}
          </span>
          <div className="min-w-0 text-sm">
            <div className="font-medium">
              {t('clinical.pregnancy.summaryLine', {
                gravida: record.gravida ?? '—',
                para: record.para ?? '—',
                lmp: fmtDate(record.lmp),
                edd: fmtDate(record.edd),
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('clinical.pregnancy.visitScanCount', {
                visits: record.antenatalVisits?.length || 0,
                scans: record.fetalObservations?.length || 0,
              })}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded ? (
        <div className="border-t border-border p-4 sm:p-5 space-y-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <ArrayRecordSection
            title={t('clinical.pregnancy.antenatal.title')}
            items={record.antenatalVisits}
            canWrite={canWrite}
            fields={[
              { name: 'visitDate', label: t('clinical.pregnancy.antenatal.visitDate'), type: 'date', required: true },
              { name: 'gestationalAgeWeeks', label: t('clinical.pregnancy.gestationalAgeWeeks'), type: 'number' },
              { name: 'weightKg', label: t('clinical.encounter.weight'), type: 'number' },
              { name: 'bloodPressure', label: t('clinical.pregnancy.antenatal.bloodPressure') },
              { name: 'fetalHeartRateBpm', label: t('clinical.pregnancy.antenatal.fetalHeartRate'), type: 'number' },
              { name: 'findings', label: t('clinical.fields.findings'), type: 'textarea' },
              { name: 'nextVisitDate', label: t('clinical.pregnancy.antenatal.nextVisitDate'), type: 'date' },
            ]}
            onAdd={(payload) =>
              refresh(pregnancyService.antenatalVisits.add(record._id, payload))
            }
            onRemove={(itemId) =>
              refresh(pregnancyService.antenatalVisits.remove(record._id, itemId))
            }
          />

          <ArrayRecordSection
            title={t('clinical.pregnancy.fetal.title')}
            items={record.fetalObservations}
            canWrite={canWrite}
            fields={[
              { name: 'date', label: t('clinical.fields.date'), type: 'date', required: true },
              {
                name: 'method',
                label: t('clinical.fields.method'),
                type: 'select',
                options: ['ULTRASOUND', 'DOPPLER', 'NST', 'OTHER'],
                optionLabel: enumLabel,
              },
              { name: 'gestationalAgeWeeks', label: t('clinical.pregnancy.gestationalAgeWeeks'), type: 'number' },
              { name: 'estimatedFetalWeightGrams', label: t('clinical.pregnancy.fetal.estimatedWeight'), type: 'number' },
              {
                name: 'presentation',
                label: t('clinical.pregnancy.fetal.presentation'),
                type: 'select',
                options: ['UNKNOWN', 'CEPHALIC', 'BREECH', 'TRANSVERSE'],
                optionLabel: enumLabel,
              },
              { name: 'findings', label: t('clinical.fields.findings'), type: 'textarea' },
            ]}
            onAdd={(payload) =>
              refresh(pregnancyService.fetalObservations.add(record._id, payload))
            }
            onRemove={(itemId) =>
              refresh(pregnancyService.fetalObservations.remove(record._id, itemId))
            }
          />

          <ArrayRecordSection
            title={t('clinical.pregnancy.complications.title')}
            items={record.complications}
            canWrite={canWrite}
            fields={[
              { name: 'complication', label: t('clinical.pregnancy.complications.complication'), required: true },
              { name: 'diagnosedDate', label: t('clinical.fields.diagnosedDate'), type: 'date' },
              {
                name: 'severity',
                label: t('clinical.pregnancy.complications.severity'),
                type: 'select',
                options: ['UNKNOWN', 'MILD', 'MODERATE', 'SEVERE'],
                optionLabel: enumLabel,
              },
              {
                name: 'status',
                label: t('clinical.fields.status'),
                type: 'select',
                options: ['ACTIVE', 'MANAGED', 'RESOLVED'],
                optionLabel: enumLabel,
              },
              { name: 'notes', label: t('clinical.fields.notes'), type: 'textarea' },
            ]}
            onAdd={(payload) => refresh(pregnancyService.complications.add(record._id, payload))}
            onRemove={(itemId) =>
              refresh(pregnancyService.complications.remove(record._id, itemId))
            }
          />

          <form onSubmit={handleSaveDelivery} className="rounded-xl border border-border p-4 space-y-3">
            <div className="font-semibold text-sm">{t('clinical.pregnancy.delivery.heading')}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="text-xs font-medium space-y-1">
                {t('clinical.fields.date')}
                <input
                  type="date"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={delivery.date ? delivery.date.slice(0, 10) : ''}
                  onChange={(e) => setDelivery((p) => ({ ...p, date: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                {t('clinical.fields.type')}
                <select
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={delivery.type || ''}
                  onChange={(e) => setDelivery((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="">—</option>
                  {['VAGINAL', 'ASSISTED_VAGINAL', 'C_SECTION', 'UNKNOWN'].map((v) => (
                    <option key={v} value={v}>
                      {enumLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium space-y-1">
                {t('clinical.pregnancy.delivery.outcome')}
                <select
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={delivery.outcome || ''}
                  onChange={(e) => setDelivery((p) => ({ ...p, outcome: e.target.value }))}
                >
                  <option value="">—</option>
                  {['LIVE_BIRTH', 'STILLBIRTH', 'NEONATAL_DEATH', 'UNKNOWN'].map((v) => (
                    <option key={v} value={v}>
                      {enumLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium space-y-1">
                {t('clinical.pregnancy.delivery.babyWeight')}
                <input
                  type="number"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={delivery.babyWeightGrams ?? ''}
                  onChange={(e) => setDelivery((p) => ({ ...p, babyWeightGrams: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                {t('clinical.pregnancy.delivery.apgar1')}
                <input
                  type="number"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={delivery.apgarScore1Min ?? ''}
                  onChange={(e) => setDelivery((p) => ({ ...p, apgarScore1Min: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                {t('clinical.pregnancy.delivery.apgar5')}
                <input
                  type="number"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={delivery.apgarScore5Min ?? ''}
                  onChange={(e) => setDelivery((p) => ({ ...p, apgarScore5Min: e.target.value }))}
                />
              </label>
            </div>
            {canWrite ? (
              <Button type="submit" size="sm" disabled={savingDelivery}>
                <Save size={14} /> {savingDelivery ? t('common.saving') : t('clinical.pregnancy.delivery.save')}
              </Button>
            ) : null}
          </form>

          <form onSubmit={handleSavePostpartum} className="rounded-xl border border-border p-4 space-y-3">
            <div className="font-semibold text-sm">{t('clinical.pregnancy.postpartum.heading')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-medium space-y-1">
                {t('clinical.pregnancy.postpartum.checkupDate')}
                <input
                  type="date"
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={postpartum.checkupDate ? postpartum.checkupDate.slice(0, 10) : ''}
                  onChange={(e) => setPostpartum((p) => ({ ...p, checkupDate: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium space-y-1">
                {t('clinical.pregnancy.postpartum.contraceptionPlan')}
                <input
                  disabled={!canWrite}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  value={postpartum.contraceptionPlan || ''}
                  onChange={(e) =>
                    setPostpartum((p) => ({ ...p, contraceptionPlan: e.target.value }))
                  }
                />
              </label>
              <label className="text-xs font-medium space-y-1 sm:col-span-2">
                {t('clinical.fields.findings')}
                <textarea
                  disabled={!canWrite}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                  value={postpartum.findings || ''}
                  onChange={(e) => setPostpartum((p) => ({ ...p, findings: e.target.value }))}
                />
              </label>
            </div>
            {canWrite ? (
              <Button type="submit" size="sm" disabled={savingPostpartum}>
                <Save size={14} /> {savingPostpartum ? t('common.saving') : t('clinical.pregnancy.postpartum.save')}
              </Button>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
