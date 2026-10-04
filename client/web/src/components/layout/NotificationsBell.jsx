import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Check, CheckCheck } from 'lucide-react';

import { EmptyState } from '../ui/empty-state.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { Badge } from '../ui/badge.jsx';
import * as notificationsService from '../../services/notificationsService.js';
import { notificationTypeIcon, notificationTypeLabel } from '../../constants/notifications.js';
import { formatRelativeTime } from '../../lib/dateFormat.js';
import { getSocket } from '../../services/socketService.js';
import { Link } from 'react-router-dom';

const POLL_INTERVAL_MS = 60000; // FET-13 — real-time push (below) now does the heavy lifting; this is just a safety-net resync in case a `notification:new` event was ever missed (tab backgrounded, brief disconnect, etc.), so the interval was relaxed from FET-12's 30s.

/**
 * FET-12 (Patient Portal) / FET-13 — real notification center,
 * closing the FET-02 placeholder's own "wiring a real unread count
 * and feed in is a self-contained follow-up once that backend module
 * ships" note now that BET-13 (`/api/v1/notifications`) exists.
 *
 * FET-13: on top of FET-12's poll, this now also listens for the
 * server's real-time `notification:new` push (`socket/index.js` /
 * `notification.service.js#pushSocketNotification`, delivered to the
 * caller's own `user:<id>` room — every authenticated socket already
 * auto-joins it, no extra `join` call needed here) and prepends the
 * new item immediately rather than waiting up to a minute for the
 * next poll. The socket payload is intentionally smaller than the
 * REST shape (no `delivery`/`readAt`) — it is merged in as a
 * well-formed, already-unread `Notification`-shaped object so the
 * dropdown's rendering code needs no special-casing.
 */
export default function NotificationsBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  const load = useCallback(() => {
    notificationsService
      .getMyNotifications({ page: 1, limit: 10 })
      .then((result) => {
        setItems(result.items);
        setUnreadCount(result.unreadCount);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleNew = (payload) => {
      setItems((prev) => {
        if (prev.some((n) => n.id === payload.id)) return prev; // already have it (e.g. this tab's own poll just ran)
        const notification = {
          id: payload.id,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          message: payload.body,
          relatedResource: payload.relatedResource,
          createdAt: payload.createdAt,
          readAt: null,
          delivery: null, // not included on the socket push — the roster/detail view fetches the full doc, this dropdown just needs to show *that* it arrived
        };
        return [notification, ...prev].slice(0, 10);
      });
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleMarkRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await notificationsService.markNotificationRead(id);
    } catch {
      load(); // resync on failure rather than leave an optimistic lie on screen
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t('notifications.title')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative h-11 w-11 grid place-items-center rounded-full hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 max-h-[26rem] overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-one-ui-lg z-50 animate-fade-in">
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-sm font-semibold">{t('notifications.title')}</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck size={13} /> {t('notifications.markAllRead')}
              </button>
            ) : null}
          </div>

          {state === 'loading' ? (
            <div className="space-y-2 px-1 py-1">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : state === 'error' ? (
            <p className="text-sm text-muted-foreground px-1 py-4 text-center">{t('notifications.loadError')}</p>
          ) : items.length === 0 ? (
            <EmptyState title={t('notifications.emptyTitle')} description={t('notifications.emptyDescription')} />
          ) : (
            <ul className="space-y-1">
              {items.map((notification) => {
                const Icon = notificationTypeIcon(notification.type);
                const isUnread = !notification.readAt;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => isUnread && handleMarkRead(notification.id)}
                      className={`w-full text-left flex items-start gap-2.5 rounded-lg p-2.5 transition-colors ${
                        isUnread ? 'bg-accent/50 hover:bg-accent' : 'hover:bg-accent/30'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-muted-foreground">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <Badge variant={isUnread ? 'info' : 'neutral'} className="!text-[10px] !py-0">
                            {notificationTypeLabel(notification.type, t)}
                          </Badge>
                          {isUnread ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                        </span>
                        <span className="block text-sm mt-0.5 leading-snug break-words">
                          {notification.title || notification.message || notificationTypeLabel(notification.type, t)}
                        </span>
                        {notification.message && notification.title ? (
                          <span className="block text-xs text-muted-foreground mt-0.5 break-words">
                            {notification.message}
                          </span>
                        ) : null}
                        <span className="block text-[11px] text-muted-foreground mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </span>
                      {isUnread ? <Check size={14} className="shrink-0 text-muted-foreground mt-1" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary hover:underline mt-2 pt-2 border-t border-border"
          >
            {t('notifications.seeAll')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
