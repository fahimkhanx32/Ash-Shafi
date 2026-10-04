import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';

import { FilterBar } from '../ui/filter-bar.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '../ui/table.jsx';
import * as securityAdminService from '../../services/securityAdminService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatDateTime } from '../../lib/dateFormat.js';
import { describeUserAgent } from '../../lib/parseUserAgent.js';
import {
  SECURITY_EVENT_CATEGORY,
  eventTypesForCategory,
  eventTypeLabel,
  eventTypeTone,
} from '../../constants/securityEvents.js';
import ProtectedAccountBadge from './ProtectedAccountBadge.jsx';

const PAGE_SIZE = 20;
const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All event categories' },
  { value: SECURITY_EVENT_CATEGORY.AUTHENTICATION, label: 'Authentication events' },
  { value: SECURITY_EVENT_CATEGORY.SECURITY, label: 'Security events' },
];

/**
 * FET-20 checkpoint 2 — "Security events" + "Authentication events".
 *
 * Both bullet points are backed by the one real event log
 * (`GET /security-admin/events`, `AUDIT_READ`-gated —
 * `server/src/auth/security-event.model.js`). The "category" select
 * below is a pure client-side filter over the real `type` values
 * (see `constants/securityEvents.js`) rather than a second endpoint,
 * since the backend does not (and need not) split these into two
 * collections.
 */
export default function SecurityEventsSection({ onSelectUser }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const typeOptions = category ? eventTypesForCategory(category) : null;

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { items, pagination: meta } = await securityAdminService.listSecurityEvents({
        type: type || undefined,
        ipAddress: ipAddress.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setEvents(items);
      setPagination(meta);
      setState('ready');
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
      setState('error');
    }
  }, [type, ipAddress, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change re-queries from page 1.
  useEffect(() => {
    setPage(1);
  }, [category, type, ipAddress, from, to]);

  // Changing category resets a now-invalid type selection.
  const handleCategoryChange = (value) => {
    setCategory(value);
    setType('');
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">
        {t('security.eventsSection.title', 'Security & authentication events')}
      </h2>

      <FilterBar searchValue={ipAddress} onSearchChange={setIpAddress} searchPlaceholder={t('security.eventsSection.filterIp', 'Search by IP address…')}>
        <select className={selectClass} value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
          <option value="">{t('security.eventsSection.filterCategory', 'All event categories')}</option>
          <option value={SECURITY_EVENT_CATEGORY.AUTHENTICATION}>{t('security.eventsSection.categoryAuth', 'Authentication')}</option>
          <option value={SECURITY_EVENT_CATEGORY.SECURITY}>{t('security.eventsSection.categorySecurity', 'Security')}</option>
        </select>

        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('security.eventsSection.filterType', 'All event types')}</option>
          {(typeOptions || eventTypesForCategory(SECURITY_EVENT_CATEGORY.AUTHENTICATION).concat(
            eventTypesForCategory(SECURITY_EVENT_CATEGORY.SECURITY),
          )).map((evtType) => (
            <option key={evtType} value={evtType}>
              {eventTypeLabel(evtType, t)}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('common.from', 'From')}
          <input type="date" className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('common.to', 'To')}
          <input type="date" className={selectClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('security.eventsSection.colEvent', 'Event')}</TableHead>
                <TableHead>{t('security.eventsSection.colUser', 'Account')}</TableHead>
                <TableHead>{t('security.eventsSection.colIp', 'IP address')}</TableHead>
                <TableHead>{t('security.eventsSection.colUserAgent', 'Device')}</TableHead>
                <TableHead>{t('security.eventsSection.colTimestamp', 'When')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={5} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : events.length === 0 ? (
        <EmptyState icon={History} title={t('security.eventsSection.emptyTitle', 'No events found')} description={t('security.eventsSection.emptyDesc', 'No security or authentication events match these filters.')} />
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('security.eventsSection.colEvent', 'Event')}</TableHead>
                  <TableHead>{t('security.eventsSection.colUser', 'Account')}</TableHead>
                  <TableHead>{t('security.eventsSection.colIp', 'IP address')}</TableHead>
                  <TableHead>{t('security.eventsSection.colUserAgent', 'Device')}</TableHead>
                  <TableHead>{t('security.eventsSection.colTimestamp', 'When')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event._id || event.id}>
                    <TableCell>
                      <Badge variant={eventTypeTone(event.type)}>{eventTypeLabel(event.type, t)}</Badge>
                    </TableCell>
                    <TableCell>
                      {event.userId ? (
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                          onClick={() => onSelectUser?.(event.userId._id || event.userId)}
                        >
                          {event.userId.name || t('common.unknownUser', 'Unknown user')}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{t('common.systemUser', 'System / unauthenticated')}</span>
                      )}
                      {event.userId?.email ? <p className="text-xs text-muted-foreground">{event.userId.email}</p> : null}
                      <ProtectedAccountBadge isProtected={event.userId?.isProtected} className="mt-1" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{event.ipAddress || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{describeUserAgent(event.userAgent)}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(event.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {pagination?.totalPages > 1 ? (
            <Pagination page={pagination.page || page} totalPages={pagination.totalPages} onPageChange={setPage} className="mt-4" />
          ) : null}
        </>
      )}
    </section>
  );
}
