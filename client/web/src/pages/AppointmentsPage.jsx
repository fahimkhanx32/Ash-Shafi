import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarPlus, Settings2 } from 'lucide-react';

import * as appointmentsService from '../services/appointmentsService.js';
import * as staffService from '../services/staffService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { ROLES } from '../constants/roles.js';
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  visitTypeLabel,
  APPOINTMENT_STATUSES,
} from '../constants/appointments.js';
import { formatDate, formatTime, formatMonthYear, formatWeekdayShort, toDateParam } from '../lib/dateFormat.js';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { TableSkeleton } from '../components/ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.jsx';
import BookAppointmentDialog from '../components/appointments/BookAppointmentDialog.jsx';
import AppointmentDetailDialog from '../components/appointments/AppointmentDetailDialog.jsx';
import DoctorScheduleDialog from '../components/appointments/DoctorScheduleDialog.jsx';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfMonthGrid = (date) => startOfWeek(startOfMonth(date));
const isSameDay = (a, b) => toDateParam(a) === toDateParam(b);

/**
 * FET-09 — the full appointment calendar/booking module. A staff
 * role (everyone except PATIENT) gets the operations calendar
 * (day/week/month, doctor filter, booking on behalf of any patient,
 * schedule management); a PATIENT gets their own upcoming/past
 * appointments plus self-booking. Every list is real backend data
 * (`GET /appointments` / `GET /appointments/me`, BET-10) — nothing
 * here is computed client-side beyond grouping already-fetched
 * appointments by day for the week/month grid.
 */
export default function AppointmentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPatient = user?.role === ROLES.PATIENT;
  const isDoctor = user?.role === ROLES.DOCTOR;

  const [view, setView] = useState('day'); // day | week | month
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [doctors, setDoctors] = useState([]);

  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [bookOpen, setBookOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [scheduleDoctor, setScheduleDoctor] = useState(null);

  useEffect(() => {
    if (isPatient) return;
    // A DOCTOR lands on their own calendar/schedule by default — same
    // pattern as QueuePage — rather than the unfiltered "all doctors"
    // view, so "Manage schedule" is immediately visible without them
    // having to know to pick themselves from the staff-filter dropdown.
    if (isDoctor && user?.id) {
      setDoctorId(user.id);
    }
    staffService
      .listDoctors({ limit: 100 })
      .then(({ items: result }) => setDoctors(result))
      .catch(() => setDoctors([]));
  }, [isPatient, isDoctor, user]);

  const range = useMemo(() => {
    if (view === 'day') {
      const from = new Date(anchorDate);
      from.setHours(0, 0, 0, 0);
      return { from, to: addDays(from, 1) };
    }
    if (view === 'week') {
      const from = startOfWeek(anchorDate);
      return { from, to: addDays(from, 7) };
    }
    const from = startOfMonthGrid(anchorDate);
    return { from, to: addDays(from, 42) };
  }, [view, anchorDate]);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      if (isPatient) {
        const result = await appointmentsService.getMyAppointments({
          status: status || undefined,
        });
        setItems(result);
      } else {
        const { items: result } = await appointmentsService.listAppointments({
          doctorId: doctorId || undefined,
          status: status || undefined,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          limit: 100,
        });
        setItems(result);
      }
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [isPatient, doctorId, status, range]);

  useEffect(() => {
    load();
  }, [load]);

  const dayItems = useMemo(
    () => items.filter((a) => isSameDay(a.scheduledStart, anchorDate)).sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart)),
    [items, anchorDate],
  );

  const countsByDay = useMemo(() => {
    const map = new Map();
    for (const a of items) {
      const key = toDateParam(a.scheduledStart);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [items]);

  const weekDays = useMemo(() => {
    const from = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(from, i));
  }, [anchorDate]);

  const monthDays = useMemo(() => {
    const from = startOfMonthGrid(anchorDate);
    return Array.from({ length: 42 }, (_, i) => addDays(from, i));
  }, [anchorDate]);

  const navigate = (direction) => {
    if (view === 'day') setAnchorDate((d) => addDays(d, direction));
    else if (view === 'week') setAnchorDate((d) => addDays(d, direction * 7));
    else setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
  };

  const selectedDoctorObj = doctors.find((d) => (d.user?.id || d.userId) === doctorId);

  return (
    <div>
      <PageHeader
        title={t('appointments.title', 'Appointments')}
        description={isPatient ? t('appointments.descriptionPatient', 'Your upcoming and past appointments.') : t('appointments.descriptionStaff', 'Calendar, scheduling and booking.')}
        actions={
          <div className="flex items-center gap-2">
            {!isPatient && doctorId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScheduleDoctor({ id: doctorId, name: selectedDoctorObj?.user?.name })}
              >
                <Settings2 size={16} /> {t('appointments.manageSchedule', 'Manage schedule')}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setBookOpen(true)}>
              <CalendarPlus size={16} /> {t('appointments.bookAppointment', 'Book appointment')}
            </Button>
          </div>
        }
      />

      {!isPatient ? (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <TabList
            tabs={[
              { value: 'day', label: t('appointments.viewDay', 'Day') },
              { value: 'week', label: t('appointments.viewWeek', 'Week') },
              { value: 'month', label: t('appointments.viewMonth', 'Month') },
            ]}
            value={view}
            onChange={setView}
            className="!mb-0 !border-b-0"
          />
          <div className="flex items-center gap-2 ml-auto">
            <select className={selectClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">{t('appointments.allDoctors', 'All doctors')}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.user?.id}>
                  Dr. {d.user?.name}
                </option>
              ))}
            </select>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('appointments.allStatuses', 'All statuses')}</option>
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {appointmentStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {!isPatient ? (
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            ← {t('common.previous', 'Previous')}
          </Button>
          <p className="text-sm font-semibold">
            {view === 'month' ? formatMonthYear(anchorDate) : formatDate(anchorDate)}
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            {t('common.next', 'Next')} →
          </Button>
        </div>
      ) : null}

      {!isPatient && view === 'week' ? (
        <div className="grid grid-cols-7 gap-2 mb-4">
          {weekDays.map((d) => (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => {
                setAnchorDate(d);
                setView('day');
              }}
              className={`rounded-lg border p-2 text-left text-xs ${isSameDay(d, anchorDate) ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted'}`}
            >
              <p className="font-medium">{formatWeekdayShort(d)}</p>
              <p className="text-muted-foreground">{d.getDate()}</p>
              <p className="text-primary font-semibold">{countsByDay.get(toDateParam(d)) || 0}</p>
            </button>
          ))}
        </div>
      ) : null}

      {!isPatient && view === 'month' ? (
        <div className="grid grid-cols-7 gap-2 mb-4">
          {monthDays.map((d) => {
            const inMonth = d.getMonth() === anchorDate.getMonth();
            const count = countsByDay.get(toDateParam(d)) || 0;
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => {
                  setAnchorDate(d);
                  setView('day');
                }}
                className={`rounded-lg border p-2 text-left text-xs min-h-16 ${inMonth ? '' : 'opacity-40'} ${isSameDay(d, anchorDate) ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted'}`}
              >
                <p className="font-medium">{d.getDate()}</p>
                {count > 0 ? <Badge variant="info">{count}</Badge> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('appointments.colDateTime', 'Date & time')}</TableHead>
                {isPatient ? null : <TableHead hideBelow="sm">{t('appointments.colPatient', 'Patient')}</TableHead>}
                <TableHead hideBelow="md">{t('appointments.colDoctor', 'Doctor')}</TableHead>
                <TableHead hideBelow="lg">{t('appointments.colVisitType', 'Visit type')}</TableHead>
                <TableHead>{t('appointments.colStatus', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={5} columns={isPatient ? 4 : 5} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <>
          <ErrorState description={errorMessage} onRetry={load} />
          {/PATIENT_PROFILE|profile not found/i.test(errorMessage) ? (
            <p className="mt-3 text-center text-sm">
              <Link to="/dashboard/my-details" className="font-medium text-primary underline">
                Complete your profile
              </Link>{' '}
              to book appointments.
            </p>
          ) : null}
        </>
      ) : (isPatient ? items : dayItems).length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('appointments.emptyTitle', 'No appointments')}
          description={isPatient ? t('appointments.emptyPatient', "You don't have any appointments yet.") : t('appointments.emptyStaff', 'No appointments for this day.')}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — below `lg`, appointments render as
              tappable cards instead of a horizontally-scrolling table. */}
          <div className="grid gap-3 lg:hidden">
            {(isPatient ? items : dayItems).map((a) => (
              <button
                key={a._id || a.id}
                type="button"
                onClick={() => setDetailId(a._id || a.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {formatDate(a.scheduledStart)} · {formatTime(a.scheduledStart)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {isPatient
                        ? a.doctor?.name
                          ? `Dr. ${a.doctor.name}`
                          : '—'
                        : a.patient?.name || '—'}
                    </p>
                  </div>
                  <Badge variant={appointmentStatusVariant(a.status)}>{appointmentStatusLabel(a.status)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {isPatient ? null : (
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        {t('appointments.colDoctor', 'Doctor')}
                      </span>
                      {a.doctor?.name ? `Dr. ${a.doctor.name}` : '—'}
                    </div>
                  )}
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('appointments.colVisitType', 'Visit type')}
                    </span>
                    {visitTypeLabel(a.visitType)}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('appointments.colDateTime', 'Date & time')}</TableHead>
                    {isPatient ? null : <TableHead hideBelow="sm">{t('appointments.colPatient', 'Patient')}</TableHead>}
                    <TableHead hideBelow="md">{t('appointments.colDoctor', 'Doctor')}</TableHead>
                    <TableHead hideBelow="lg">{t('appointments.colVisitType', 'Visit type')}</TableHead>
                    <TableHead>{t('appointments.colStatus', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isPatient ? items : dayItems).map((a) => (
                    <TableRow
                      key={a._id || a.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailId(a._id || a.id)}
                    >
                      <TableCell>
                        {formatDate(a.scheduledStart)} · {formatTime(a.scheduledStart)}
                      </TableCell>
                      {isPatient ? null : <TableCell hideBelow="sm">{a.patient?.name || '—'}</TableCell>}
                      <TableCell hideBelow="md">{a.doctor?.name ? `Dr. ${a.doctor.name}` : '—'}</TableCell>
                      <TableCell hideBelow="lg">{visitTypeLabel(a.visitType)}</TableCell>
                      <TableCell>
                        <Badge variant={appointmentStatusVariant(a.status)}>{appointmentStatusLabel(a.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </>
      )}

      <BookAppointmentDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        onBooked={() => load()}
      />

      <AppointmentDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        appointmentId={detailId}
        canManage={!isPatient}
        onChanged={() => load()}
      />

      {scheduleDoctor ? (
        <DoctorScheduleDialog
          open={Boolean(scheduleDoctor)}
          onOpenChange={(open) => !open && setScheduleDoctor(null)}
          doctorId={scheduleDoctor.id}
          doctorName={scheduleDoctor.name}
        />
      ) : null}
    </div>
  );
}
