import mongoose from 'mongoose';

/**
 * BET-14.6 — Video Audit & Compliance (master prompt §32/§45).
 *
 * Unlike `MessagingAccessLog` (BET-13), which deliberately logs only
 * the admin-tier-oversight access pattern (ordinary participant reads
 * are not privacy events worth auditing), a video consultation's
 * audit trail is explicitly called for at every lifecycle stage by
 * the roadmap itself (14.6.1 session creation, 14.6.2 participant
 * join/leave, 14.6.3 access/authorization, 14.6.4 termination) — so
 * this log is intentionally broader: it records every session-level
 * event, not only denied/bypassed access, mirroring
 * `SensitiveRecordAccessLog` (BET-07) more closely than
 * `MessagingAccessLog`.
 *
 * `VideoSession.history` (on the session document itself) already
 * captures the state-machine transitions for display in the product
 * UI; this collection is the separate, append-only compliance record
 * — same split BET-03 established between `User`/session data and
 * `SecurityEvent`.
 */
export const VIDEO_AUDIT_ACTIONS = Object.freeze([
  'SESSION_CREATED',
  'JOIN_ALLOWED',
  'JOIN_DENIED',
  'PARTICIPANT_JOINED',
  'PARTICIPANT_LEFT',
  'SESSION_STARTED',
  'SESSION_ENDED',
  'SESSION_EXPIRED',
  'SESSION_CANCELLED',
  'CONSENT_RECORDED',
  'ACCESS_DENIED',
  'SIGNALING_REJECTED',
]);

export const VIDEO_AUDIT_OUTCOMES = Object.freeze(['ALLOWED', 'DENIED', 'INFO']);

const videoSessionAuditLogSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoSession', default: null, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },

    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },

    action: { type: String, enum: VIDEO_AUDIT_ACTIONS, required: true },
    outcome: { type: String, enum: VIDEO_AUDIT_OUTCOMES, required: true },
    denialReason: { type: String, default: null },

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

videoSessionAuditLogSchema.index({ session: 1, createdAt: -1 });
videoSessionAuditLogSchema.index({ actor: 1, createdAt: -1 });

export const VideoSessionAuditLog =
  mongoose.models.VideoSessionAuditLog ||
  mongoose.model('VideoSessionAuditLog', videoSessionAuditLogSchema);
