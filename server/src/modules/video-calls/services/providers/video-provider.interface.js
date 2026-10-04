/**
 * BET-14.1 — Video provider abstraction (master prompt §32: "Use a
 * provider abstraction so the video provider can be changed later.
 * Do NOT make medical video consultation dependent on an arbitrary
 * free service if that service compromises privacy or security.").
 *
 * Every provider implementation must expose this same shape so
 * `video-session.service.js` never has to know which concrete video
 * backend is active — mirrors `payment-provider.interface.js`
 * (BET-15) exactly, down to the "not every method is required, check
 * `typeof provider.method === 'function'` before calling" contract.
 * Adding a real hosted gateway later (e.g. a self-hosted Jitsi/SFU
 * deployment, or a vendor like Daily/Twilio once a real account is
 * provisioned) means adding a new file here and switching
 * `VIDEO_PROVIDER` in `.env`, not touching the service layer.
 *
 * @typedef {object} VideoProvider
 * @property {string} name
 * @property {() => boolean} isConfigured
 *   Whether this provider has everything it needs (API keys, SFU
 *   endpoint, etc.) to actually be used. `video-session.service.js`
 *   checks this before using a provider and fails with a clear
 *   `VIDEO_PROVIDER_NOT_CONFIGURED` error rather than a fake session.
 * @property {(params: { roomId: string, sessionId: string, appointmentId: string }) => { roomId: string, iceServers: Array<object> }} createRoom
 *   Prepares whatever the provider needs for a new room/meeting and
 *   returns the connection parameters the client needs to join.
 * @property {(sessionId: string) => Promise<void>} [endRoom]
 *   Best-effort external cleanup when a session ends. Never required
 *   for the session's own `ENDED` status to be recorded — that always
 *   happens locally regardless of whether this succeeds.
 */

export {};
