import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Check, CheckCheck, Mail, MessageSquareText, Smartphone } from 'lucide-react';

import * as notificationsService from '../services/notificationsService.js';
import { extractApiError } from '../services/apiClient.js';
import { getSocket } from '../services/socketService.js';
import { formatRelativeTime } from '../lib/dateFormat.js';
import {
  notificationTypeIcon,
  notificationTypeLabel,
  DELIVERY_CHANNELS,
  deliveryChannelLabel,
  deliveryChannelStatus,
} from '../constants/notifications.js';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { SkeletonList } from '../components/ui/skeleton.jsx';

const CHANNEL_ICONS = { email: Mail, sms: Smartphone, whatsapp: MessageSquareText };

const PAGE_SIZE = 15;

/**
 * FET-13 — the full notification center `NotificationsBell.jsx`'s
 * own dropdown always deferred to ("See all notifications"): the
 * same real `GET /notifications/me` data, but with server-side
 * pagination and a genuine unread/all filter instead of a fixed
 * 10-item preview.
 *
 * Also shows, per notification, which outbound channels
 * (email/SMS/WhatsApp) were actually attempted and whether each one
 * delivered — data the bell's compact dropdown has no room for.
 * `inApp` is never shown as a chip since every notification on this
 * page is, by definition, delivered in-app already.
 *
 * i18n'd against the `notifications.*`/`nav.notifications` key sets
 * added alongside this page (both `en`/`bn` locale files carry real
 * translations, not just staged English source strings).
 */
export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    setError('');
    notificationsService
      .getMyNotifications({ page, limit: PAGE_SIZE, unreadOnly: filter === 'unread' })
      .then((result) => {
        setItems(result.items);
        setPagination(result.pagination);
        setUnreadCount(result.unreadCount);
        setState('ready');
      })
      .catch((err) => {
        setError(extractApiError(err).message);
        setState('error');
      });
  }, [page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time — a fresh notification while this page is open is
  // pushed straight into the roster if we're looking at page 1 of
  // either filter (a new notification is always unread), and always
  // bumps the header's unread count regardless of which page/filter
  // is showing.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const handleNew = (payload) => {
      setUnreadCount((prev) => prev + 1);
      if (page !== 1) return;
      setItems((prev) => {
        if (prev.some((n) => n.id === payload.id)) return prev;
        const notification = {
          id: payload.id,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          message: payload.body,
          relatedResource: payload.relatedResource,
          createdAt: payload.createdAt,
          readAt: null,
          delivery: null,
        };
        return [notification, ...prev].slice(0, PAGE_SIZE);
      });
    };
    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [page]);

  const handleFilterChange = (value) => {
    setFilter(value);
    setPage(1);
  };

  const handleMarkRead = async (notification) => {
    if (notification.readAt) return;
    setItems((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await notificationsService.markNotificationRead(notification.id);
    } catch {
      load(); // resync rather than leave an optimistic lie on screen
    }
  };

  const handleMarkAllRead = async () => {
    const previousItems = items;
    const previousCount = unreadCount;
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await notificationsService.markAllNotificationsRead();
    } catch {
      setItems(previousItems);
      setUnreadCount(previousCount);
    }
  };

  const handleOpen = (notification) => {
    handleMarkRead(notification);
    // Generic forward-link (see `notification.model.js`'s docstring)
    // — today only `CONVERSATION` is ever populated (a message
    // notification); anything else/unset just marks read in place.
    if (notification.relatedResource?.type === 'CONVERSATION') {
      navigate('/dashboard/messages');
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: t('notifications.title') }]}
        title={t('notifications.title')}
        description={t('notifications.description')}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck size={14} /> {t('notifications.markAllRead')}
            </Button>
          ) : null
        }
      />

      <div className="flex items-center gap-2 mb-4">
        {[
          { value: 'all', label: t('notifications.filterAll') },
          { value: 'unread', label: `${t('notifications.filterUnread')}${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleFilterChange(opt.value)}
            aria-pressed={filter === opt.value}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              filter === opt.value
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-border hover:bg-accent/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {state === 'loading' ? (
          <div className="p-4">
            <SkeletonList rows={6} />
          </div>
        ) : state === 'error' ? (
          <div className="p-4">
            <ErrorState description={error} onRetry={load} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Bell}
              title={filter === 'unread' ? t('notifications.emptyUnreadTitle') : t('notifications.emptyTitle')}
              description={
                filter === 'unread' ? t('notifications.emptyUnreadDescription') : t('notifications.emptyDescription')
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((notification) => {
              const Icon = notificationTypeIcon(notification.type);
              const isUnread = !notification.readAt;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(notification)}
                    className={`w-full text-left flex items-start gap-3 p-4 transition-colors ${
                      isUnread ? 'bg-accent/40 hover:bg-accent/60' : 'hover:bg-accent/20'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 h-9 w-9 rounded-full bg-muted grid place-items-center text-muted-foreground">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isUnread ? 'info' : 'neutral'} className="!text-[10px]">
                          {notificationTypeLabel(notification.type, t)}
                        </Badge>
                        {isUnread ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </span>
                      <span className="block text-sm font-medium mt-1">
                        {notification.title || notificationTypeLabel(notification.type, t)}
                      </span>
                      {notification.body || notification.message ? (
                        <span className="block text-sm text-muted-foreground mt-0.5">
                          {notification.body || notification.message}
                        </span>
                      ) : null}

                      {/* Delivery-channel status — only rendered once the
                          full doc (with `delivery`) has loaded via REST;
                          a just-arrived socket push has `delivery: null`
                          and simply shows nothing here until the next
                          `load()`. */}
                      {notification.delivery ? (
                        <span className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {DELIVERY_CHANNELS.map((channel) => {
                            const status = deliveryChannelStatus(notification.delivery, channel);
                            if (!status) return null;
                            const ChannelIcon = CHANNEL_ICONS[channel];
                            const channelLabel = t(`notifications.delivery.${channel}`, deliveryChannelLabel(channel));
                            const statusLabel = t(
                              `notifications.delivery.${status === 'delivered' ? 'delivered' : 'failed'}`,
                            );
                            return (
                              <span
                                key={channel}
                                title={`${channelLabel} — ${statusLabel}`}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  status === 'delivered'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300'
                                }`}
                              >
                                <ChannelIcon size={11} aria-hidden="true" />
                                {channelLabel}
                              </span>
                            );
                          })}
                        </span>
                      ) : null}
                    </span>
                    {isUnread ? (
                      <span className="shrink-0 text-muted-foreground mt-1" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {pagination?.totalPages > 1 ? (
          <div className="p-4 border-t border-border">
            <Pagination page={pagination.page || page} totalPages={pagination.totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
