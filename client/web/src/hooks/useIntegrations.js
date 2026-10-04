import { useCallback, useEffect, useState } from 'react';

import * as integrationsService from '../services/integrationsService.js';
import { extractApiError } from '../services/apiClient.js';

/**
 * FET-19 — loads the real integration registry (`GET /integrations`).
 * Same `{items/state/error/reload}`-shaped loading contract this
 * project already uses elsewhere (e.g. `CertificatesTab.jsx`'s
 * `state: 'loading'|'ready'|'error'`), so `IntegrationsPage.jsx`
 * doesn't need to invent a new loading convention.
 */
export function useIntegrations() {
  const [integrations, setIntegrations] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const items = await integrationsService.listIntegrations();
      setIntegrations(items);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { integrations, state, errorMessage, reload: load };
}
