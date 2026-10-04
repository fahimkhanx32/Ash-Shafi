import { Mail, MessageCircle, MessageSquare, Plug } from 'lucide-react';

/**
 * FET-19 — Social & External Integrations.
 *
 * Maps the real integration `key`s the backend registry returns
 * (`server/src/modules/integrations/services/integration-registry.service.js`
 * — currently EMAIL/SMS/WHATSAPP) to a display icon. Deliberately a
 * lookup with a safe fallback (`Plug`), not a hardcoded three-card
 * layout — a future backend integration (e.g. a payment-gateway
 * provider joining this same registry) shows up automatically the
 * next time this list is fetched, with a generic icon, rather than
 * silently being dropped because the frontend only knew about three
 * keys.
 */
export const INTEGRATION_ICONS = {
  EMAIL: Mail,
  SMS: MessageSquare,
  WHATSAPP: MessageCircle,
};

export const getIntegrationIcon = (key) => INTEGRATION_ICONS[key] || Plug;

/**
 * Fields every integration's `describe()` may return that are pure
 * bookkeeping, not something worth its own "Provider settings" row —
 * `key`/`label` are already the card header, `configured` already
 * drives the Connection status badge.
 */
const HIDDEN_DESCRIBE_FIELDS = new Set(['key', 'label', 'configured']);

/**
 * `describe()` field names are camelCase (`fromEmail`, `senderId`,
 * `phoneNumberId`, `webhookConfigured`, …) straight off each
 * provider's real config object — this turns them into a readable
 * label without maintaining a hand-written map per field per
 * provider, so a new field a provider adds to its `describe()` still
 * renders with a sensible label instead of silently being dropped.
 */
export const formatFieldLabel = (fieldName) =>
  fieldName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

/**
 * Provider settings are real but non-secret (see each provider file's
 * own comment — masked IDs, never a token/API key). `null`/empty
 * means the backend has no value for that field (unconfigured), not
 * an error — rendered as an explicit "Not set" rather than a blank
 * cell so it reads the same as "connection status: not configured".
 */
export const formatFieldValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  return String(value);
};

export const describeEntries = (integration) =>
  Object.entries(integration || {}).filter(([field]) => !HIDDEN_DESCRIBE_FIELDS.has(field));
