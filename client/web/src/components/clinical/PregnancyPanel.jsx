import { useCallback, useEffect, useState } from 'react';
import { Baby, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as pregnancyService from '../../services/pregnancyService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import SensitiveDataNotice from './SensitiveDataNotice.jsx';
import PregnancyRecordCard from './PregnancyRecordCard.jsx';

const emptyNewPregnancy = {
  gravida: '',
  para: '',
  lmp: '',
  edd: '',
  gestationalAgeAtBookingWeeks: '',
};

export default function PregnancyPanel({ patientProfileId, selfMode = false, canWrite = false }) {
  const { t } = useTranslation();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [records, setRecords] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPregnancy, setNewPregnancy] = useState(emptyNewPregnancy);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = selfMode
        ? await pregnancyService.getMyPregnancyRecords()
        : await pregnancyService.listPregnancyRecordsByPatientProfileId(patientProfileId);
      setRecords(data);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [patientProfileId, selfMode]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChanged = (updated) => {
    setRecords((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    setErrorMessage('');
    try {
      const payload = {
        ...newPregnancy,
        gravida: newPregnancy.gravida === '' ? null : Number(newPregnancy.gravida),
        para: newPregnancy.para === '' ? null : Number(newPregnancy.para),
        gestationalAgeAtBookingWeeks:
          newPregnancy.gestationalAgeAtBookingWeeks === ''
            ? null
            : Number(newPregnancy.gestationalAgeAtBookingWeeks),
        lmp: newPregnancy.lmp || null,
        edd: newPregnancy.edd || null,
      };
      const created = await pregnancyService.createPregnancyRecord(patientProfileId, payload);
      setRecords((prev) => [created, ...prev]);
      setShowNewForm(false);
      setNewPregnancy(emptyNewPregnancy);
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
    } finally {
      setCreating(false);
    }
  };

  if (state === 'loading') {
    return <p className="text-sm text-muted-foreground">{t('clinical.pregnancy.panel.loading')}</p>;
  }

  return (
    <div className="space-y-4">
      <SensitiveDataNotice />

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {canWrite && !selfMode ? (
        <div className="flex justify-end">
          {showNewForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowNewForm(false)}>
              <X size={14} /> {t('common.cancel')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowNewForm(true)}>
              <Plus size={14} /> {t('clinical.pregnancy.panel.startNew')}
            </Button>
          )}
        </div>
      ) : null}

      {showNewForm ? (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border p-4 space-y-3"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="text-xs font-medium space-y-1">
              {t('clinical.pregnancy.panel.gravida')}
              <input
                type="number"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={newPregnancy.gravida}
                onChange={(e) => setNewPregnancy((p) => ({ ...p, gravida: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              {t('clinical.pregnancy.panel.para')}
              <input
                type="number"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={newPregnancy.para}
                onChange={(e) => setNewPregnancy((p) => ({ ...p, para: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              {t('clinical.pregnancy.panel.gestationalAgeAtBooking')}
              <input
                type="number"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={newPregnancy.gestationalAgeAtBookingWeeks}
                onChange={(e) =>
                  setNewPregnancy((p) => ({
                    ...p,
                    gestationalAgeAtBookingWeeks: e.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              {t('clinical.pregnancy.panel.lmp')}
              <input
                type="date"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={newPregnancy.lmp}
                onChange={(e) => setNewPregnancy((p) => ({ ...p, lmp: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium space-y-1">
              {t('clinical.pregnancy.panel.edd')}
              <input
                type="date"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={newPregnancy.edd}
                onChange={(e) => setNewPregnancy((p) => ({ ...p, edd: e.target.value }))}
              />
            </label>
          </div>
          <Button type="submit" size="sm" disabled={creating}>
            {creating ? t('clinical.pregnancy.panel.creating') : t('clinical.pregnancy.panel.createRecord')}
          </Button>
        </form>
      ) : null}

      {records.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Baby size={16} aria-hidden="true" />
          {selfMode ? t('clinical.pregnancy.panel.emptySelf') : t('clinical.pregnancy.panel.emptyOther')}
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <PregnancyRecordCard
              key={record._id}
              record={record}
              canWrite={canWrite}
              onChanged={handleChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
