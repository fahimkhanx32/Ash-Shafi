import mongoose from 'mongoose';

/**
 * BET-16 Checkpoint 4 — Integration event log (master prompt §45:
 * sensitive/operational events should be auditable; here scoped to
 * external-integration traffic specifically since the project-wide
 * audit module (`audit/audit.model.js`) is still an empty placeholder
 * pending BET-17 and this checkpoint's own "Integration logging"
 * requirement needs something real to write to now).
 *
 * Deliberately stores metadata only — never a raw webhook payload,
 * header, or credential. `sanitizedPayload` is a small, pre-selected
 * summary object built by the caller (never the raw body verbatim),
 * so this collection can never become a place a secret or a
 * patient's WhatsApp message content accidentally leaks into (master
 * prompt §57 — never log message content unnecessarily).
 */

const DIRECTIONS = Object.freeze(['INBOUND_WEBHOOK', 'OUTBOUND_SEND']);
const STATUSES = Object.freeze(['SUCCESS', 'FAILURE', 'REJECTED']);

const integrationLogSchema = new mongoose.Schema(
  {
    integrationKey: { type: String, required: true, trim: true, uppercase: true, index: true },
    direction: { type: String, enum: DIRECTIONS, required: true },
    eventType: { type: String, trim: true, maxlength: 100, default: '' },
    status: { type: String, enum: STATUSES, required: true, index: true },
    httpStatus: { type: Number, default: null },
    reason: { type: String, trim: true, maxlength: 200, default: '' },
    // Small, non-secret, caller-selected metadata only — see file
    // header. Never the raw request/response body.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, default: '' },
  },
  { timestamps: true, versionKey: false },
);

integrationLogSchema.index({ createdAt: -1 });
integrationLogSchema.index({ integrationKey: 1, createdAt: -1 });

export const DIRECTION_VALUES = DIRECTIONS;
export const STATUS_VALUES = STATUSES;

export const IntegrationLog = mongoose.model(
  'IntegrationLog',
  integrationLogSchema,
  'integration_logs',
);
