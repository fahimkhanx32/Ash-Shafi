import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, RotateCw, ShieldCheck } from 'lucide-react';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { SkeletonList } from '../components/ui/skeleton.jsx';
import { useIntegrations } from '../hooks/useIntegrations.js';
import { useIntegrationLogs } from '../hooks/useIntegrationLogs.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import IntegrationCard from '../components/integrations/IntegrationCard.jsx';
import IntegrationLogsPanel from '../components/integrations/IntegrationLogsPanel.jsx';

const RECENT_ACTIVITY_WINDOW = 50;

/**
 * FET-19 — Social & External Integrations (frontend interfaces for
 * supported *official* integrations only — master prompt's explicit
 * "do not build fake integrations" rule).
 *
 * Checkpoint 1: Integration management, Connection status, Provider
 * settings. Backed entirely by the real, already-mounted
 * `GET /api/v1/integrations` registry (BET-16) — currently three real
 * providers (Email/SMTP, SMS Gateway, WhatsApp Business), each
 * wrapping an existing, working backend service. No integration is
 * listed here that the backend doesn't actually support; no
 * "connect"/"disconnect" action exists because the backend has no
 * such endpoint (credentials are server-`.env`-only) — see
 * `IntegrationCard.jsx`'s own note.
 *
 * Checkpoint 2: Authorization status, Sync status, Error status,
 * Integration logs.
 *   - Authorization: this whole page/route is already gated on
 *     `ADMIN_TIER_ROLES` in `App.jsx`, mirroring the exact
 *     `WEBSITE_MANAGE` permission the backend's
 *     `integration.routes.js` requires on every route below (see that
 *     file's own comment: this checkpoint's "Integration
 *     authorization" means only privileged staff can view
 *     integration/webhook activity, not a new permission). The badge
 *     under the page title states that real, current session grant
 *     rather than a decorative label.
 *   - Sync/Error status: derived from the real `IntegrationLog`
 *     collection (`GET /integrations/logs`), not fabricated — see
 *     `IntegrationCard.jsx`'s own note on why "sync" here means "did
 *     the most recent recorded event succeed".
 *   - Logs: the full, filterable, server-paginated event table lives
 *     on its own tab (`IntegrationLogsPanel`) rather than crowding
 *     the overview cards.
 */
export default function IntegrationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { integrations, state, errorMessage, reload } = useIntegrations();

  const [tab, setTab] = useState('overview');
  const [logFilters, setLogFilters] = useState({ integrationKey: '', status: '', page: 1 });

  // Recent-activity window shared by every card's Sync/Error status —
  // one fetch of the last N events across all integrations, grouped
  // client-side, rather than one request per card.
  const recentActivity = useIntegrationLogs({ limit: RECENT_ACTIVITY_WINDOW });

  const activityByKey = useMemo(() => {
    if (recentActivity.state !== 'ready') return undefined;
    const map = {};
    for (const log of recentActivity.items) {
      const entry = map[log.integrationKey] || { lastLog: null, failureCount: 0 };
      if (!entry.lastLog) entry.lastLog = log; // items arrive newest-first
      if (log.status === 'FAILURE' || log.status === 'REJECTED') entry.failureCount += 1;
      map[log.integrationKey] = entry;
    }
    return map;
  }, [recentActivity.state, recentActivity.items]);

  const handleViewLogs = (integrationKey) => {
    setLogFilters({ integrationKey, status: '', page: 1 });
    setTab('logs');
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' }, { label: t('integrations.title', 'Integrations') }]}
        title={t('integrations.title', 'Integrations')}
        description={t('integrations.pageDescription', "Status and settings for this system's supported external providers.")}
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={state === 'loading'}>
            <RotateCw size={14} className={state === 'loading' ? 'animate-spin' : ''} /> {t('common.refresh', 'Refresh')}
          </Button>
        }
      />

      {user?.role ? (
        <Badge variant="info" className="flex items-center gap-1 w-fit mb-5">
          <ShieldCheck size={12} aria-hidden="true" />
          {t('integrations.authorizedAs', 'Authorized as {{role}} — Website Management access', { role: user.role.replace(/_/g, ' ') })}
        </Badge>
      ) : null}

      <TabList
        tabs={[
          { value: 'overview', label: t('integrations.tabOverview', 'Overview') },
          { value: 'logs', label: t('integrations.tabLogs', 'Logs') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? (
        state === 'loading' ? (
          <SkeletonList rows={3} />
        ) : state === 'error' ? (
          <ErrorState description={errorMessage} onRetry={reload} />
        ) : integrations.length === 0 ? (
          <EmptyState icon={Plug} title={t('integrations.emptyTitle', 'No integrations registered')} description={t('integrations.emptyDescription', 'This system has no external integrations configured yet.')} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.key}
                integration={integration}
                activity={activityByKey ? activityByKey[integration.key] || { lastLog: null, failureCount: 0 } : undefined}
                onViewLogs={handleViewLogs}
              />
            ))}
          </div>
        )
      ) : (
        <IntegrationLogsPanel integrations={integrations} filters={logFilters} onFiltersChange={setLogFilters} />
      )}
    </div>
  );
}
