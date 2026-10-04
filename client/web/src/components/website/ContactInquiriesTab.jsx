import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, Mail, Phone, Check, CheckCheck } from 'lucide-react';

import * as contactService from '../../services/contactService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { formatDate } from '../../lib/dateFormat.js';

const STATUS_FILTERS = ['ALL', 'NEW', 'READ', 'RESOLVED'];
const STATUS_VARIANT = { NEW: 'warning', READ: 'neutral', RESOLVED: 'success' };

/**
 * FET-16 completion pass — "Contact inquiries inbox". The public
 * Contact page's form (`POST /cms/contact`, unauthenticated, on
 * `client/website`) already wrote to `ContactInquiry`
 * (`server/src/modules/cms/models/contact-inquiry.model.js`), but
 * nothing on this dashboard ever read it back — submissions landed in
 * the database with no way for staff to see them. This is that
 * missing inbox: list (optionally filtered by status), and move each
 * one through NEW → READ → RESOLVED as it's triaged.
 */
export default function ContactInquiriesTab() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await contactService.listContactInquiries({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        limit: 20,
      });
      setItems(result.items);
      setPagination(result.pagination);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (inquiry, status) => {
    setBusyId(inquiry._id);
    try {
      await contactService.updateContactInquiryStatus(inquiry._id, status);
      await load();
    } catch (error) {
      toast({ title: t('website.contact.updateError', 'Could not update'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
          >
            {s === 'ALL' ? t('website.contact.all', 'All') : s}
          </Button>
        ))}
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={5} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('website.contact.emptyTitle', 'No inquiries')}
          description={t('website.contact.emptyDescription', 'Submissions from the public Contact page will show up here.')}
        />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((inquiry) => (
              <div key={inquiry._id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{inquiry.name}</p>
                      <Badge variant={STATUS_VARIANT[inquiry.status] || 'neutral'}>{inquiry.status}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail size={12} /> {inquiry.email}</span>
                      {inquiry.phone ? <span className="flex items-center gap-1"><Phone size={12} /> {inquiry.phone}</span> : null}
                      <span>{formatDate(inquiry.createdAt)}</span>
                    </div>
                    {inquiry.subject ? <p className="mt-1 text-sm font-medium">{inquiry.subject}</p> : null}
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{inquiry.message}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {inquiry.status === 'NEW' ? (
                      <Button size="sm" variant="outline" disabled={busyId === inquiry._id} onClick={() => setStatus(inquiry, 'READ')}>
                        <Check size={13} /> {t('website.contact.markRead', 'Mark read')}
                      </Button>
                    ) : null}
                    {inquiry.status !== 'RESOLVED' ? (
                      <Button size="sm" disabled={busyId === inquiry._id} onClick={() => setStatus(inquiry, 'RESOLVED')}>
                        <CheckCheck size={13} /> {t('website.contact.markResolved', 'Mark resolved')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pagination && pagination.totalPages > 1 ? (
            <div className="mt-4">
              <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
