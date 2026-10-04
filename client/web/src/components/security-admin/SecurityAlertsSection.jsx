import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, RotateCw, ShieldAlert } from 'lucide-react';

import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Card, CardContent } from '../ui/card.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import * as securityAdminService from '../../services/securityAdminService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatRelativeTime } from '../../lib/dateFormat.js';
import { alertSeverityTone } from '../../constants/securityEvents.js';
import ProtectedAccountBadge from './ProtectedAccountBadge.jsx';

export default function SecurityAlertsSection({ onSelectUser }) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = await securityAdminService.listSecurityAlerts();
      setAlerts(data.alerts || []);
      setGeneratedAt(data.generatedAt);
      setState('ready');
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('security.alertsSection.title', 'Security alerts')}</h2>
        <div className="flex items-center gap-3">
          {generatedAt ? (
            <p className="text-xs text-muted-foreground">{t('common.updated', 'Updated')} {formatRelativeTime(generatedAt)}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={load}>
            <RotateCw size={14} /> {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {state === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={ShieldAlert} title={t('security.alertsSection.noActiveAlerts', 'No active alerts')} description={t('security.alertsSection.noActiveAlertsDesc', 'No account lockouts or suspicious activity right now.')} />
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    <AlertOctagon size={16} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={alertSeverityTone(alert.severity)}>{alert.severity}</Badge>
                      <ProtectedAccountBadge isProtected={alert.user?.isProtected} />
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                    {alert.user ? (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline mt-1"
                        onClick={() => onSelectUser?.(alert.user.id)}
                      >
                        {t('security.alertsSection.viewSecurity', 'View account security')}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatRelativeTime(alert.detectedAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
