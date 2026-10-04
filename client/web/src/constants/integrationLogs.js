/**
 * FET-19 checkpoint 2 — Integration logs / Sync status / Error status.
 *
 * Pure display mappings for the real `IntegrationLog` documents
 * `GET /integrations/logs` returns
 * (`server/src/modules/integrations/models/integration-log.model.js`).
 * `STATUS_VALUES`/`DIRECTION_VALUES` here are hand-copied to match
 * that model's own frozen enums exactly (`SUCCESS`/`FAILURE`/
 * `REJECTED`, `INBOUND_WEBHOOK`/`OUTBOUND_SEND`) — the frontend has no
 * way to import a server-side file, so this is the one place that
 * pairing has to be kept in sync by hand if the backend enum ever
 * changes.
 */

export const LOG_STATUS_BADGE = {
  SUCCESS: 'success',
  FAILURE: 'destructive',
  REJECTED: 'warning',
};

export const logStatusVariant = (status) => LOG_STATUS_BADGE[status] || 'neutral';

export const LOG_DIRECTION_LABEL = {
  INBOUND_WEBHOOK: 'Inbound webhook',
  OUTBOUND_SEND: 'Outbound send',
};

export const logDirectionLabel = (direction) => LOG_DIRECTION_LABEL[direction] || direction;

/**
 * A log's `status` doubles as the closest real signal this system has
 * to a per-integration "sync status" — these providers are one-way
 * send/receive channels with no genuine two-way sync concept (see
 * `integrationsService.js`'s own note), so "is it syncing" is
 * answered honestly as "did its most recent recorded event succeed",
 * not a fabricated sync-progress indicator.
 */
export const SYNC_STATUS_LABEL = {
  SUCCESS: 'Healthy',
  FAILURE: 'Failing',
  REJECTED: 'Rejected',
};

export const syncStatusLabel = (status) => SYNC_STATUS_LABEL[status] || 'Unknown';
