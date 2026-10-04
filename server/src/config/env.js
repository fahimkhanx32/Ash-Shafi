import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

/**
 * ============================================================
 * Ash-Shāfī
 * Environment Configuration
 * ============================================================
 *
 * Centralized and validated application configuration.
 *
 * Rules:
 * - Never hard-code secrets in source code.
 * - Never log secret values.
 * - Never commit .env to Git.
 * - Production requires required secrets.
 * - Backend modules should import `env` instead of reading
 *   process.env directly.
 */

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const schema = Joi.object({
  // ==========================================================
  // APPLICATION
  // ==========================================================

  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),

  APP_NAME: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .default('Ash-Shāfī'),

  APP_VERSION: Joi.string()
    .trim()
    .default('1.0.0'),

  PORT: Joi.number()
    .port()
    .default(5000),

  API_PREFIX: Joi.string()
    .pattern(/^\/[a-zA-Z0-9/_-]+$/)
    .default('/api/v1'),

  SERVER_URL: Joi.string()
    .uri({
      scheme: ['http', 'https'],
    })
    .default('http://localhost:5000'),

  CLIENT_WEB_URL: Joi.string()
    .uri({
      scheme: ['http', 'https'],
    })
    .default('http://localhost:3000'),

  CLIENT_MOBILE_SCHEME: Joi.string()
    .pattern(/^[a-z][a-z0-9+.-]*:\/\//i)
    .default('ashshafi://'),

  // BET-23 — Reliability / graceful shutdown.
  //
  // Upper bound on how long `server.js`'s shutdown handler waits for
  // `server.close()` (in-flight requests draining, keep-alive sockets
  // ending) plus Redis/MongoDB disconnects before forcing
  // `process.exit(1)` anyway. Without this, a single stuck keep-alive
  // connection or a hung DB disconnect call can leave a "shutting
  // down" process running indefinitely — invisible to an orchestrator
  // that already stopped routing traffic to it, but never actually
  // exiting so the process manager (Docker/PM2/systemd) never
  // restarts it either.
  SHUTDOWN_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(120_000)
    .default(10_000),

  // ==========================================================
  // MONGODB
  // ==========================================================

  MONGODB_URI: Joi.string()
    .trim()
    .min(1)
    .required(),

  MONGODB_DB_NAME: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .default('Ash-Shāfī'),

  DNS_PRIMARY: Joi.string()
    .ip()
    .default('1.1.1.1'),

  DNS_SECONDARY: Joi.string()
    .ip()
    .default('8.8.8.8'),

  // BET-23 — Reliability / recovery procedures.
  //
  // Startup DB connection retry. A cloud MongoDB cluster (Atlas) can
  // be transiently unreachable at the exact moment a container/process
  // boots (DNS not yet warm, a rolling cluster maintenance window, a
  // brief network blip) — treating that as fatal on the very first
  // attempt means a perfectly healthy deploy crash-loops instead of
  // recovering on its own a few seconds later. `connectDatabase()`
  // retries with exponential backoff up to this many additional
  // attempts before giving up and letting `server.js` exit non-zero
  // (so the process manager's own restart policy — see
  // docs/reliability/RECOVERY_PROCEDURES.md — takes over from there).
  // Set to 0 to disable retrying and fail immediately, e.g. in CI.
  DB_CONNECT_RETRY_ATTEMPTS: Joi.number()
    .integer()
    .min(0)
    .max(20)
    .default(5),

  DB_CONNECT_RETRY_DELAY_MS: Joi.number()
    .integer()
    .min(100)
    .max(30_000)
    .default(2_000),

  // Bounds how long GET /health/ready's live DB ping is allowed to
  // hang before the readiness check itself gives up and reports the
  // dependency unhealthy — a ping that never resolves must not mean a
  // readiness probe that never responds.
  DB_HEALTH_PING_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(30_000)
    .default(3_000),

  // ==========================================================
  // DEFAULT ADMIN
  // ==========================================================

  DEFAULT_ADMIN_NAME: Joi.string()
    .trim()
    .min(2)
    .default('Super Admin'),

  DEFAULT_ADMIN_EMAIL: Joi.string()
    .email()
    .allow('')
    .default(''),

  DEFAULT_ADMIN_PASSWORD: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // JWT
  // ==========================================================

  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+(s|m|h|d|w)$/)
    .default('15m'),

  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+(s|m|h|d|w)$/)
    .default('30d'),

  JWT_ISSUER: Joi.string()
    .trim()
    .min(2)
    .default('ashshafi'),

  JWT_AUDIENCE: Joi.string()
    .trim()
    .min(2)
    .default('ashshafi-users'),

  // ==========================================================
  // PASSWORD SECURITY
  // ==========================================================

  ARGON2_MEMORY_COST: Joi.number()
    .integer()
    .min(8192)
    .default(65536),

  ARGON2_TIME_COST: Joi.number()
    .integer()
    .min(1)
    .default(3),

  ARGON2_PARALLELISM: Joi.number()
    .integer()
    .min(1)
    .default(4),

  // ==========================================================
  // COOKIES
  // ==========================================================

  COOKIE_DOMAIN: Joi.string()
    .allow('')
    .default(''),

  COOKIE_SECURE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  COOKIE_SAME_SITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default('lax'),

  // ==========================================================
  // CORS
  // ==========================================================

  CORS_ORIGINS: Joi.string()
    .default('http://localhost:3000'),

  // ==========================================================
  // CLOUDINARY
  // ==========================================================

  CLOUDINARY_CLOUD_NAME: Joi.string()
    .trim()
    .allow('')
    .default(''),

  CLOUDINARY_API_KEY: Joi.string()
    .allow('')
    .default(''),

  CLOUDINARY_API_SECRET: Joi.string()
    .allow('')
    .default(''),

  CLOUDINARY_URL: Joi.string()
    .trim()
    .allow('')
    .default(''),

  // ==========================================================
  // ELEVENLABS VOICE AGENT (optional — voice features are inert
  // until these are set; see docs/elevenlabs-voice-agent.md)
  // ==========================================================

  ELEVENLABS_API_KEY: Joi.string()
    .trim()
    .allow('')
    .default(''),

  ELEVENLABS_AGENT_ID: Joi.string()
    .trim()
    .allow('')
    .default(''),

  // Optional shared secret ElevenLabs can be configured to send as a
  // header on every server-tool webhook call, checked in addition to
  // (never instead of) the doctor's own JWT — defense in depth, not
  // the primary authorization mechanism (see voice.routes.js).
  ELEVENLABS_WEBHOOK_SECRET: Joi.string()
    .trim()
    .allow('')
    .default(''),

  // ==========================================================
  // FILE UPLOAD LIMITS
  // ==========================================================

  MAX_PROFILE_IMAGE_SIZE_MB: Joi.number()
    .positive()
    .default(2),

  MAX_DOCUMENT_SIZE_MB: Joi.number()
    .positive()
    .default(25),

  MAX_PDF_SIZE_MB: Joi.number()
    .positive()
    .default(25),

  MAX_IMAGE_SIZE_MB: Joi.number()
    .positive()
    .default(10),

  MAX_VIDEO_SIZE_MB: Joi.number()
    .positive()
    .default(250),

  MAX_AUDIO_SIZE_MB: Joi.number()
    .positive()
    .default(25),

  // ==========================================================
  // OCR / MEDICAL DOCUMENT EXTRACTION (BET-12)
  // ==========================================================
  // Provider-abstracted per master prompt §BET-12.7/§BET-12.35 — the
  // rest of the report/extraction pipeline only ever calls
  // `modules/reports/services/ocr.service.js`'s provider-agnostic
  // `runOcr()`, never a vendor SDK directly, so swapping
  // OCR_PROVIDER to a future cloud OCR vendor needs no changes
  // outside that one file. All defaults point at the `tesseract`/
  // `pdftoppm` CLI binaries already present in this environment
  // (Ubuntu `tesseract-ocr`/`poppler-utils` packages) — if a
  // deployment target doesn't have them installed, `ocr.service.js`
  // fails a report into `EXTRACTION_FAILED` with a safe message
  // rather than crashing the request (§BET-12.26).

  OCR_PROVIDER: Joi.string()
    .trim()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .default('tesseract'),

  OCR_DEFAULT_LANGUAGES: Joi.string()
    .trim()
    .default('eng'), // Tesseract '+'-joined language codes, e.g. 'eng+ben'

  OCR_TESSERACT_BIN: Joi.string()
    .trim()
    .default('tesseract'),

  OCR_PDFTOPPM_BIN: Joi.string()
    .trim()
    .default('pdftoppm'),

  OCR_TIMEOUT_MS: Joi.number()
    .positive()
    .default(60000),

  // ==========================================================
  // EMAIL
  // ==========================================================

  SMTP_HOST: Joi.string()
    .trim()
    .allow('')
    .default(''),

  SMTP_PORT: Joi.number()
    .port()
    .default(587),

  SMTP_SECURE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  SMTP_USER: Joi.string()
    .trim()
    .allow('')
    .default(''),

  SMTP_PASSWORD: Joi.string()
    .allow('')
    .default(''),

  SMTP_FROM_NAME: Joi.string()
    .trim()
    .default('Ash-Shāfī'),

  SMTP_FROM_EMAIL: Joi.string()
    .email()
    .allow('')
    .default(''),

  // ==========================================================
  // SMS
  // ==========================================================

  SMS_PROVIDER: Joi.string()
    .trim()
    .allow('')
    .default(''),

  SMS_API_URL: Joi.string()
    .uri()
    .allow('')
    .default(''),

  SMS_API_KEY: Joi.string()
    .allow('')
    .default(''),

  SMS_API_SECRET: Joi.string()
    .allow('')
    .default(''),

  SMS_SENDER_ID: Joi.string()
    .trim()
    .allow('')
    .default(''),

  // ==========================================================
  // WHATSAPP
  // ==========================================================

  WHATSAPP_PROVIDER: Joi.string()
    .trim()
    .allow('')
    .default(''),

  WHATSAPP_API_URL: Joi.string()
    .uri()
    .allow('')
    .default(''),

  WHATSAPP_ACCESS_TOKEN: Joi.string()
    .allow('')
    .default(''),

  WHATSAPP_PHONE_NUMBER_ID: Joi.string()
    .allow('')
    .default(''),

  WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string()
    .allow('')
    .default(''),

  // BET-16 Checkpoint 4 — inbound webhook verification. Optional,
  // like every other integration credential above; the webhook
  // receiver simply refuses inbound events (fails closed, never
  // fails open) until these are set.
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: Joi.string()
    .allow('')
    .default(''),

  WHATSAPP_APP_SECRET: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // GOOGLE
  // ==========================================================

  GOOGLE_CLIENT_ID: Joi.string()
    .allow('')
    .default(''),

  GOOGLE_CLIENT_SECRET: Joi.string()
    .allow('')
    .default(''),

  GOOGLE_REDIRECT_URI: Joi.string()
    .uri()
    .allow('')
    .default(
      'http://localhost:5000/api/v1/integrations/google/callback'
    ),

  // ==========================================================
  // GOOGLE DRIVE
  // ==========================================================

  GOOGLE_DRIVE_CLIENT_ID: Joi.string()
    .allow('')
    .default(''),

  GOOGLE_DRIVE_CLIENT_SECRET: Joi.string()
    .allow('')
    .default(''),

  GOOGLE_DRIVE_REDIRECT_URI: Joi.string()
    .uri()
    .allow('')
    .default(''),

  GOOGLE_DRIVE_REFRESH_TOKEN: Joi.string()
    .allow('')
    .default(''),

  GOOGLE_DRIVE_BACKUP_FOLDER_ID: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // PAYMENT
  // ==========================================================

  PAYMENT_PROVIDER: Joi.string()
    .trim()
    .allow('')
    .default(''),

  PAYMENT_API_URL: Joi.string()
    .uri()
    .allow('')
    .default(''),

  PAYMENT_API_KEY: Joi.string()
    .allow('')
    .default(''),

  PAYMENT_API_SECRET: Joi.string()
    .allow('')
    .default(''),

  PAYMENT_WEBHOOK_SECRET: Joi.string()
    .allow('')
    .default(''),

  PAYMENT_CURRENCY: Joi.string()
    .length(3)
    .uppercase()
    .default('BDT'),

  // ==========================================================
  // VIDEO CONSULTATION (BET-14)
  // ==========================================================

  // Selects the active `VideoProvider` implementation (master prompt
  // §32 — provider abstraction). `native` (peer-to-peer WebRTC
  // signaled over the existing Socket.IO connection, master prompt's
  // "do not depend on an arbitrary free service") is the only
  // implementation this task ships; a future hosted-gateway provider
  // would add its own file under `modules/video-calls/services/
  // providers/` and be selectable here without touching the service
  // layer.
  VIDEO_PROVIDER: Joi.string()
    .trim()
    .default('native'),

  // STUN/TURN servers handed to the browser's `RTCPeerConnection` for
  // NAT traversal, as a JSON array (e.g.
  // `[{"urls":"stun:stun.l.google.com:19302"}]`). STUN-only by
  // default — a STUN server only helps two peers discover their
  // public address; it never relays call media, unlike a TURN server
  // or a hosted media gateway would (master prompt §32 privacy
  // requirement). A TURN relay (needed for callers behind strict/
  // symmetric NATs) can be added to this same list later without any
  // code change; until then that is a documented limitation, not a
  // hidden one — see `native-webrtc.provider.js`.
  VIDEO_ICE_SERVERS: Joi.string()
    .default('[{"urls":"stun:stun.l.google.com:19302"}]'),

  // How many minutes before `scheduledStart` a participant is allowed
  // to actually join the call (creating/fetching the session itself
  // is not time-gated, only joining).
  VIDEO_EARLY_JOIN_MINUTES: Joi.number()
    .integer()
    .min(0)
    .default(10),

  // If neither participant has caused the session to reach `ACTIVE`
  // within this many minutes of `scheduledStart`, the session is
  // lazily flipped to `EXPIRED` the next time it's read (BET-14.4.6).
  VIDEO_WAITING_ROOM_TIMEOUT_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(30),

  // Informational cap surfaced to the client UI (e.g. "this
  // consultation may run up to 60 minutes") — this task does not
  // forcibly disconnect participants at this mark; enforcing a hard
  // server-side cutoff would need its own explicit task/decision.
  VIDEO_MAX_SESSION_DURATION_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(60),

  // TTL for the single-use join credential issued by `POST
  // /video-calls/sessions/:id/join` (master prompt BET-14.5.2).
  VIDEO_JOIN_TOKEN_TTL_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(10),

  // ==========================================================
  // VERIFICATION
  // ==========================================================

  EMAIL_VERIFICATION_EXPIRES_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(30),

  PASSWORD_RESET_EXPIRES_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(15),

  // ==========================================================
  // ACCOUNT SECURITY
  // ==========================================================

  MAX_LOGIN_ATTEMPTS: Joi.number()
    .integer()
    .positive()
    .default(5),

  LOGIN_LOCKOUT_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(15),

  MAX_PASSWORD_RESET_ATTEMPTS: Joi.number()
    .integer()
    .positive()
    .default(5),

  MAX_OTP_ATTEMPTS: Joi.number()
    .integer()
    .positive()
    .default(5),

  // ==========================================================
  // OTP
  // ==========================================================

  OTP_EXPIRES_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(5),

  OTP_LENGTH: Joi.number()
    .integer()
    .valid(4, 5, 6, 8)
    .default(6),

  // ==========================================================
  // RATE LIMITING
  // ==========================================================

  RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .positive()
    .default(900000),

  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .positive()
    .default(300),

  AUTH_RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .positive()
    .default(10),

  PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .positive()
    .default(5),

  // ==========================================================
  // SOCKET.IO
  // ==========================================================

  SOCKET_PATH: Joi.string()
    .default('/socket.io'),

  SOCKET_CORS_ORIGINS: Joi.string()
    .default('http://localhost:3000'),

  // ==========================================================
  // REDIS
  // ==========================================================

  REDIS_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  REDIS_URL: Joi.string()
    .uri()
    .allow('')
    .default(''),

  // ==========================================================
  // ENCRYPTION
  // ==========================================================

  DATA_ENCRYPTION_KEY: Joi.string()
    .allow('')
    .default(''),

  FIELD_ENCRYPTION_KEY: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // BACKUP
  // ==========================================================

  BACKUP_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  BACKUP_SCHEDULE: Joi.string()
    .trim()
    .default('0 2 * * *'),

  BACKUP_RETENTION_DAYS: Joi.number()
    .integer()
    .positive()
    .default(30),

  BACKUP_ENCRYPTION_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  // ==========================================================
  // AUDIT LOGGING
  // ==========================================================

  AUDIT_LOG_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  AUDIT_LOG_RETENTION_DAYS: Joi.number()
    .integer()
    .positive()
    .default(2555),

  // ==========================================================
  // DATA LIFECYCLE / RETENTION (BET-17 Checkpoint 4)
  // ==========================================================
  // Retention window for the ONE other purge-eligible category
  // besides the audit trail above (see
  // `modules/data-lifecycle/policy/retention-policy.js`) — read,
  // non-clinical in-app notifications. Unread notifications are
  // never purged regardless of age, so this only governs how long a
  // notification a user already saw is kept around afterward.

  NOTIFICATION_RETENTION_DAYS: Joi.number()
    .integer()
    .positive()
    .default(180),

  // ==========================================================
  // LOGGING
  // ==========================================================

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),

  LOG_PRETTY: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  // ==========================================================
  // MEDICAL RECORDS
  // ==========================================================

  MEDICAL_RECORD_EXPORT_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  PATIENT_DATA_EXPORT_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  PATIENT_ACCOUNT_SOFT_DELETE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  // ==========================================================
  // FHIR
  // ==========================================================

  FHIR_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  FHIR_VERSION: Joi.string()
    .valid('R4')
    .default('R4'),

  FHIR_BASE_URL: Joi.string()
    .pattern(/^\/[a-zA-Z0-9/_-]+$/)
    .default('/api/v1/fhir'),

  // ==========================================================
  // MEDICAL REPORT DELIVERY (BET-12)
  // OCR provider settings are declared once above so the
  // provider abstraction cannot be shadowed by a duplicate schema key.
  // ==========================================================

  REPORT_DOWNLOAD_URL_EXPIRES_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(300),

  MAX_REPORT_DOCUMENT_SIZE_MB: Joi.number()
    .positive()
    .default(25),

  // ==========================================================
  // MESSAGING (BET-13) — secure patient-doctor chat, attachments,
  // and voice messages. Reuses the report-storage Cloudinary pattern
  // (authenticated access, short-lived signed download URLs) rather
  // than a separate provider.
  // ==========================================================

  MESSAGING_ATTACHMENT_DOWNLOAD_URL_EXPIRES_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(120),

  MAX_MESSAGE_ATTACHMENT_SIZE_MB: Joi.number()
    .positive()
    .default(15),

  MAX_VOICE_MESSAGE_SIZE_MB: Joi.number()
    .positive()
    .default(10),

  MAX_VOICE_MESSAGE_DURATION_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(300),

  // ==========================================================
  // TELEMEDICINE
  // ==========================================================

  TELEMEDICINE_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  VIDEO_CALL_PROVIDER: Joi.string()
    .trim()
    .allow('')
    .default(''),

  VIDEO_CALL_API_URL: Joi.string()
    .uri()
    .allow('')
    .default(''),

  VIDEO_CALL_API_KEY: Joi.string()
    .allow('')
    .default(''),

  VIDEO_CALL_API_SECRET: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // SOFTWARE OWNER
  // ==========================================================

  OWNER_NAME: Joi.string()
    .trim()
    .min(2)
    .default('Fahim Khan'),

  OWNER_EMAIL: Joi.string()
    .email()
    .allow('')
    .default(''),

  OWNER_USERNAME: Joi.string()
    .trim()
    .allow('')
    .default(''),

  OWNER_INITIAL_ROLE: Joi.string()
    .valid('SOFTWARE_OWNER')
    .default('SOFTWARE_OWNER'),

  OWNER_INITIAL_PASSWORD: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // DIRECTOR
  // ==========================================================

  DIRECTOR_NAME: Joi.string()
    .trim()
    .min(2)
    .default('Ash-Shāfī'),

  DIRECTOR_EMAIL: Joi.string()
    .email()
    .allow('')
    .default(''),

  DIRECTOR_USERNAME: Joi.string()
    .trim()
    .allow('')
    .default(''),

  DIRECTOR_INITIAL_ROLE: Joi.string()
    .valid('DIRECTOR')
    .default('DIRECTOR'),

  DIRECTOR_INITIAL_PASSWORD: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // INITIAL ADMIN
  // ==========================================================

  INITIAL_ADMIN_PASSWORD: Joi.string()
    .allow('')
    .default(''),

  // ==========================================================
  // LOCALIZATION
  // ==========================================================

  SYSTEM_TIMEZONE: Joi.string()
    .default('Asia/Dhaka'),

  DEFAULT_LANGUAGE: Joi.string()
    .valid('en', 'bn', 'hi', 'ur')
    .default('en'),

  SUPPORTED_LANGUAGES: Joi.string()
    .default('en,bn,hi,ur'),

  DEFAULT_CURRENCY: Joi.string()
    .length(3)
    .uppercase()
    .default('BDT'),

  // ==========================================================
  // DEVELOPMENT
  // ==========================================================

  DEBUG: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  ENABLE_API_DOCS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  ENABLE_DEV_ROUTES: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
}).unknown(false);

/**
 * Only validate environment variables belonging to
 * this application.
 */
const schemaKeys = Object.keys(schema.describe().keys);

const applicationEnvironment = Object.fromEntries(
  schemaKeys
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]])
);

const { error, value } = schema.validate(
  applicationEnvironment,
  {
    abortEarly: false,
    convert: true,
  }
);

if (error) {
  const details = error.details
    .map((detail) => detail.message)
    .join('\n');

  console.error(
    '\n❌ Environment configuration validation failed:\n'
  );

  console.error(details);

  console.error(
    '\nFix the values in server/.env and restart the server.\n'
  );

  process.exit(1);
}

/**
 * ============================================================
 * PRODUCTION SECURITY CHECKS
 * ============================================================
 */

if (isProduction) {
  const productionRequiredSecrets = [
    ['JWT_ACCESS_SECRET', value.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', value.JWT_REFRESH_SECRET],
    ['MONGODB_URI', value.MONGODB_URI],
    ['DATA_ENCRYPTION_KEY', value.DATA_ENCRYPTION_KEY],
    ['FIELD_ENCRYPTION_KEY', value.FIELD_ENCRYPTION_KEY],
  ];

  const missingSecrets = productionRequiredSecrets
    .filter(([, secret]) => !secret || secret.trim() === '')
    .map(([name]) => name);

  if (missingSecrets.length > 0) {
    console.error(
      '\n❌ Production startup blocked.\n' +
      'Missing required secrets:\n' +
      `${missingSecrets.join('\n')}\n`
    );

    process.exit(1);
  }

  // BET-23 — Secrets validation.
  //
  // The check above only confirms these five secrets are *present* —
  // it says nothing about whether they're actually strong, unique,
  // or real values rather than a placeholder someone forgot to
  // replace. `.min(32)` at the schema level already rejects an
  // obviously-too-short `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, but
  // `DATA_ENCRYPTION_KEY`/`FIELD_ENCRYPTION_KEY` have no schema-level
  // length floor at all (they're optional/empty outside production,
  // so a hard Joi `.min()` would break non-production `.env` files
  // that never set them) — a one-character `DATA_ENCRYPTION_KEY`
  // would otherwise pass the presence check above and silently
  // derive a real, working AES-256-GCM key from it
  // (`security/encryption.js`'s `deriveKey` hashes whatever string
  // it's given, however weak). The checks below close that gap for
  // production specifically, without touching the schema shape that
  // non-production `.env` files rely on.
  const WEAK_SECRET_PATTERNS = [
    'changeme',
    'change-me',
    'change_me',
    'secret',
    'password',
    'placeholder',
    'example',
    'your-secret',
    'yoursecret',
    'test',
    'default',
    '123456',
    'insecure',
  ];

  const isWeakSecret = (secret) => {
    const normalized = secret.toLowerCase();

    return WEAK_SECRET_PATTERNS.some((pattern) =>
      normalized.includes(pattern),
    );
  };

  const secretsRequiringStrength = [
    ['JWT_ACCESS_SECRET', value.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', value.JWT_REFRESH_SECRET],
    ['DATA_ENCRYPTION_KEY', value.DATA_ENCRYPTION_KEY],
    ['FIELD_ENCRYPTION_KEY', value.FIELD_ENCRYPTION_KEY],
  ];

  // Minimum entropy floor. JWT secrets already enforce this via the
  // Joi schema (`.min(32)`); re-checking here is deliberately
  // redundant (cheap, and keeps this block self-contained/correct
  // even if the schema is ever changed) rather than assumed safe
  // because schema validation ran earlier in the file.
  const tooShort = secretsRequiringStrength
    .filter(([, secret]) => secret.trim().length < 32)
    .map(([name]) => name);

  if (tooShort.length > 0) {
    console.error(
      '\n❌ Production startup blocked: the following secrets are ' +
      'shorter than the required 32 characters:\n' +
      `${tooShort.join('\n')}\n`
    );

    process.exit(1);
  }

  const weakSecrets = secretsRequiringStrength
    .filter(([, secret]) => isWeakSecret(secret))
    .map(([name]) => name);

  if (weakSecrets.length > 0) {
    console.error(
      '\n❌ Production startup blocked: the following secrets look ' +
      'like placeholder/example values rather than real generated ' +
      'secrets:\n' +
      `${weakSecrets.join('\n')}\n` +
      'Generate real values, e.g.: node -e ' +
      '"console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n'
    );

    process.exit(1);
  }

  // Reusing the same value for two secrets that are supposed to be
  // independent defeats the purpose of having two: an attacker who
  // recovers one (e.g. via a refresh-token leak scenario) gets the
  // other for free. Access/refresh JWT secrets must differ so a
  // compromise of one token type doesn't also compromise the other;
  // the two encryption keys must differ so compromising one class of
  // encrypted data (bulk `DATA_ENCRYPTION_KEY`-encrypted records,
  // e.g. backups) doesn't also compromise the other
  // (`FIELD_ENCRYPTION_KEY`-encrypted individual sensitive fields).
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    console.error(
      '\n❌ Production startup blocked: JWT_ACCESS_SECRET and ' +
      'JWT_REFRESH_SECRET must be different values.\n'
    );

    process.exit(1);
  }

  if (value.DATA_ENCRYPTION_KEY === value.FIELD_ENCRYPTION_KEY) {
    console.error(
      '\n❌ Production startup blocked: DATA_ENCRYPTION_KEY and ' +
      'FIELD_ENCRYPTION_KEY must be different values.\n'
    );

    process.exit(1);
  }

  if (value.COOKIE_SECURE !== true) {
    console.error(
      '\n❌ Production startup blocked: ' +
      'COOKIE_SECURE must be true.\n'
    );

    process.exit(1);
  }

  if (value.ENABLE_DEV_ROUTES === true) {
    console.error(
      '\n❌ Production startup blocked: ' +
      'ENABLE_DEV_ROUTES cannot be true.\n'
    );

    process.exit(1);
  }

  if (value.SERVER_URL.startsWith('http://')) {
    console.error(
      '\n❌ Production startup blocked: ' +
      'SERVER_URL must use HTTPS.\n'
    );

    process.exit(1);
  }

  if (value.CLIENT_WEB_URL.startsWith('http://')) {
    console.error(
      '\n❌ Production startup blocked: ' +
      'CLIENT_WEB_URL must use HTTPS.\n'
    );

    process.exit(1);
  }

  if (value.LOG_PRETTY === true) {
    console.warn(
      '⚠️ LOG_PRETTY=true in production. ' +
      'Structured logging is recommended.'
    );
  }
}

/**
 * ============================================================
 * TEST ENVIRONMENT SAFEGUARDS
 * ============================================================
 */

if (isTest) {
  if (
    typeof value.MONGODB_URI === 'string' &&
    /production/i.test(value.MONGODB_URI)
  ) {
    console.error(
      '\n❌ Test environment appears to reference ' +
      'a production database.\n'
    );

    process.exit(1);
  }
}

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

const parseList = (input) =>
  input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const corsOrigins = parseList(value.CORS_ORIGINS);

const socketCorsOrigins = parseList(
  value.SOCKET_CORS_ORIGINS
);

const supportedLanguages = parseList(
  value.SUPPORTED_LANGUAGES
);

// BET-14 — `VIDEO_ICE_SERVERS` is a JSON array handed straight to the
// browser's `RTCPeerConnection`. Fails soft to the same public-STUN
// default the Joi schema already defaults to, rather than crashing
// server startup over a malformed env var — consistent with this
// file's general "non-critical config degrades gracefully" posture
// (e.g. `cloudinary`'s "not configured" fallback in BET-02).
const parseVideoIceServers = (input) => {
  const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const videoIceServers = parseVideoIceServers(value.VIDEO_ICE_SERVERS);

/**
 * ============================================================
 * FINAL CONFIGURATION
 * ============================================================
 */

const env = Object.freeze({
  app: Object.freeze({
    name: value.APP_NAME,
    version: value.APP_VERSION,
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    apiPrefix: value.API_PREFIX,
    serverUrl: value.SERVER_URL,
    clientWebUrl: value.CLIENT_WEB_URL,
    clientMobileScheme: value.CLIENT_MOBILE_SCHEME,
    debug: value.DEBUG,
    shutdownTimeoutMs: value.SHUTDOWN_TIMEOUT_MS,
  }),

  database: Object.freeze({
    uri: value.MONGODB_URI,
    name: value.MONGODB_DB_NAME,
    dnsPrimary: value.DNS_PRIMARY,
    dnsSecondary: value.DNS_SECONDARY,
    connectRetryAttempts: value.DB_CONNECT_RETRY_ATTEMPTS,
    connectRetryDelayMs: value.DB_CONNECT_RETRY_DELAY_MS,
    healthPingTimeoutMs: value.DB_HEALTH_PING_TIMEOUT_MS,
  }),

  jwt: Object.freeze({
    accessSecret: value.JWT_ACCESS_SECRET,
    refreshSecret: value.JWT_REFRESH_SECRET,
    accessExpiresIn: value.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: value.JWT_REFRESH_EXPIRES_IN,
    issuer: value.JWT_ISSUER,
    audience: value.JWT_AUDIENCE,
  }),

  password: Object.freeze({
    memoryCost: value.ARGON2_MEMORY_COST,
    timeCost: value.ARGON2_TIME_COST,
    parallelism: value.ARGON2_PARALLELISM,
  }),

  cookies: Object.freeze({
    domain: value.COOKIE_DOMAIN || undefined,
    secure: value.COOKIE_SECURE,
    sameSite: value.COOKIE_SAME_SITE,
  }),

  cors: Object.freeze({
    origins: corsOrigins,
  }),

  socket: Object.freeze({
    path: value.SOCKET_PATH,
    origins: socketCorsOrigins,
  }),

  cloudinary: Object.freeze({
    cloudName: value.CLOUDINARY_CLOUD_NAME,
    apiKey: value.CLOUDINARY_API_KEY,
    apiSecret: value.CLOUDINARY_API_SECRET,
    url: value.CLOUDINARY_URL,
  }),

  elevenlabs: Object.freeze({
    apiKey: value.ELEVENLABS_API_KEY,
    agentId: value.ELEVENLABS_AGENT_ID,
    webhookSecret: value.ELEVENLABS_WEBHOOK_SECRET,
    isConfigured: Boolean(value.ELEVENLABS_API_KEY && value.ELEVENLABS_AGENT_ID),
  }),

  uploads: Object.freeze({
    profileImageMb: value.MAX_PROFILE_IMAGE_SIZE_MB,
    documentMb: value.MAX_DOCUMENT_SIZE_MB,
    pdfMb: value.MAX_PDF_SIZE_MB,
    imageMb: value.MAX_IMAGE_SIZE_MB,
    videoMb: value.MAX_VIDEO_SIZE_MB,
    audioMb: value.MAX_AUDIO_SIZE_MB,
  }),

  ocr: Object.freeze({
    provider: value.OCR_PROVIDER,
    defaultLanguages: value.OCR_DEFAULT_LANGUAGES,
    tesseractBin: value.OCR_TESSERACT_BIN,
    pdftoppmBin: value.OCR_PDFTOPPM_BIN,
    timeoutMs: value.OCR_TIMEOUT_MS,
  }),

  email: Object.freeze({
    host: value.SMTP_HOST,
    port: value.SMTP_PORT,
    secure: value.SMTP_SECURE,
    user: value.SMTP_USER,
    password: value.SMTP_PASSWORD,
    fromName: value.SMTP_FROM_NAME,
    fromEmail: value.SMTP_FROM_EMAIL,
  }),

  sms: Object.freeze({
    provider: value.SMS_PROVIDER,
    apiUrl: value.SMS_API_URL,
    apiKey: value.SMS_API_KEY,
    apiSecret: value.SMS_API_SECRET,
    senderId: value.SMS_SENDER_ID,
  }),

  whatsapp: Object.freeze({
    provider: value.WHATSAPP_PROVIDER,
    apiUrl: value.WHATSAPP_API_URL,
    accessToken: value.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: value.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: value.WHATSAPP_BUSINESS_ACCOUNT_ID,
    webhookVerifyToken: value.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    appSecret: value.WHATSAPP_APP_SECRET,
  }),

  google: Object.freeze({
    clientId: value.GOOGLE_CLIENT_ID,
    clientSecret: value.GOOGLE_CLIENT_SECRET,
    redirectUri: value.GOOGLE_REDIRECT_URI,
  }),

  googleDrive: Object.freeze({
    clientId: value.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: value.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri: value.GOOGLE_DRIVE_REDIRECT_URI,
    refreshToken: value.GOOGLE_DRIVE_REFRESH_TOKEN,
    backupFolderId: value.GOOGLE_DRIVE_BACKUP_FOLDER_ID,
  }),

  payment: Object.freeze({
    provider: value.PAYMENT_PROVIDER,
    apiUrl: value.PAYMENT_API_URL,
    apiKey: value.PAYMENT_API_KEY,
    apiSecret: value.PAYMENT_API_SECRET,
    webhookSecret: value.PAYMENT_WEBHOOK_SECRET,
    currency: value.PAYMENT_CURRENCY,
  }),

  security: Object.freeze({
    maxLoginAttempts: value.MAX_LOGIN_ATTEMPTS,
    loginLockoutMinutes: value.LOGIN_LOCKOUT_MINUTES,
    maxPasswordResetAttempts:
      value.MAX_PASSWORD_RESET_ATTEMPTS,
    maxOtpAttempts: value.MAX_OTP_ATTEMPTS,
    otpExpiresMinutes: value.OTP_EXPIRES_MINUTES,
    otpLength: value.OTP_LENGTH,
    rateLimitWindowMs: value.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests:
      value.RATE_LIMIT_MAX_REQUESTS,
    authRateLimitMaxRequests:
      value.AUTH_RATE_LIMIT_MAX_REQUESTS,
    passwordResetRateLimitMaxRequests:
      value.PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS,
  }),

  verification: Object.freeze({
    emailExpiresMinutes:
      value.EMAIL_VERIFICATION_EXPIRES_MINUTES,
    passwordResetExpiresMinutes:
      value.PASSWORD_RESET_EXPIRES_MINUTES,
  }),

  encryption: Object.freeze({
    dataKey: value.DATA_ENCRYPTION_KEY,
    fieldKey: value.FIELD_ENCRYPTION_KEY,
  }),

  redis: Object.freeze({
    enabled: value.REDIS_ENABLED,
    url: value.REDIS_URL,
  }),

  backup: Object.freeze({
    enabled: value.BACKUP_ENABLED,
    schedule: value.BACKUP_SCHEDULE,
    retentionDays: value.BACKUP_RETENTION_DAYS,
    encryptionEnabled:
      value.BACKUP_ENCRYPTION_ENABLED,
  }),

  audit: Object.freeze({
    enabled: value.AUDIT_LOG_ENABLED,
    retentionDays: value.AUDIT_LOG_RETENTION_DAYS,
  }),

  dataLifecycle: Object.freeze({
    notificationRetentionDays: value.NOTIFICATION_RETENTION_DAYS,
  }),

  medicalRecords: Object.freeze({
    exportEnabled:
      value.MEDICAL_RECORD_EXPORT_ENABLED,
    patientDataExportEnabled:
      value.PATIENT_DATA_EXPORT_ENABLED,
    softDeleteEnabled:
      value.PATIENT_ACCOUNT_SOFT_DELETE,
  }),

  fhir: Object.freeze({
    enabled: value.FHIR_ENABLED,
    version: value.FHIR_VERSION,
    baseUrl: value.FHIR_BASE_URL,
  }),



  reports: Object.freeze({
    downloadUrlExpiresSeconds: value.REPORT_DOWNLOAD_URL_EXPIRES_SECONDS,
    maxDocumentSizeMb: value.MAX_REPORT_DOCUMENT_SIZE_MB,
  }),

  messaging: Object.freeze({
    attachmentDownloadUrlExpiresSeconds:
      value.MESSAGING_ATTACHMENT_DOWNLOAD_URL_EXPIRES_SECONDS,
    maxAttachmentSizeMb: value.MAX_MESSAGE_ATTACHMENT_SIZE_MB,
    maxVoiceMessageSizeMb: value.MAX_VOICE_MESSAGE_SIZE_MB,
    maxVoiceMessageDurationSeconds: value.MAX_VOICE_MESSAGE_DURATION_SECONDS,
  }),

  telemedicine: Object.freeze({
    enabled: value.TELEMEDICINE_ENABLED,
    provider: value.VIDEO_CALL_PROVIDER,
    apiUrl: value.VIDEO_CALL_API_URL,
    apiKey: value.VIDEO_CALL_API_KEY,
    apiSecret: value.VIDEO_CALL_API_SECRET,
  }),

  // BET-14 — Video Consultation. Deliberately its own block rather
  // than reusing/renaming the pre-existing `telemedicine` block above
  // (untouched — some other module may already read it) — see
  // `modules/video-calls/services/providers/native-webrtc.provider.js`
  // and `.../providers/index.js` for how these are consumed.
  video: Object.freeze({
    provider: value.VIDEO_PROVIDER,
    iceServers: videoIceServers,
    earlyJoinMinutes: value.VIDEO_EARLY_JOIN_MINUTES,
    waitingRoomTimeoutMinutes: value.VIDEO_WAITING_ROOM_TIMEOUT_MINUTES,
    maxSessionDurationMinutes: value.VIDEO_MAX_SESSION_DURATION_MINUTES,
    joinTokenTtlMinutes: value.VIDEO_JOIN_TOKEN_TTL_MINUTES,
  }),

  owner: Object.freeze({
    name: value.OWNER_NAME,
    email: value.OWNER_EMAIL,
    username: value.OWNER_USERNAME,
    role: value.OWNER_INITIAL_ROLE,
    initialPassword: value.OWNER_INITIAL_PASSWORD,
  }),

  director: Object.freeze({
    name: value.DIRECTOR_NAME,
    email: value.DIRECTOR_EMAIL,
    username: value.DIRECTOR_USERNAME,
    role: value.DIRECTOR_INITIAL_ROLE,
    initialPassword: value.DIRECTOR_INITIAL_PASSWORD,
  }),

  initialAdmin: Object.freeze({
    name: value.DEFAULT_ADMIN_NAME,
    email: value.DEFAULT_ADMIN_EMAIL,
    password: value.DEFAULT_ADMIN_PASSWORD,
    initialPassword: value.INITIAL_ADMIN_PASSWORD,
  }),

  localization: Object.freeze({
    timezone: value.SYSTEM_TIMEZONE,
    defaultLanguage: value.DEFAULT_LANGUAGE,
    supportedLanguages,
    defaultCurrency: value.DEFAULT_CURRENCY,
  }),

  logging: Object.freeze({
    level: value.LOG_LEVEL,
    pretty: value.LOG_PRETTY,
  }),

  features: Object.freeze({
    apiDocs: value.ENABLE_API_DOCS,
    devRoutes: value.ENABLE_DEV_ROUTES,
    redis: value.REDIS_ENABLED,
    fhir: value.FHIR_ENABLED,
    telemedicine: value.TELEMEDICINE_ENABLED,
    backups: value.BACKUP_ENABLED,
    auditLogging: value.AUDIT_LOG_ENABLED,
  }),
});

export { env };
export default env;