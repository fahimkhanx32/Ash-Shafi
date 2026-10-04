import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ScrollText, XCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card.jsx';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { getIntegrationIcon, describeEntries, formatFieldLabel, formatFieldValue } from '../../constants/integrations.js';
import { logStatusVariant, syncStatusLabel } from '../../constants/integrationLogs.js';
import { formatRelativeTime } from '../../lib/dateFormat.js';

export default function IntegrationCard({ integration, activity, onViewLogs }) {
  const { t } = useTranslation();
  const Icon = getIntegrationIcon(integration.key);
  const fields = describeEntries(integration);
  const lastLog = activity?.lastLog;
  const failureCount = activity?.failureCount ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/60 text-foreground">
              <Icon size={18} aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">{integration.label}</CardTitle>
              <CardDescription className="mt-0.5">{integration.key}</CardDescription>
            </div>
          </div>
          <Badge variant={integration.configured ? 'success' : 'neutral'} className="flex items-center gap-1">
            {integration.configured ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
            {integration.configured ? t('integrations.connected', 'Connected') : t('integrations.notConfigured', 'Not configured')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t('integrations.syncStatus', 'Sync status:')}</span>
            {activity === undefined ? (
              <span className="text-xs text-muted-foreground">{t('common.loading', 'Loading…')}</span>
            ) : lastLog ? (
              <Badge variant={logStatusVariant(lastLog.status)}>{syncStatusLabel(lastLog.status)}</Badge>
            ) : (
              <Badge variant="neutral">{t('integrations.noRecentActivity', 'No recent activity')}</Badge>
            )}
            {lastLog ? (
              <span className="text-xs text-muted-foreground">{formatRelativeTime(lastLog.createdAt)}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-muted-foreground">{t('integrations.errors', 'Errors:')}</span>
            {activity === undefined ? (
              <span className="text-xs text-muted-foreground">{t('common.loading', 'Loading…')}</span>
            ) : failureCount > 0 ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle size={11} aria-hidden="true" /> {t('integrations.recentErrors', '{{count}} recent', { count: failureCount })}
              </Badge>
            ) : (
              <Badge variant="success">{t('integrations.noneRecent', 'None recent')}</Badge>
            )}
          </div>
        </div>

        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {t('integrations.providerSettings', 'Provider settings')}
        </h3>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('integrations.noProviderDetails', 'No provider details reported.')}</p>
        ) : (
          <dl className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {fields.map(([field, rawValue]) => {
              const value = formatFieldValue(rawValue);
              return (
                <div key={field} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-sm text-muted-foreground">{formatFieldLabel(field)}</dt>
                  <dd className="text-sm font-medium text-right">
                    {value === null ? (
                      <span className="text-muted-foreground">{t('integrations.notSet', 'Not set')}</span>
                    ) : typeof value === 'boolean' ? (
                      <Badge variant={value ? 'success' : 'neutral'}>{value ? t('common.yes', 'Yes') : t('common.no', 'No')}</Badge>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {t('integrations.managedViaEnv', "Managed via the server's environment configuration — not editable from this screen.")}
        </p>

        {onViewLogs ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => onViewLogs(integration.key)}
          >
            <ScrollText size={14} /> {t('integrations.viewLogs', 'View logs')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
