import mongoose from 'mongoose';

/**
 * Authentication/account security event log (BET-03).
 *
 * This is scoped specifically to authentication and account-security
 * events (login, lockout, password/session lifecycle). It is
 * intentionally separate from the broader resource-level audit trail
 * (patient access, clinical record changes, exports, etc.) that
 * belongs to BET-17, whose `audit/audit.model.js` remains reserved
 * for that later, wider-scoped task.
 */

export const SECURITY_EVENT_TYPES = Object.freeze({
  REGISTERED: 'REGISTERED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  LOGOUT: 'LOGOUT',
  LOGOUT_ALL: 'LOGOUT_ALL',
  SESSION_REVOKED: 'SESSION_REVOKED',
  REFRESH_TOKEN_ROTATED: 'REFRESH_TOKEN_ROTATED',
  REFRESH_TOKEN_REUSE_DETECTED: 'REFRESH_TOKEN_REUSE_DETECTED',
  EMAIL_VERIFICATION_REQUESTED: 'EMAIL_VERIFICATION_REQUESTED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',

  // --- FET-20 prerequisite backend — Security Administration ---
  // An administrator acting on *another* user's session/account
  // security state. Deliberately distinct from `SESSION_REVOKED`
  // above (which fires for a user revoking their own session) so a
  // caller's own history never shows an admin action as if they'd
  // done it themselves, and so `modules/security-admin`'s alert/
  // dashboard queries can tell the two apart without inspecting
  // `metadata`.
  SESSION_REVOKED_BY_ADMIN: 'SESSION_REVOKED_BY_ADMIN',
  ACCOUNT_UNLOCKED_BY_ADMIN: 'ACCOUNT_UNLOCKED_BY_ADMIN',
});

const securityEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(SECURITY_EVENT_TYPES),
      required: true,
      index: true,
    },

    ipAddress: {
      type: String,
      default: null,
      maxlength: 100,
    },

    userAgent: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

securityEventSchema.index({ createdAt: -1 });
securityEventSchema.index({ userId: 1, createdAt: -1 });

export const SecurityEvent = mongoose.model(
  'SecurityEvent',
  securityEventSchema,
  'security_events',
);
