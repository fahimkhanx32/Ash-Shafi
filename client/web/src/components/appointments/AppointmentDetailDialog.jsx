import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { History, Video } from 'lucide-react';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as appointmentsService from '../../services/appointmentsService.js';
import * as scheduleService from '../../services/scheduleService.js';
import * as queueService from '../../services/queueService.js';
import { extractApiError } from '../../services/apiClient.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { ROLES } from '../../constants/roles.js';
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  visitTypeLabel,
  consultationModeLabel,
  CANCELLABLE_STATUSES,
  RESCHEDULABLE_STATUSES,
  CHECK_IN_ELIGIBLE_STATUSES,
  CONFIRMABLE_STATUSES,
  NO_SHOWABLE_STATUSES,
} from '../../constants/appointments.js';
import { formatDate, formatTime, toDateParam } from '../../lib/dateFormat.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

// FET-12 (Patient Portal) checkpoint 2 — an ONLINE appointment's video
// session (BET-14) only makes sense once the visit is actually locked
// in: CONFIRMED (booked, ready to join at the scheduled time) or
// CHECKED_IN (the queue/reception flow already started the visit).
// Not SCHEDULED (unconfirmed), and not any terminal status. Mirrors
// this dialog's own `CHECK_IN_ELIGIBLE_STATUSES` pattern above.
const VIDEO_JOINABLE_STATUSES = ['CONFIRMED', 'CHECKED_IN'];

/**
 * FET-09 — "Appointment details" / cancellation / rescheduling /
 * appointment states / check-in. `canManage` (false for a patient
 * viewing their own booking beyond cancel) is passed by the caller
 * — the real boundary is still the backend's `staffOnly` gate on
 * confirm/no-show/check-in.
 */
export default function AppointmentDetailDialog({ open, onOpenChange, appointmentId, canManage, onChanged }) {
  // Scoped `useTranslation` use: only the FET-12 "Join video
  // consultation" button below is wired to i18n this pass. The rest
  // of this dialog (statuses, staff actions) is pre-existing
  // hardcoded English, out of scope for FET-12 — left untouched so
  // this diff stays reviewable.
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirmDialog = useConfirm();
  const navigate = useNavigate();
  const isStaff = user?.role !== ROLES.PATIENT;
  // FET-12 checkpoint 2 — only PATIENT/DOCTOR ever reach
  // `/dashboard/video-calls/:appointmentId` (see that route's
  // `ProtectedRoute` gate in `App.jsx`); everyone else, including
  // other staff tiers viewing this same dialog, never gets the button.
  const canJoinVideo = user?.role === ROLES.PATIENT || user?.role === ROLES.DOCTOR;

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [newStart, setNewStart] = useState('');

  const load = () => {
    if (!appointmentId) return;
    setLoading(true);
    setError('');
    appointmentsService
      .getAppointment(appointmentId)
      .then(setAppointment)
      .catch((err) => setError(extractApiError(err).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      load();
      setRescheduleMode(false);
      setNewStart('');
    } else {
      setAppointment(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointmentId]);

  useEffect(() => {
    if (!rescheduleMode || !appointment || !rescheduleDate) return;
    setSlotsLoading(true);
    scheduleService
      .getAvailableSlots(appointment.doctor?.id || appointment.doctor, rescheduleDate)
      .then((result) => setSlots(result.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [rescheduleMode, rescheduleDate, appointment]);

  const runAction = async (label, action) => {
    setActing(true);
    setError('');
    try {
      const updated = await action();
      setAppointment(updated);
      onChanged?.(updated);
      toast({ title: label, variant: 'success' });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setActing(false);
    }
  };

  const handleConfirm = () =>
    runAction('Appointment confirmed', () => appointmentsService.confirmAppointment(appointment._id || appointment.id));

  const handleCancel = async () => {
    const ok = await confirmDialog({
      title: 'Cancel this appointment?',
      description: 'The patient will need to book again if they still want this visit.',
      confirmLabel: 'Cancel appointment',
      variant: 'destructive',
    });
    if (!ok) return;
    runAction('Appointment cancelled', () => appointmentsService.cancelAppointment(appointment._id || appointment.id));
  };

  const handleNoShow = async () => {
    const ok = await confirmDialog({
      title: 'Mark as no-show?',
      description: 'This records that the patient did not attend.',
      confirmLabel: 'Mark no-show',
      variant: 'destructive',
    });
    if (!ok) return;
    runAction('Marked as no-show', () => appointmentsService.markNoShow(appointment._id || appointment.id));
  };

  const handleCheckIn = () =>
    runAction('Patient checked in', () =>
      queueService.checkIn(appointment._id || appointment.id).then(() => appointmentsService.getAppointment(appointment._id || appointment.id)),
    );

  const handleReschedule = async () => {
    if (!newStart) return;
    await runAction('Appointment rescheduled', async () => {
      const result = await appointmentsService.rescheduleAppointment(appointment._id || appointment.id, { scheduledStart: newStart });
      return appointmentsService.getAppointment(result._id || result.id || appointment._id || appointment.id);
    });
    setRescheduleMode(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !acting && onOpenChange(next)} className="max-w-lg">
      <DialogCloseButton onClose={() => !acting && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>Appointment details</DialogTitle>
        {appointment ? <DialogDescription>Reference: {appointment.appointmentReference}</DialogDescription> : null}
      </DialogHeader>

      <div className="mt-4 flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !appointment ? null : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{formatDate(appointment.scheduledStart)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTime(appointment.scheduledStart)} – {formatTime(appointment.scheduledEnd)}
                </p>
              </div>
              <Badge variant={appointmentStatusVariant(appointment.status)}>
                {appointmentStatusLabel(appointment.status)}
              </Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Doctor</dt>
                <dd>{appointment.doctor?.name ? `Dr. ${appointment.doctor.name}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Patient</dt>
                <dd>{appointment.patient?.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Visit type</dt>
                <dd>{visitTypeLabel(appointment.visitType)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Mode</dt>
                <dd>{consultationModeLabel(appointment.consultationMode)}</dd>
              </div>
            </dl>

            {appointment.reasonForVisit ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason for visit</p>
                <p className="text-sm">{appointment.reasonForVisit}</p>
              </div>
            ) : null}

            {Array.isArray(appointment.history) && appointment.history.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <History size={13} /> History
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 max-h-28 overflow-y-auto">
                  {appointment.history.slice().reverse().map((h) => (
                    <li key={h._id}>
                      {formatDate(h.at)}, {formatTime(h.at)} — {appointmentStatusLabel(h.toStatus)}
                      {h.reason ? ` (${h.reason})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {rescheduleMode ? (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div>
                  <label className={labelClass}>New date</label>
                  <input
                    type="date"
                    className={inputClass}
                    min={toDateParam(new Date())}
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setNewStart('');
                    }}
                  />
                </div>
                {rescheduleDate ? (
                  slotsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading slots…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No slots available on this date.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                      {slots.map((slot) => (
                        <button
                          type="button"
                          key={slot.start}
                          disabled={!slot.available}
                          onClick={() => setNewStart(slot.start)}
                          className={`h-9 rounded-lg border text-xs font-medium
                            ${!slot.available ? 'border-border bg-muted text-muted-foreground/50 cursor-not-allowed line-through' : ''}
                            ${newStart === slot.start ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
                        >
                          {formatTime(slot.start)}
                        </button>
                      ))}
                    </div>
                  )
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setRescheduleMode(false)}>
                    Back
                  </Button>
                  <Button type="button" size="sm" disabled={!newStart || acting} onClick={handleReschedule}>
                    Confirm new time
                  </Button>
                </div>
              </div>
            ) : (
              <DialogFooter className="!mt-2 flex-wrap justify-start gap-2">
                {canJoinVideo && appointment.consultationMode === 'ONLINE' && VIDEO_JOINABLE_STATUSES.includes(appointment.status) ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/dashboard/video-calls/${appointment._id || appointment.id}`);
                    }}
                  >
                    <Video size={14} /> {t('videoCall.joinFromAppointment')}
                  </Button>
                ) : null}
                {isStaff && canManage && CONFIRMABLE_STATUSES.includes(appointment.status) ? (
                  <Button size="sm" disabled={acting} onClick={handleConfirm}>
                    Confirm
                  </Button>
                ) : null}
                {isStaff && canManage && CHECK_IN_ELIGIBLE_STATUSES.includes(appointment.status) ? (
                  <Button size="sm" variant="outline" disabled={acting} onClick={handleCheckIn}>
                    Check in
                  </Button>
                ) : null}
                {RESCHEDULABLE_STATUSES.includes(appointment.status) ? (
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => setRescheduleMode(true)}>
                    Reschedule
                  </Button>
                ) : null}
                {CANCELLABLE_STATUSES.includes(appointment.status) ? (
                  <Button size="sm" variant="destructive" disabled={acting} onClick={handleCancel}>
                    Cancel
                  </Button>
                ) : null}
                {isStaff && canManage && NO_SHOWABLE_STATUSES.includes(appointment.status) ? (
                  <Button size="sm" variant="destructive" disabled={acting} onClick={handleNoShow}>
                    Mark no-show
                  </Button>
                ) : null}
              </DialogFooter>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
