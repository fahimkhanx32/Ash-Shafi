import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  CalendarClock,
  ListOrdered,
  Receipt,
  MessagesSquare,
  ShieldCheck,
  Video,
  ArrowRight,
} from 'lucide-react';

import * as appointmentsService from '../../services/appointmentsService.js';
import * as queueService from '../../services/queueService.js';
import * as billingService from '../../services/billingService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card.jsx';
import { Badge } from '../ui/badge.jsx';
import { Button, buttonVariants } from '../ui/button.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import {
  appointmentStatusLabel,
  appointmentStatusVariant,
  consultationModeLabel,
  queueStatusLabel,
} from '../../constants/appointments.js';
import { invoiceStatusLabel, formatMoney } from '../../constants/billing.js';
import { formatDate, formatTime, toDateParam } from '../../lib/dateFormat.js';
import { cn } from '../../lib/utils.js';

function QuickLink({ to, icon: Icon, labelKey, descriptionKey, t }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-colors"
    >
      <div className="h-10 w-10 shrink-0 rounded-lg bg-accent text-accent-foreground grid place-items-center">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t(labelKey)}</p>
        <p className="text-xs text-muted-foreground truncate">{t(descriptionKey)}</p>
      </div>
      <ArrowRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

/**
 * FET-12 — the real patient-portal landing page, replacing the
 * single "My clinical records" card `DashboardPage.jsx` previously
 * showed a PATIENT with a proper dashboard: next appointment (plus
 * live queue position if already checked in today), an outstanding-
 * balance alert (real `GET /billing/invoices/me`, BET-15), and a
 * quick-link grid into every other patient-portal surface. No fake
 * numbers anywhere — a section that has nothing real to show
 * (e.g. no upcoming appointment) renders an honest empty/CTA state
 * instead of inventing placeholder data (master prompt §79).
 */
export default function PatientDashboard({ user }) {
  const { t } = useTranslation();
  const [nextAppointment, setNextAppointment] = useState(null);
  const [queueEntry, setQueueEntry] = useState(null);
  const [outstandingInvoice, setOutstandingInvoice] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState('loading');
      try {
        const [appointments, invoices] = await Promise.all([
          appointmentsService.getMyAppointments({ from: toDateParam(new Date()) }),
          billingService.getMyInvoices({ page: 1, limit: 10 }),
        ]);

        if (cancelled) return;

        const upcoming = (appointments || [])
          .filter((a) => ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'].includes(a.status))
          .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))[0];

        setNextAppointment(upcoming || null);

        const unpaid = (invoices.items || []).find((inv) => inv.balanceDue > 0 && inv.status !== 'CANCELLED');
        setOutstandingInvoice(unpaid || null);

        if (upcoming) {
          try {
            const entry = await queueService.getMyQueueStatus(upcoming.id || upcoming._id);
            if (!cancelled) setQueueEntry(entry);
          } catch {
            if (!cancelled) setQueueEntry(null);
          }
        }

        setState('ready');
      } catch (error) {
        if (!cancelled) {
          const apiError = extractApiError(error);
          // Self-registration creates the login only. A patient with no
          // patient profile yet is sent to finish their details first.
          if (apiError.code === 'PROFILE_NOT_FOUND') {
            navigate('/dashboard/my-details', { replace: true });
            return;
          }
          setErrorMessage(apiError.message);
          setState('error');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Next appointment + live queue status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock size={18} /> {t('patientDashboard.nextAppointment.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state === 'loading' ? (
            <Skeleton className="h-20 w-full" />
          ) : state === 'error' ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : !nextAppointment ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t('patientDashboard.nextAppointment.empty')}</p>
              <Link to="/dashboard/appointments" className={cn(buttonVariants({ size: 'sm' }))}>
                {t('patientDashboard.nextAppointment.book')}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{formatDate(nextAppointment.scheduledStart)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(nextAppointment.scheduledStart)} · {consultationModeLabel(nextAppointment.consultationMode)}
                    {nextAppointment.doctor?.name ? ` · Dr. ${nextAppointment.doctor.name}` : ''}
                  </p>
                </div>
                <Badge variant={appointmentStatusVariant(nextAppointment.status)}>
                  {appointmentStatusLabel(nextAppointment.status)}
                </Badge>
              </div>

              {queueEntry ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm">
                  <ListOrdered size={15} className="text-muted-foreground shrink-0" />
                  <span>
                    {t('patientDashboard.queue.status')}: <strong>{queueStatusLabel(queueEntry.status)}</strong>
                    {queueEntry.position ? (
                      <> · {t('patientDashboard.queue.position', { position: queueEntry.position })}</>
                    ) : null}
                    {queueEntry.tokenNumber ? (
                      <> · {t('patientDashboard.queue.token', { token: queueEntry.tokenNumber })}</>
                    ) : null}
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/dashboard/appointments"
                  className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                >
                  {t('patientDashboard.nextAppointment.viewAll')}
                </Link>
                {nextAppointment.consultationMode === 'ONLINE' &&
                ['CONFIRMED', 'CHECKED_IN'].includes(nextAppointment.status) ? (
                  <Link
                    to={`/dashboard/video-consultation/${nextAppointment.id || nextAppointment._id}`}
                    className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
                  >
                    <Video size={14} /> {t('patientDashboard.nextAppointment.joinVideo')}
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outstanding balance */}
      {outstandingInvoice ? (
        <Card className="border-amber-300/60 dark:border-amber-500/30">
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 grid place-items-center">
                <Receipt size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {t('patientDashboard.billing.outstanding', {
                    amount: formatMoney(outstandingInvoice.balanceDue, outstandingInvoice.currency),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {outstandingInvoice.invoiceNumber} · {invoiceStatusLabel(outstandingInvoice.status)}
                </p>
              </div>
            </div>
            <Link to="/dashboard/billing" className={cn(buttonVariants({ size: 'sm' }))}>
              {t('patientDashboard.billing.payNow')}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* Quick links */}
      <div>
        <p className="text-sm font-semibold mb-3">{t('patientDashboard.quickLinks')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink
            to="/dashboard/my-records"
            icon={HeartPulse}
            labelKey="nav.myClinicalRecords"
            descriptionKey="patientDashboard.links.records"
            t={t}
          />
          <QuickLink
            to="/dashboard/appointments"
            icon={CalendarClock}
            labelKey="nav.appointments"
            descriptionKey="patientDashboard.links.appointments"
            t={t}
          />
          <QuickLink
            to="/dashboard/billing"
            icon={Receipt}
            labelKey="nav.billing"
            descriptionKey="patientDashboard.links.billing"
            t={t}
          />
          <QuickLink
            to="/dashboard/messages"
            icon={MessagesSquare}
            labelKey="nav.messages"
            descriptionKey="patientDashboard.links.messages"
            t={t}
          />
          <QuickLink
            to="/dashboard/security"
            icon={ShieldCheck}
            labelKey="patientDashboard.links.securityTitle"
            descriptionKey="patientDashboard.links.security"
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
