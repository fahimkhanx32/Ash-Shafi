/**
 * BET-15.2 — Payment provider abstraction (master prompt §36).
 *
 * Every provider implementation must expose this same shape so
 * `payment.service.js` never has to know which concrete gateway
 * (bKash, Nagad, SSLCommerz, a card processor, or plain manual
 * cash/bank reconciliation) is active. Adding a new provider means
 * adding a new file here, not touching the service layer.
 *
 * A provider is never required to implement every method — an
 * offline-only provider (e.g. `manual-payment.provider.js`) can omit
 * `createCheckout`/`verifyWebhookSignature`/`processRefund` entirely;
 * callers check `typeof provider.method === 'function'` before use.
 *
 * @typedef {object} PaymentProvider
 * @property {string} name
 * @property {(params: { amount: number, currency: string, invoiceId: string, patientId: string, metadata?: object }) => Promise<{ providerReference: string, redirectUrl?: string, clientSecret?: string }>} [createCheckout]
 *   Starts an online payment. Must never be called for a provider
 *   that isn't actually configured (see `isConfigured`).
 * @property {() => boolean} isConfigured
 *   Whether this provider has everything it needs (API keys, etc.)
 *   from `env.payment` to actually be used. `payment.service.js`
 *   checks this before calling `createCheckout` and fails with a
 *   clear `PAYMENT_PROVIDER_NOT_CONFIGURED` error rather than a fake
 *   success response.
 * @property {(rawBody: Buffer | string, headers: Record<string, string>) => boolean} [verifyWebhookSignature]
 *   Cryptographically verifies an inbound webhook actually came from
 *   the provider before any of its contents are trusted.
 * @property {(payload: object) => { providerTransactionId: string, status: 'SUCCEEDED' | 'FAILED', amount: number, currency: string }} [parseWebhookEvent]
 * @property {(params: { providerTransactionId: string, amount: number }) => Promise<{ providerRefundId: string, status: 'COMPLETED' | 'PROCESSING' | 'FAILED' }>} [processRefund]
 */

export {};
