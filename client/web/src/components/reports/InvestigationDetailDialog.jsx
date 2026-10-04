import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { Skeleton } from '../ui/skeleton.jsx';
import * as investigationsService from '../../services/investigationsService.js';
import { extractApiError } from '../../services/apiClient.js';
import {
  investigationCategoryLabel,
  investigationStatusLabel,
  investigationStatusVariant,
  investigationPriorityVariant,
  investigationPriorityLabel,
} from '../../constants/investigations.js';
import { formatDate } from '../../lib/dateFormat.js';

const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';
const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';

/**
 * FET-11 — "Investigation status", "Result history". Drives the
 * backend's `ORDERED → SCHEDULED → SAMPLE_COLLECTED → RESULT_PENDING
 * → COMPLETED` state machine (plus `CANCELLED`/`REJECTED` off-ramps)
 * without ever guessing which transition is currently valid — every
 * action button just calls the matching endpoint and surfaces a 409
 * through `extractApiError`, same shape `ConsultationPage`'s
 * finalize/amend flow already uses. `COMPLETED` is set by the backend
 * itself (`markInvestigationCompleted`, a one-way callback from
 * `modules/reports` once a linked report finalizes) — there is
 * deliberately no manual "mark completed" button here.
 *
 * FET-17 — fully localized, including two real bugs fixed along the
 * way: the priority badge was rendering the raw enum value instead
 * of `investigationPriorityLabel`, and both dates were bypassing the
 * shared `formatDate` locale helper via a raw `toLocaleDateString()`.
 */
export default function InvestigationDetailDialog({
  open,
  onOpenChange,
  investigationId,
  canWrite = false,
  onChanged,
  onUploadReport,
}) {
  const { t } = useTranslation();
  const [investigation, setInvestigation] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [reason, setReason] = useState('');

  const load = () => {
    if (!investigationId) return;
    setState('loading');
    investigationsService
      .getInvestigation(investigationId)
      .then((data) => {
        setInvestigation(data);
        setState('ready');
      })
      .catch((err) => {
        setError(extractApiError(err).message);
        setState('error');
      });
  };

  useEffect(() => {
    if (open && investigationId) {
      setError('');
      setReason('');
      setScheduledDate('');
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investigationId]);

  const runAction = async (action) => {
    setActing(true);
    setError('');
    try {
      const updated = await action();
      setInvestigation(updated);
      onChanged?.(updated);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setActing(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !acting && onOpenChange(next)} className="max-w-lg">
      <DialogCloseButton onClose={() => !acting && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('clinical.investigation.detailTitle')}</DialogTitle>
        <DialogDescription>{investigation?.investigationReference || ''}</DialogDescription>
      </DialogHeader>

      {state === 'loading' ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : state === 'error' ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : investigation ? (
        <div className="mt-4 flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={investigationStatusVariant(investigation.status)}>
              {investigationStatusLabel(investigation.status, t)}
            </Badge>
            <Badge variant={investigationPriorityVariant(investigation.priority)}>
              {investigationPriorityLabel(investigation.priority, t)}
            </Badge>
            {investigation.isSensitive ? <Badge variant="warning">{t('clinical.investigation.sensitive')}</Badge> : null}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className={labelClass}>{t('clinical.investigation.category')}</div>
              <div>{investigationCategoryLabel(investigation.category, t)}</div>
            </div>
            <div>
              <div className={labelClass}>{t('clinical.investigation.name')}</div>
              <div>{investigation.name}</div>
            </div>
            <div>
              <div className={labelClass}>{t('clinical.investigation.ordered')}</div>
              <div>{formatDate(investigation.orderedDate)}</div>
            </div>
            <div>
              <div className={labelClass}>{t('clinical.investigation.scheduled')}</div>
              <div>{investigation.scheduledDate ? formatDate(investigation.scheduledDate) : '—'}</div>
            </div>
          </div>

          {investigation.clinicalIndication ? (
            <div>
              <div className={labelClass}>{t('clinical.investigation.clinicalIndication')}</div>
              <div className="text-sm">{investigation.clinicalIndication}</div>
            </div>
          ) : null}

          {canWrite && investigation.status === 'ORDERED' ? (
            <div className="rounded-lg border border-border p-3">
              <div className={labelClass}>{t('clinical.investigation.scheduleThis')}</div>
              <div className="flex gap-2">
                <input
                  type="date"
                  className={inputClass}
                  value={scheduledDate}
                  disabled={acting}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={acting || !scheduledDate}
                  onClick={() => runAction(() => investigationsService.scheduleInvestigation(investigation.id, { scheduledDate }))}
                >
                  {t('clinical.investigation.schedule')}
                </Button>
              </div>
            </div>
          ) : null}

          {canWrite && ['SCHEDULED', 'ORDERED'].includes(investigation.status) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={acting}
              onClick={() => runAction(() => investigationsService.markSampleCollected(investigation.id, reason))}
            >
              {t('clinical.investigation.markSampleCollected')}
            </Button>
          ) : null}

          {canWrite && investigation.status === 'SAMPLE_COLLECTED' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={acting}
              onClick={() => runAction(() => investigationsService.markResultPending(investigation.id, reason))}
            >
              {t('clinical.investigation.markResultPending')}
            </Button>
          ) : null}

          {canWrite && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(investigation.status) ? (
            <div>
              <label className={labelClass}>{t('clinical.investigation.reasonForCancelReject')}</label>
              <input className={inputClass} value={reason} disabled={acting} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </div>
          ) : null}

          {investigation.status === 'COMPLETED' ? (
            <Alert variant="success">
              <AlertDescription>{t('clinical.investigation.completedNotice')}</AlertDescription>
            </Alert>
          ) : null}

          {['CANCELLED', 'REJECTED'].includes(investigation.status) && investigation.cancellationReason ? (
            <Alert variant="destructive">
              <AlertDescription>{investigation.cancellationReason}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <DialogFooter className="flex-wrap">
        {onUploadReport && investigation && !['CANCELLED', 'REJECTED'].includes(investigation.status) ? (
          <Button type="button" variant="outline" onClick={() => onUploadReport(investigation)} disabled={acting}>
            <Upload size={14} /> {t('clinical.report.upload')}
          </Button>
        ) : null}
        {canWrite && investigation && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(investigation.status) ? (
          <Button
            type="button"
            variant="destructive"
            disabled={acting}
            onClick={() => runAction(() => investigationsService.cancelInvestigation(investigation.id, reason))}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        ) : null}
        <Button type="button" onClick={() => onOpenChange(false)} disabled={acting}>
          {t('common.close')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
