import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered, PhoneCall, Play, CheckCircle2, UserX } from 'lucide-react';

import * as staffService from '../services/staffService.js';
import * as queueService from '../services/queueService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import { ROLES } from '../constants/roles.js';
import { queueStatusLabel, queueStatusVariant } from '../constants/appointments.js';
import { formatDate, formatTime } from '../lib/dateFormat.js';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { TableSkeleton } from '../components/ui/skeleton.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.jsx';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-09 — "Queue management", "Token generation", "Check-in",
 * "Waiting/queue position", "Consultation state", "Completed
 * state", "No-show". A `DOCTOR` actor lands on their own queue by
 * default; other staff pick a doctor. Entries are checked in from
 * the Appointments page/dialog (`queueService.checkIn`), not here —
 * this page only manages patients already in a doctor's queue for
 * today.
 */
export default function QueuePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirmDialog = useConfirm();
  const isDoctor = user?.role === ROLES.DOCTOR;

  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [actingId, setActingId] = useState(null);

  useEffect(() => {
    if (isDoctor) {
      setDoctorId(user.id);
      return;
    }
    staffService
      .listDoctors({ limit: 100 })
      .then(({ items }) => setDoctors(items))
      .catch(() => setDoctors([]));
  }, [isDoctor, user]);

  const load = useCallback(async () => {
    if (!doctorId) return;
    setState('loading');
    setErrorMessage('');
    try {
      const result = await queueService.getTodayQueue(doctorId);
      setEntries(result);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id, label, action) => {
    setActingId(id);
    try {
      await action();
      toast({ title: label, variant: 'success' });
      load();
    } catch (error) {
      toast({ title: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  const handleNoShow = async (id) => {
    const ok = await confirmDialog({
      title: t('queue.noShowConfirm.title'),
      description: t('queue.noShowConfirm.description'),
      confirmLabel: t('queue.noShowConfirm.confirmLabel'),
      variant: 'destructive',
    });
    if (!ok) return;
    runAction(id, t('queue.actions.noShowToast'), () => queueService.markQueueNoShow(id));
  };

  const activeEntries = entries.filter((e) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(e.status));
  const doneEntries = entries.filter((e) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(e.status));

  return (
    <div>
      <PageHeader
        title="Today's queue"
        description={formatDate(new Date())}
        actions={
          !isDoctor ? (
            <select className={selectClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Select a doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.user?.id}>
                  Dr. {d.user?.name}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      {!doctorId ? (
        <EmptyState icon={ListOrdered} title="Pick a doctor" description="Select a doctor to see today's queue." />
      ) : state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead hideBelow="sm">Position</TableHead>
                <TableHead hideBelow="md">Checked in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={5} columns={6} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No one in queue yet"
          description="Patients appear here once checked in from their appointment."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {activeEntries.some((e) => e.status === 'IN_CONSULTATION') ? (
            <Alert>
              <AlertDescription>
                A patient is currently in consultation. Complete that visit before starting another.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Master prompt §12/§20/§30/§31 — the queue is worked chairside on a
              phone, so below `lg` each entry is a large touch-friendly card
              with its action buttons stacked full-width, not a cramped
              horizontally-scrolling table row. */}
          <div className="grid gap-3 lg:hidden">
            {activeEntries.map((entry) => (
              <div key={entry._id} className="rounded-xl border border-border bg-card p-4 shadow-one-ui">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">#{entry.tokenNumber} · {entry.patient?.name || '—'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.status === 'WAITING' ? `Position ${entry.position}` : `Checked in ${formatTime(entry.checkedInAt)}`}
                    </p>
                  </div>
                  <Badge variant={queueStatusVariant(entry.status)}>{queueStatusLabel(entry.status)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {entry.status === 'WAITING' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11"
                      disabled={actingId === entry._id}
                      onClick={() => runAction(entry._id, 'Patient called', () => queueService.callPatient(entry._id))}
                    >
                      <PhoneCall size={14} /> Call
                    </Button>
                  ) : null}
                  {['WAITING', 'CALLED'].includes(entry.status) ? (
                    <Button
                      size="sm"
                      className="h-11"
                      disabled={actingId === entry._id}
                      onClick={() => runAction(entry._id, 'Consultation started', () => queueService.startConsultation(entry._id))}
                    >
                      <Play size={14} /> Start
                    </Button>
                  ) : null}
                  {entry.status === 'IN_CONSULTATION' ? (
                    <Button
                      size="sm"
                      className="col-span-2 h-11"
                      disabled={actingId === entry._id}
                      onClick={() => runAction(entry._id, 'Consultation completed', () => queueService.completeConsultation(entry._id))}
                    >
                      <CheckCircle2 size={14} /> Complete
                    </Button>
                  ) : null}
                  {['WAITING', 'CALLED'].includes(entry.status) ? (
                    <Button size="sm" variant="destructive" className="h-11" disabled={actingId === entry._id} onClick={() => handleNoShow(entry._id)}>
                      <UserX size={14} /> No-show
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead hideBelow="sm">Position</TableHead>
                    <TableHead hideBelow="md">Checked in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeEntries.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell className="font-semibold">#{entry.tokenNumber}</TableCell>
                      <TableCell>{entry.patient?.name || '—'}</TableCell>
                      <TableCell hideBelow="sm">{entry.status === 'WAITING' ? entry.position : '—'}</TableCell>
                      <TableCell hideBelow="md">{formatTime(entry.checkedInAt)}</TableCell>
                      <TableCell>
                        <Badge variant={queueStatusVariant(entry.status)}>{queueStatusLabel(entry.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {entry.status === 'WAITING' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actingId === entry._id}
                              onClick={() => runAction(entry._id, 'Patient called', () => queueService.callPatient(entry._id))}
                            >
                              <PhoneCall size={14} /> Call
                            </Button>
                          ) : null}
                          {['WAITING', 'CALLED'].includes(entry.status) ? (
                            <Button
                              size="sm"
                              disabled={actingId === entry._id}
                              onClick={() => runAction(entry._id, 'Consultation started', () => queueService.startConsultation(entry._id))}
                            >
                              <Play size={14} /> Start
                            </Button>
                          ) : null}
                          {entry.status === 'IN_CONSULTATION' ? (
                            <Button
                              size="sm"
                              disabled={actingId === entry._id}
                              onClick={() => runAction(entry._id, 'Consultation completed', () => queueService.completeConsultation(entry._id))}
                            >
                              <CheckCircle2 size={14} /> Complete
                            </Button>
                          ) : null}
                          {['WAITING', 'CALLED'].includes(entry.status) ? (
                            <Button size="sm" variant="destructive" disabled={actingId === entry._id} onClick={() => handleNoShow(entry._id)}>
                              <UserX size={14} /> No-show
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {doneEntries.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Completed / cancelled today</p>

              <div className="grid gap-2 lg:hidden">
                {doneEntries.map((entry) => (
                  <div key={entry._id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                    <p className="text-sm">
                      <span className="font-semibold">#{entry.tokenNumber}</span> · {entry.patient?.name || '—'}
                    </p>
                    <Badge variant={queueStatusVariant(entry.status)}>{queueStatusLabel(entry.status)}</Badge>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doneEntries.map((entry) => (
                        <TableRow key={entry._id}>
                          <TableCell className="font-semibold">#{entry.tokenNumber}</TableCell>
                          <TableCell>{entry.patient?.name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={queueStatusVariant(entry.status)}>{queueStatusLabel(entry.status)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
