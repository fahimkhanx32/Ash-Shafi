import { useTranslation } from 'react-i18next';
import { Download, FileText, Upload } from 'lucide-react';

import { Card, CardContent } from '../ui/card.jsx';
import { Button } from '../ui/button.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Badge } from '../ui/badge.jsx';
import { formatDateTime } from '../../lib/dateFormat.js';

const ICON_BY_ACTION = {
  TABULAR_EXPORT: Download,
  TABULAR_EXPORT_DENIED: Download,
  MEDICAL_RECORD_EXPORT_REQUESTED: FileText,
  CONTROLLED_EXPORT_DOWNLOADED: FileText,
  CONTROLLED_EXPORT_DOWNLOAD_FAILED: FileText,
  PATIENT_BULK_IMPORT: Upload,
  PATIENT_BULK_IMPORT_DENIED: Upload,
};

/**
 * FET-17 — entity-type label lookup piggybacks on the same
 * `dataTools.export.entities.*` keys `ExportTab.jsx` already uses,
 * so a new export entity type only ever needs adding in one place.
 */
const entityLabel = (t, resourceType) => {
  const key = `dataTools.export.entities.${resourceType}`;
  const label = t(key);
  return label === key ? resourceType || '—' : label.toLowerCase();
};

/**
 * Builds the one-line summary for a single audit-log row. Each
 * `entry.action` mirrors `AUDIT_ACTIONS` (`audit.constants.js`) and
 * `entry.metadata` mirrors exactly what that action's controller
 * recorded (see `export.controller.js`/`import.controller.js`) — this
 * is a display-only mapping, it never recomputes or infers a field
 * the backend didn't already write.
 */
const summaryLine = (entry, t) => {
  const meta = entry.metadata || {};
  switch (entry.action) {
    case 'TABULAR_EXPORT':
      return t('dataTools.history.actions.TABULAR_EXPORT', {
        count: meta.recordCount,
        entity: entityLabel(t, entry.resourceType),
        format: meta.format,
      });
    case 'TABULAR_EXPORT_DENIED':
      return t('dataTools.history.actions.TABULAR_EXPORT_DENIED', {
        entity: entityLabel(t, entry.resourceType),
      });
    case 'MEDICAL_RECORD_EXPORT_REQUESTED':
      return t('dataTools.history.actions.MEDICAL_RECORD_EXPORT_REQUESTED', { format: meta.format });
    case 'CONTROLLED_EXPORT_DOWNLOADED':
      return t('dataTools.history.actions.CONTROLLED_EXPORT_DOWNLOADED', {
        filename: meta.filename || '—',
      });
    case 'CONTROLLED_EXPORT_DOWNLOAD_FAILED':
      return t('dataTools.history.actions.CONTROLLED_EXPORT_DOWNLOAD_FAILED');
    case 'PATIENT_BULK_IMPORT':
      return t('dataTools.history.actions.PATIENT_BULK_IMPORT', {
        // The backend's PATIENT_BULK_IMPORT audit entry doesn't record
        // the original filename (only fileMimeType) — see
        // `import.controller.js`. Falls back to '—' rather than
        // showing a blank, until that's added server-side.
        filename: meta.filename || '—',
        created: meta.createdCount,
        failed: meta.failedCount,
        total: meta.totalRows,
      });
    case 'PATIENT_BULK_IMPORT_DENIED':
      return t('dataTools.history.actions.PATIENT_BULK_IMPORT_DENIED');
    default:
      return t('dataTools.history.actions.fallback');
  }
};

/**
 * FET-17 — localizes the panel and switches it from the retired
 * client-local `{ entries, onClear }` shape to the real
 * `useExportHistory()` hook contract (`{ entries, loading, error,
 * pagination, page, refresh, nextPage, prevPage }`) that
 * `DataToolsPage.jsx` has passed as a single `history` prop since the
 * FET-21 audit-log rewire. The previous version of this file still
 * destructured the old shape directly off props and would throw
 * (`entries.length` on `undefined`) as soon as this tab rendered —
 * that mismatch is fixed here, not just the translation strings.
 * There's no client-side "Clear" anymore either: the backend audit
 * trail is the sole source of truth and isn't user-erasable (see the
 * hook's own doc comment).
 */
export function ExportHistoryPanel({ history }) {
  const { t } = useTranslation();
  const { entries, loading, error, pagination, page, refresh, nextPage, prevPage } = history;

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">{t('dataTools.history.subtitle')}</h3>
        </div>

        <Alert className="mb-4">
          <AlertDescription>{t('dataTools.history.notice')}</AlertDescription>
        </Alert>

        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState title={t('dataTools.history.loadErrorTitle')} description={error} onRetry={refresh} />
        ) : entries.length === 0 ? (
          <EmptyState
            title={t('dataTools.history.emptyTitle')}
            description={t('dataTools.history.emptyDescription')}
          />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {entries.map((entry) => {
                const Icon = ICON_BY_ACTION[entry.action] || Download;
                const failedCount = entry.metadata?.failedCount;
                return (
                  <li key={entry._id || entry.id} className="flex items-start gap-3 px-4 py-3">
                    <Icon size={16} className="mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{summaryLine(entry, t)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    {entry.outcome === 'DENIED' ? (
                      <Badge variant="destructive">{t('dataTools.history.deniedBadge')}</Badge>
                    ) : failedCount > 0 ? (
                      <Badge variant="warning">{t('dataTools.history.failedBadge', { count: failedCount })}</Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {pagination && pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" onClick={prevPage} disabled={page <= 1}>
                  {t('dataTools.history.prevPage')}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t('dataTools.history.pageOf', { page, total: pagination.totalPages })}
                </p>
                <Button variant="outline" size="sm" onClick={nextPage} disabled={page >= pagination.totalPages}>
                  {t('dataTools.history.nextPage')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
