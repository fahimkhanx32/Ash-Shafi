import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarPlus } from 'lucide-react';

import * as appointmentsService from '../../services/appointmentsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table.jsx';
import BookAppointmentDialog from '../appointments/BookAppointmentDialog.jsx';
import AppointmentDetailDialog from '../appointments/AppointmentDetailDialog.jsx';
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  visitTypeLabel,
  consultationModeLabel,
} from '../../constants/appointments.js';
import { formatDate, formatTime } from '../../lib/dateFormat.js';

export default function AppointmentsTab({ patientProfileId, canManage = true }) {
  const { t } = useTranslation();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setState('loading');
    appointmentsService
      .listAppointmentsByPatient(patientProfileId)
      .then(({ items: result }) => {
        setItems(result);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientProfileId]);

  return (
    <div>
      {canManage ? (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={() => setBookOpen(true)}>
            <CalendarPlus size={16} /> {t('appointments.bookAppointment', 'Book appointment')}
          </Button>
        </div>
      ) : null}

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('appointments.colDateTime', 'Date & time')}</TableHead>
                <TableHead hideBelow="sm">{t('appointments.colDoctor', 'Doctor')}</TableHead>
                <TableHead hideBelow="md">{t('appointments.colVisitType', 'Visit type')}</TableHead>
                <TableHead hideBelow="lg">{t('appointments.mode', 'Mode')}</TableHead>
                <TableHead>{t('appointments.colStatus', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={4} columns={5} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('appointments.noAppointmentsYet', 'No appointments yet')}
          description={t('appointments.noAppointmentsPatientDesc', 'This patient has no scheduled or past appointments.')}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
          <div className="grid gap-3 lg:hidden">
            {items.map((appointment) => (
              <button
                key={appointment._id || appointment.id}
                type="button"
                onClick={() => setDetailId(appointment._id || appointment.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {formatDate(appointment.scheduledStart)} · {formatTime(appointment.scheduledStart)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {appointment.doctor?.name ? `Dr. ${appointment.doctor.name}` : '—'}
                    </p>
                  </div>
                  <Badge variant={appointmentStatusVariant(appointment.status)}>
                    {appointmentStatusLabel(appointment.status)}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('appointments.colVisitType', 'Visit type')}
                    </span>
                    {visitTypeLabel(appointment.visitType)}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {t('appointments.mode', 'Mode')}
                    </span>
                    {consultationModeLabel(appointment.consultationMode)}
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
                    <TableHead hideBelow="sm">{t('appointments.colDoctor', 'Doctor')}</TableHead>
                    <TableHead hideBelow="md">{t('appointments.colVisitType', 'Visit type')}</TableHead>
                    <TableHead hideBelow="lg">{t('appointments.mode', 'Mode')}</TableHead>
                    <TableHead>{t('appointments.colStatus', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((appointment) => (
                    <TableRow
                      key={appointment._id || appointment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailId(appointment._id || appointment.id)}
                    >
                      <TableCell>
                        {formatDate(appointment.scheduledStart)} · {formatTime(appointment.scheduledStart)}
                      </TableCell>
                      <TableCell hideBelow="sm">{appointment.doctor?.name ? `Dr. ${appointment.doctor.name}` : '—'}</TableCell>
                      <TableCell hideBelow="md">{visitTypeLabel(appointment.visitType)}</TableCell>
                      <TableCell hideBelow="lg">{consultationModeLabel(appointment.consultationMode)}</TableCell>
                      <TableCell>
                        <Badge variant={appointmentStatusVariant(appointment.status)}>
                          {appointmentStatusLabel(appointment.status)}
                        </Badge>
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
        patientProfileId={patientProfileId}
        onBooked={() => load()}
      />

      <AppointmentDetailDialog
        open={Boolean(detailId)}
        onOpenChange={(open) => !open && setDetailId(null)}
        appointmentId={detailId}
        canManage={canManage}
        onChanged={() => load()}
      />
    </div>
  );
}
