/**
 * BET-16 Checkpoint 3 — External integration provider abstraction
 * (master prompt §33/§34: "official integrations architecture",
 * "provider abstraction", "the doctor/admin can configure integration
 * credentials through secure settings").
 *
 * Mirrors the shape already established by
 * `modules/payments/services/providers/payment-provider.interface.js`:
 * `integration-registry.service.js` never needs to know which
 * concrete channel (WhatsApp Cloud API, a generic SMS gateway, SMTP)
 * backs a given integration — it only ever calls `isConfigured()` and
 * reads `describe()`. Adding a future provider (a new SMS vendor, a
 * social-sharing platform) means adding one file that satisfies this
 * shape, not touching the registry or the admin API.
 *
 * `describe()` is deliberately the ONLY way the registry is allowed
 * to surface a provider's configuration to an admin API response —
 * it must return metadata only (which provider is selected, whether
 * it is configured, non-secret identifiers like a sender ID or phone
 * number ID). It must NEVER return an API key, access token, secret,
 * or password. This is the module's "secrets management" boundary:
 * credentials live only in `.env` (via `config/env.js`), are read
 * only inside each concrete `*.service.js`, and are never persisted
 * to the database, logged, or returned in an API response (master
 * prompt §11/§57/§80).
 *
 * @typedef {object} IntegrationProvider
 * @property {string} key
 *   Stable machine key, e.g. 'WHATSAPP', 'SMS', 'EMAIL'.
 * @property {string} label
 *   Human-readable display name for the admin UI.
 * @property {() => boolean} isConfigured
 *   Whether this integration has everything it needs from `env` to
 *   actually be used right now.
 * @property {() => Record<string, unknown>} describe
 *   Non-secret status/metadata for the admin integrations screen.
 *   MUST NOT include any credential value.
 */

export {};
