import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';

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
import { EmptyState } from '../ui/empty-state.jsx';
import * as scheduleService from '../../services/scheduleService.js';
import * as appointmentsService from '../../services/appointmentsService.js';
import * as staffService from '../../services/staffService.js';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { ROLES } from '../../constants/roles.js';
import { formatDate, formatTime, toDateParam } from '../../lib/dateFormat.js';

const inputClass = 'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = {
  doctorId: '',
  date: toDateParam(new Date()),
  scheduledStart: '',
  visitType: 'NEW',
  consultationMode: 'PHYSICAL',
  reasonForVisit: '',
  notes: '',
};

const SLOT_EMPTY_REASON_KEY = (reason) => `appointments.book_dialog.slotEmptyReasons.${reason}`;

/**
 * FET-09 — "Booking". `patientProfileId` is optional: pass a fixed
 * id when booking from inside a specific patient's workspace (the
 * doctor/patient picker step is skipped), or omit it to let staff
 * search for the patient first — mirrors the same "resolve an
 * existing account, don't invent one" precedent `RegisterPatientDialog`
 * (FET-06) already set. A `PATIENT` actor booking for themselves
 * never sees a patient picker at all — the backend resolves their
 * own profile when `patientProfileId` is omitted.
 */
export default function BookAppointmentDialog({ open, onOpenChange, patientProfileId = null, onBooked }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPatientActor = user?.role === ROLES.PATIENT;
  const needsPatientPicker = !patientProfileId && !isPatientActor;

  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsEmptyReason, setSlotsEmptyReason] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDoctorsLoading(true);
    staffService
      .listDoctors({ limit: 100 })
      .then(({ items }) => setDoctors(items))
      .catch(() => setDoctors([]))
      .finally(() => setDoctorsLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setSlots([]);
      setSlotsEmptyReason(null);
      setError('');
      setSelectedPatient(null);
      setPatientQuery('');
      setPatientResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.doctorId || !form.date) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSlotsEmptyReason(null);
    scheduleService
      .getAvailableSlots(form.doctorId, form.date)
      .then((result) => {
        setSlots(result.slots || []);
        setSlotsEmptyReason((result.slots || []).length === 0 ? result.reason : null);
      })
      .catch((err) => {
        setSlots([]);
        setSlotsEmptyReason(null);
        setError(extractApiError(err).message);
      })
      .finally(() => setSlotsLoading(false));
  }, [open, form.doctorId, form.date]);

  const set = (name) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value, ...(name === 'doctorId' || name === 'date' ? { scheduledStart: '' } : {}) }));
  };

  const searchPatients = async (query) => {
    setPatientQuery(query);
    if (query.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    setPatientSearching(true);
    try {
      const { items } = await patientsService.listPatients({ search: query.trim(), limit: 10 });
      setPatientResults(items);
    } catch {
      setPatientResults([]);
    } finally {
      setPatientSearching(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const effectivePatientProfileId = patientProfileId || selectedPatient?.id || selectedPatient?._id || null;
    if (needsPatientPicker && !effectivePatientProfileId) {
      setError(t('validation.appointments.selectPatientRequired'));
      return;
    }
    if (!form.doctorId || !form.scheduledStart) {
      setError(t('validation.appointments.doctorAndSlotRequired'));
      return;
    }

    setSaving(true);
    try {
      const appointment = await appointmentsService.bookAppointment({
        patientProfileId: isPatientActor ? null : effectivePatientProfileId,
        doctorId: form.doctorId,
        scheduledStart: form.scheduledStart,
        visitType: form.visitType,
        consultationMode: form.consultationMode,
        reasonForVisit: form.reasonForVisit,
        notes: form.notes,
      });
      onBooked?.(appointment);
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)} className="max-w-lg">
      <DialogCloseButton onClose={() => !saving && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('appointments.book_dialog.title')}</DialogTitle>
        <DialogDescription>{t('appointments.book_dialog.description')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {needsPatientPicker ? (
          <div>
            <label className={labelClass}>{t('appointments.book_dialog.patient')}</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>
                  {selectedPatient.firstName} {selectedPatient.lastName} · {selectedPatient.patientId}
                </span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelectedPatient(null)}
                >
                  {t('appointments.book_dialog.changePatient')}
                </button>
              </div>
            ) : (
              <>
                <input
                  className={inputClass}
                  placeholder={t('appointments.book_dialog.searchPatientPlaceholder')}
                  value={patientQuery}
                  onChange={(event) => searchPatients(event.target.value)}
                />
                {patientSearching ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t('appointments.book_dialog.searching')}</p>
                ) : null}
                {patientResults.length > 0 ? (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {patientResults.map((p) => (
                      <li key={p.id || p._id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientResults([]);
                            setPatientQuery('');
                          }}
                        >
                          {p.firstName} {p.lastName} · {p.patientId}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('appointments.book_dialog.doctor')}</label>
            <select className={inputClass} value={form.doctorId} onChange={set('doctorId')} disabled={doctorsLoading} required>
              <option value="">
                {doctorsLoading ? t('appointments.book_dialog.loadingDoctors') : t('appointments.book_dialog.selectDoctor')}
              </option>
              {doctors.map((d) => (
                <option key={d.id} value={d.user?.id}>
                  {t('appointments.book_dialog.doctorPrefix', { name: d.user?.name })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('appointments.book_dialog.date')}</label>
            <input
              type="date"
              className={inputClass}
              value={form.date}
              min={toDateParam(new Date())}
              onChange={set('date')}
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('appointments.book_dialog.availableSlots', { date: formatDate(form.date) })}</label>
          {!form.doctorId ? (
            <p className="text-sm text-muted-foreground">{t('appointments.book_dialog.pickDoctorPrompt')}</p>
          ) : slotsLoading ? (
            <p className="text-sm text-muted-foreground">{t('appointments.book_dialog.loadingSlots')}</p>
          ) : slots.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title={t('appointments.book_dialog.noSlotsTitle')}
              description={
                slotsEmptyReason
                  ? t(SLOT_EMPTY_REASON_KEY(slotsEmptyReason))
                  : t('appointments.book_dialog.tryDifferentDate')
              }
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {slots.map((slot) => {
                const isSelected = form.scheduledStart === slot.start;
                return (
                  <button
                    type="button"
                    key={slot.start}
                    disabled={!slot.available}
                    onClick={() => setForm((prev) => ({ ...prev, scheduledStart: slot.start }))}
                    className={`h-9 rounded-lg border text-xs font-medium transition-colors
                      ${!slot.available ? 'border-border bg-muted text-muted-foreground/50 cursor-not-allowed line-through' : ''}
                      ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
                  >
                    {formatTime(slot.start)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('appointments.book_dialog.visitType')}</label>
            <select className={inputClass} value={form.visitType} onChange={set('visitType')}>
              <option value="NEW">{t('appointments.book_dialog.visitTypeOptions.NEW')}</option>
              <option value="FOLLOW_UP">{t('appointments.book_dialog.visitTypeOptions.FOLLOW_UP')}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('appointments.book_dialog.mode')}</label>
            <select className={inputClass} value={form.consultationMode} onChange={set('consultationMode')}>
              <option value="PHYSICAL">{t('appointments.book_dialog.modeOptions.PHYSICAL')}</option>
              <option value="ONLINE">{t('appointments.book_dialog.modeOptions.ONLINE')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('appointments.book_dialog.reason')}</label>
          <input className={inputClass} value={form.reasonForVisit} onChange={set('reasonForVisit')} maxLength={500} />
        </div>

        <div>
          <label className={labelClass}>{t('appointments.book_dialog.notesOptional')}</label>
          <textarea
            className={`${inputClass} h-20 py-2`}
            value={form.notes}
            onChange={set('notes')}
            maxLength={1000}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={saving || !form.scheduledStart}>
            {saving ? t('appointments.book_dialog.submitting') : t('appointments.book_dialog.submit')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
