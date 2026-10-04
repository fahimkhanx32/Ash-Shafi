import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { ErrorState } from '../ui/empty-state.jsx';
import * as auditAdminService from '../../services/auditAdminService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatDateTime } from '../../lib/dateFormat.js';
import ProtectedAccountBadge from '../security-admin/ProtectedAccountBadge.jsx';

const OUTCOME_TONE = {
  SUCCESS: 'success',
  FAILURE: 'destructive',
  DENIED: 'warning',
};

/**
 * FET-20 — Audit Administration, checkpoint 4: "Audit details" —
 * single-entry drill-down for the general `AuditLog` collection.
 * Backed by `GET /audit-logs/:id`, which was already complete
 * server-side since checkpoint 1 (its own comment calls it "FET-20
 * prerequisite backend") — this dialog is the first thing to
 * actually call it. Same fetch-on-open shape as
 * `AccountSecurityDialog.jsx`: loading skeleton, `ErrorState` with
 * retry, populated view.
 *
 * `oldValue`/`newValue` are never part of `AuditLog`'s projection on
 * either the list or this detail endpoint (see
 * `listAuditLogsAdmin`'s own comment on why) — there is no clinical
 * field content to accidentally surface here, only metadata.
 */
export default function AuditLogDetailDialog({ open, onOpenChange, entryId }) {
  const { t } = useTranslation();
  const [entry, setEntry] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = async () => {
    if (!entryId) return;
    setState('loading');
    try {
      const data = await auditAdminService.getAuditLogById(entryId);
      setEntry(data);
      setState('ready');
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
      setState('error');
    }
  };

  useEffect(() => {
    if (open && entryId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ScrollText size={16} /> {t('audit.detailsTitle', 'Audit details')}
        </DialogTitle>
        {entry ? <DialogDescription>{formatDateTime(entry.createdAt)}</DialogDescription> : null}
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {state === 'loading' ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : state === 'error' ? (
          <ErrorState description={errorMessage} onRetry={load} />
        ) : entry ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={OUTCOME_TONE[entry.outcome] || 'neutral'}>{entry.outcome}</Badge>
              <Badge variant="info">{entry.category}</Badge>
              {entry.actorRole ? <Badge variant="neutral">{entry.actorRole}</Badge> : null}
              <ProtectedAccountBadge isProtected={entry.actor?.isProtected} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('audit.colActor', 'Actor')}</dt>
              <dd className="text-right font-medium">
                {entry.actor ? (
                  <>
                    {entry.actor.name || t('audit.unknownUser', 'Unknown user')}
                    <p className="text-xs text-muted-foreground font-normal">{entry.actor.email}</p>
                  </>
                ) : (
                  t('audit.system', 'System')
                )}
              </dd>

              <dt className="text-muted-foreground">{t('audit.colAction', 'Action')}</dt>
              <dd className="text-right font-medium">{entry.action}</dd>

              <dt className="text-muted-foreground">{t('audit.colResource', 'Resource')}</dt>
              <dd className="text-right font-medium">
                {entry.resourceType || '—'}
                {entry.resourceId ? <p className="text-xs text-muted-foreground font-normal">{entry.resourceId}</p> : null}
              </dd>

              <dt className="text-muted-foreground">{t('audit.colPatient', 'Patient')}</dt>
              <dd className="text-right font-medium">{entry.patientId || '—'}</dd>

              <dt className="text-muted-foreground">{t('audit.fieldReason', 'Reason')}</dt>
              <dd className="text-right font-medium">{entry.reason || '—'}</dd>

              <dt className="text-muted-foreground">{t('security.fieldIp', 'IP address')}</dt>
              <dd className="text-right font-medium">{entry.ipAddress || '—'}</dd>

              <dt className="text-muted-foreground">{t('security.fieldUserAgent', 'User agent')}</dt>
              <dd className="text-right font-medium break-all">{entry.userAgent || '—'}</dd>
            </dl>

            {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('audit.metadata', 'Metadata')}</p>
                <pre className="text-xs bg-accent rounded-lg p-2 overflow-x-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.close', 'Close')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
