import { useCallback, useEffect, useState } from 'react';

import * as integrationsService from '../services/integrationsService.js';
import { extractApiError } from '../services/apiClient.js';

/**
 * FET-19 checkpoint 2 — backs both the Integration Logs table (full,
 * user-filterable, server-paginated) and each `IntegrationCard`'s
 * "recent activity" summary (a small, unfiltered recent window) —
 * same real `GET /integrations/logs` endpoint
 * (`integration-log.service.js`'s `listIntegrationLogs`), just called
 * with different params. Mirrors `useIntegrations()`'s
 * `state: 'loading'|'ready'|'error'` loading contract, plus the
 * `{items, pagination}` shape `NotificationsPage.jsx` already
 * established for paginated lists elsewhere in this project.
 *
 * Re-fetches whenever `integrationKey`/`status`/`page`/`limit`
 * change — the caller owns that filter/page state, this hook just
 * reacts to it (same division of responsibility as
 * `NotificationsPage.jsx`'s own `load()`).
 */
export function useIntegrationLogs({ integrationKey, status, page = 1, limit = 20 } = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await integrationsService.listIntegrationLogs({
        integrationKey,
        status,
        page,
        limit,
      });
      setItems(result.items);
      setPagination(result.pagination);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationKey, status, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, pagination, state, errorMessage, reload: load };
}
