import apiClient from './apiClient.js';

/**
 * FET-19 — Social & External Integrations (frontend).
 *
 * Thin wrapper around `server/src/modules/integrations`'s real,
 * already-mounted `/api/v1/integrations` routes (built in BET-16).
 * No mock/fake data anywhere in this file — every field returned
 * here is exactly what the backend's integration-provider registry
 * reports for EMAIL/SMS/WHATSAPP (`integration-registry.service.js`),
 * derived from real `.env` configuration, never invented client-side.
 *
 * There is deliberately no `updateIntegration()`/`connect()`/
 * `disconnect()` export here — the backend has no write endpoint for
 * integration configuration (credentials are managed via server
 * environment variables only, per the master prompt's credential-
 * security rules), so a frontend "Save" action here would either do
 * nothing or silently lie about persisting a change. `IntegrationsPage`
 * reflects that honestly: configuration is read-only in this UI.
 */

export const listIntegrations = async () => {
  const { data } = await apiClient.get('/integrations');
  return data.data || [];
};

export const getIntegration = async (key) => {
  const { data } = await apiClient.get(`/integrations/${key}`);
  return data.data;
};

/**
 * `GET /integrations/logs` — the real `IntegrationLog` collection
 * (`modules/integrations/models/integration-log.model.js`), one row
 * per inbound webhook or outbound-send attempt, `SUCCESS`/`FAILURE`/
 * `REJECTED`. Used for connection/sync/error status (derived from
 * real recent activity, not a fabricated "last synced" timestamp —
 * see `IntegrationsPage.jsx`'s own note on why these providers have
 * no genuine two-way "sync" concept) and for the Integration Logs
 * table itself.
 */
export const listIntegrationLogs = async ({ integrationKey, status, page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/integrations/logs', {
    params: {
      ...(integrationKey ? { integrationKey } : {}),
      ...(status ? { status } : {}),
      page,
      limit,
    },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};
