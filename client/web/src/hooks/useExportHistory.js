import { useCallback, useEffect, useState } from 'react';

import * as auditLogService from '../services/auditLogService.js';
import { extractApiError } from '../services/apiClient.js';

const AUDIT_CATEGORIES = { DATA_EXPORT: 'DATA_EXPORT' };

/**
 * FET-21 "Export history" — now backed by the real
 * `GET /audit-logs/me` endpoint (FET-20 minimal slice, pulled
 * forward specifically for this) instead of the earlier client-local
 * `localStorage` implementation. Every export/import controller
 * already wrote a real `AuditLog` entry before this session — this
 * hook just queries it, self-scoped to the signed-in user, the same
 * `GET /notifications/me`-style boundary the backend route uses.
 *
 * No `recordEntry`/`clear` here anymore: the backend is the sole
 * source of truth (there is nothing client-side left to persist or
 * clear — an audit trail isn't something a user's own UI should be
 * able to erase). Callers that used to call `recordEntry(entry)`
 * after a successful export/import should call `refresh()` instead;
 * every action that produces a history row already `await`s its
 * audit write before responding, so a refresh immediately after
 * shows the new entry with no race.
 *
 * Merges two queries — `category=DATA_EXPORT` (tabular + medical-
 * record request/download events) and `action=PATIENT_BULK_IMPORT`
 * (filed under `RECORD_CREATE`, not `DATA_EXPORT`, by
 * `import.controller.js` — see that file's own comment) — since a
 * single category filter can't cover both halves of "export/import
 * activity" the way the old unified client-local log did.
 */
export function useExportHistory() {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback((targetPage = 1) => {
    setLoading(true);
    setError('');
    Promise.all([
      auditLogService.listMyAuditLogs({ category: AUDIT_CATEGORIES.DATA_EXPORT, page: targetPage, limit: 20 }),
      auditLogService.listMyAuditLogs({ action: 'PATIENT_BULK_IMPORT', page: targetPage, limit: 20 }),
    ])
      .then(([exportResult, importResult]) => {
        const merged = [...exportResult.items, ...importResult.items].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
        setEntries(merged);
        setPagination(exportResult.pagination);
        setPage(targetPage);
      })
      .catch((err) => setError(extractApiError(err).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const refresh = useCallback(() => load(1), [load]);
  const nextPage = useCallback(() => load(page + 1), [load, page]);
  const prevPage = useCallback(() => load(Math.max(1, page - 1)), [load, page]);

  return { entries, loading, error, pagination, page, refresh, nextPage, prevPage };
}
