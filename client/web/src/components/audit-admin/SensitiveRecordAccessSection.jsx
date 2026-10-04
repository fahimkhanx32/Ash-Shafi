import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

import { FilterBar } from '../ui/filter-bar.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../ui/table.jsx';
import * as auditAdminService from '../../services/auditAdminService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatDateTime } from '../../lib/dateFormat.js';
import ProtectedAccountBadge from '../security-admin/ProtectedAccountBadge.jsx';

const PAGE_SIZE = 20;
const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

/**
 * FET-20 — Audit Administration, checkpoint 2: "Sensitive-record
 * access". Reads the new `GET /audit-logs/sensitive-record-access`
 * endpoint.
 */
export default function SensitiveRecordAccessSection() {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const outcomeOptions = [
    { value: '', label: t('audit.allOutcomes', 'All outcomes') },
    { value: 'ALLOWED', label: t('audit.outcomeAllowed', 'Allowed') },
    { value: 'DENIED', label: t('audit.outcomeDenied', 'Denied') },
  ];

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { items, pagination: meta } = await auditAdminService.listSensitiveRecordAccess({
        outcome: outcome || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setEntries(items);
      setPagination(meta);
      setState('ready');
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
      setState('error');
    }
  }, [outcome, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [outcome, from, to]);

  return (
    <>
      <FilterBar>
        <select className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label={t('audit.filterByOutcome', 'Filter by outcome')}>
          {outcomeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('audit.from', 'From')}
          <input type="date" className={selectClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('audit.to', 'To')}
          <input type="date" className={selectClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('audit.colWhen', 'When')}</TableHead>
                <TableHead hideBelow="sm">{t('audit.colActor', 'Actor')}</TableHead>
                <TableHead hideBelow="md">{t('audit.colPatient', 'Patient')}</TableHead>
                <TableHead>{t('audit.colAction', 'Action')}</TableHead>
                <TableHead hideBelow="lg">{t('audit.colResource', 'Resource')}</TableHead>
                <TableHead>{t('audit.colOutcome', 'Outcome')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={8} columns={6} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Lock}
          title={t('audit.emptySensitiveTitle', 'No sensitive-record access entries')}
          description={t('audit.emptyDescription', 'No entries match these filters.')}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
          <div className="grid gap-3 lg:hidden">
            {entries.map((entry) => (
              <div key={entry._id || entry.id} className="rounded-xl border border-border bg-card p-4 shadow-one-ui">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.action}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <Badge variant={entry.outcome === 'ALLOWED' ? 'success' : 'destructive'}>{entry.outcome}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {entry.actorRole ? <Badge variant="neutral">{entry.actorRole}</Badge> : null}
                  <ProtectedAccountBadge isProtected={entry.actor?.isProtected} />
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {entry.actor?.name || t('audit.unknownUser', 'Unknown user')}
                  {entry.patientProfile ? ` · ${entry.patientProfile.firstName} ${entry.patientProfile.lastName}` : ''}
                  {entry.resource ? ` · ${entry.resource}` : ''}
                </p>
                {entry.outcome === 'DENIED' && entry.denialReason ? (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.denialReason}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('audit.colWhen', 'When')}</TableHead>
                    <TableHead hideBelow="sm">{t('audit.colActor', 'Actor')}</TableHead>
                    <TableHead hideBelow="md">{t('audit.colPatient', 'Patient')}</TableHead>
                    <TableHead>{t('audit.colAction', 'Action')}</TableHead>
                    <TableHead hideBelow="lg">{t('audit.colResource', 'Resource')}</TableHead>
                    <TableHead>{t('audit.colOutcome', 'Outcome')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry._id || entry.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell hideBelow="sm">
                        <p className="font-medium">{entry.actor?.name || t('audit.unknownUser', 'Unknown user')}</p>
                        <p className="text-xs text-muted-foreground">{entry.actor?.email}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {entry.actorRole ? <Badge variant="neutral">{entry.actorRole}</Badge> : null}
                          <ProtectedAccountBadge isProtected={entry.actor?.isProtected} />
                        </div>
                      </TableCell>
                      <TableCell hideBelow="md" className="text-muted-foreground">
                        {entry.patientProfile ? (
                          <>
                            {entry.patientProfile.firstName} {entry.patientProfile.lastName}
                            <p className="text-xs text-muted-foreground">{entry.patientProfile.patientId}</p>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{entry.action}</TableCell>
                      <TableCell hideBelow="lg" className="text-muted-foreground">{entry.resource}</TableCell>
                      <TableCell>
                        <Badge variant={entry.outcome === 'ALLOWED' ? 'success' : 'destructive'}>{entry.outcome}</Badge>
                        {entry.outcome === 'DENIED' && entry.denialReason ? (
                          <p className="text-xs text-muted-foreground mt-1">{entry.denialReason}</p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
          {pagination?.totalPages > 1 ? (
            <Pagination page={pagination.page || page} totalPages={pagination.totalPages} onPageChange={setPage} className="mt-4" />
          ) : null}
        </>
      )}
    </>
  );
}
