import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';

import { FilterBar } from '../ui/filter-bar.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../ui/table.jsx';
import * as auditAdminService from '../../services/auditAdminService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatDateTime } from '../../lib/dateFormat.js';
import AuditLogDetailDialog from './AuditLogDetailDialog.jsx';

const PAGE_SIZE = 20;
const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

const OUTCOME_TONE = {
  SUCCESS: 'success',
  FAILURE: 'destructive',
  DENIED: 'warning',
};

/**
 * FET-20 — Audit Administration. Generic table over the general
 * `AuditLog` collection (`GET /api/v1/audit-logs`), parameterized by
 * `category`. Extracted out of `AuditAdminPage.jsx` in checkpoint 2
 * so the same rendering serves five tabs — "Audit log" (`category`
 * unset), "User activity" (`USER_ACTION`), "Administrative activity"
 * (`ADMINISTRATIVE_ACTION`), "Clinical record access"
 * (`CLINICAL_ACCESS`), and "Data exports" (`DATA_EXPORT`) — without
 * five near-duplicate copies of the same table.
 */
export default function AuditLogSection({ category, emptyLabel }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [detailId, setDetailId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const getCategoryLabel = (cat) => {
    const labels = {
      USER_ACTION: t('audit.catUserAction', 'User action'),
      ADMINISTRATIVE_ACTION: t('audit.catAdminAction', 'Administrative action'),
      CLINICAL_ACCESS: t('audit.catClinicalAccess', 'Clinical access'),
      RECORD_CREATE: t('audit.catRecordCreate', 'Record created'),
      RECORD_MODIFY: t('audit.catRecordModify', 'Record modified'),
      RECORD_DELETE: t('audit.catRecordDelete', 'Record deleted'),
      DATA_EXPORT: t('audit.catDataExport', 'Data export'),
      FILE_ACCESS: t('audit.catFileAccess', 'File access'),
      SECURITY_EVENT: t('audit.catSecurityEvent', 'Security event'),
    };
    return labels[cat] || cat;
  };

  const outcomeOptions = [
    { value: '', label: t('audit.allOutcomes', 'All outcomes') },
    { value: 'SUCCESS', label: t('audit.outcomeSuccess', 'Success') },
    { value: 'FAILURE', label: t('audit.outcomeFailure', 'Failure') },
    { value: 'DENIED', label: t('audit.outcomeDenied', 'Denied') },
  ];

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { items, pagination: meta } = await auditAdminService.listAuditLogs({
        category: category || undefined,
        search: search.trim() || undefined,
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
  }, [category, search, outcome, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Category, or any filter change, re-queries from page 1.
  useEffect(() => {
    setPage(1);
  }, [category, search, outcome, from, to]);

  const openDetail = (entry) => {
    setDetailId(entry._id || entry.id);
    setDetailOpen(true);
  };

  return (
    <>
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder={t('audit.searchPlaceholder', 'Search by action or resource type…')}>
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
                <TableHead hideBelow="md">{t('audit.colCategory', 'Category')}</TableHead>
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
          icon={ScrollText}
          title={t('audit.emptyTitle', 'No audit entries')}
          description={emptyLabel || t('audit.emptyDescription', 'No entries match these filters.')}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
          <div className="grid gap-3 lg:hidden">
            {entries.map((entry) => (
              <button
                key={entry._id || entry.id}
                type="button"
                onClick={() => openDetail(entry)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.action}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <Badge variant={OUTCOME_TONE[entry.outcome] || 'neutral'}>{entry.outcome}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="info">{getCategoryLabel(entry.category)}</Badge>
                  {entry.actorRole ? <Badge variant="neutral">{entry.actorRole}</Badge> : null}
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {entry.actor ? entry.actor.name || t('audit.unknownUser', 'Unknown user') : t('audit.system', 'System')}
                  {entry.resourceType ? ` · ${entry.resourceType}` : ''}
                </p>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('audit.colWhen', 'When')}</TableHead>
                    <TableHead hideBelow="sm">{t('audit.colActor', 'Actor')}</TableHead>
                    <TableHead hideBelow="md">{t('audit.colCategory', 'Category')}</TableHead>
                    <TableHead>{t('audit.colAction', 'Action')}</TableHead>
                    <TableHead hideBelow="lg">{t('audit.colResource', 'Resource')}</TableHead>
                    <TableHead>{t('audit.colOutcome', 'Outcome')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow
                      key={entry._id || entry.id}
                      onClick={() => openDetail(entry)}
                      className="cursor-pointer hover:bg-accent/50"
                    >
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell hideBelow="sm">
                        {entry.actor ? (
                          <>
                            <p className="font-medium">{entry.actor.name || t('audit.unknownUser', 'Unknown user')}</p>
                            <p className="text-xs text-muted-foreground">{entry.actor.email}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{t('audit.system', 'System')}</span>
                        )}
                        {entry.actorRole ? (
                          <Badge variant="neutral" className="mt-1">
                            {entry.actorRole}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell hideBelow="md">
                        <Badge variant="info">{getCategoryLabel(entry.category)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{entry.action}</TableCell>
                      <TableCell hideBelow="lg" className="text-muted-foreground">
                        {entry.resourceType || '—'}
                        {entry.resourceId ? (
                          <p className="text-xs text-muted-foreground">{String(entry.resourceId).slice(-8)}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={OUTCOME_TONE[entry.outcome] || 'neutral'}>{entry.outcome}</Badge>
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

      <AuditLogDetailDialog open={detailOpen} onOpenChange={setDetailOpen} entryId={detailId} />
    </>
  );
}
