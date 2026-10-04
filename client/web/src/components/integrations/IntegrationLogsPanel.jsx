import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';

import { useIntegrationLogs } from '../../hooks/useIntegrationLogs.js';
import { formatDateTime } from '../../lib/dateFormat.js';
import { logDirectionLabel, logStatusVariant } from '../../constants/integrationLogs.js';

import { FilterBar } from '../ui/filter-bar.jsx';
import { Badge } from '../ui/badge.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../ui/table.jsx';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';
const PAGE_SIZE = 20;

export default function IntegrationLogsPanel({ integrations, filters, onFiltersChange }) {
  const { t } = useTranslation();
  const { integrationKey, status, page } = filters;

  const { items, pagination, state, errorMessage, reload } = useIntegrationLogs({
    integrationKey: integrationKey || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const setFilter = (patch) => onFiltersChange({ ...filters, ...patch, page: 1 });

  return (
    <div>
      <FilterBar>
        <select
          className={selectClass}
          value={integrationKey}
          onChange={(e) => setFilter({ integrationKey: e.target.value })}
        >
          <option value="">{t('integrations.allIntegrations', 'All integrations')}</option>
          {integrations.map((integration) => (
            <option key={integration.key} value={integration.key}>
              {integration.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={status} onChange={(e) => setFilter({ status: e.target.value })}>
          <option value="">{t('appointments.allStatuses', 'All statuses')}</option>
          <option value="SUCCESS">{t('audit.outcomeSuccess', 'Success')}</option>
          <option value="FAILURE">{t('audit.outcomeFailure', 'Failure')}</option>
          <option value="REJECTED">{t('audit.outcomeRejected', 'Rejected')}</option>
        </select>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('integrations.colTime', 'Time')}</TableHead>
                <TableHead hideBelow="sm">{t('integrations.colIntegration', 'Integration')}</TableHead>
                <TableHead hideBelow="lg">{t('integrations.colDirection', 'Direction')}</TableHead>
                <TableHead hideBelow="md">{t('integrations.colEvent', 'Event')}</TableHead>
                <TableHead>{t('audit.colStatus', 'Status')}</TableHead>
                <TableHead hideBelow="lg">HTTP</TableHead>
                <TableHead hideBelow="lg">{t('audit.fieldReason', 'Reason')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={7} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t('integrations.emptyLogsTitle', 'No integration events')}
          description={
            integrationKey || status
              ? t('integrations.emptyLogsFiltered', 'No logged events match these filters.')
              : t('integrations.emptyLogsUnfiltered', 'No inbound webhook or outbound send activity has been recorded yet.')
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('integrations.colTime', 'Time')}</TableHead>
                  <TableHead hideBelow="sm">{t('integrations.colIntegration', 'Integration')}</TableHead>
                  <TableHead hideBelow="lg">{t('integrations.colDirection', 'Direction')}</TableHead>
                  <TableHead hideBelow="md">{t('integrations.colEvent', 'Event')}</TableHead>
                  <TableHead>{t('audit.colStatus', 'Status')}</TableHead>
                  <TableHead hideBelow="lg">HTTP</TableHead>
                  <TableHead hideBelow="lg">{t('audit.fieldReason', 'Reason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log._id || log.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell hideBelow="sm" className="font-medium">{log.integrationKey}</TableCell>
                    <TableCell hideBelow="lg" className="text-muted-foreground">{logDirectionLabel(log.direction)}</TableCell>
                    <TableCell hideBelow="md" className="text-muted-foreground">{log.eventType || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={logStatusVariant(log.status)}>{log.status}</Badge>
                    </TableCell>
                    <TableCell hideBelow="lg" className="text-muted-foreground">{log.httpStatus ?? '—'}</TableCell>
                    <TableCell hideBelow="lg" className="text-muted-foreground max-w-xs truncate" title={log.reason || ''}>
                      {log.reason || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {pagination?.totalPages > 1 ? (
            <Pagination
              page={pagination.page || page}
              totalPages={pagination.totalPages}
              onPageChange={(nextPage) => onFiltersChange({ ...filters, page: nextPage })}
              className="mt-4"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
