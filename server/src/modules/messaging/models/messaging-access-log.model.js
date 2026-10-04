import mongoose from 'mongoose';

/**
 * BET-13 — Messaging Privacy / Chat Access Audit (master prompt §30/§45).
 *
 * Deliberately narrower in scope than BET-07's
 * `SensitiveRecordAccessLog` (which logs *every* read/write): logging
 * every ordinary message-list poll from the two actual participants
 * would be pure volume with no protective value — a patient reading
 * their own conversation is not a privacy event. What master prompt
 * §30 actually calls for ("no patient can see another patient's
 * conversation... every message request must verify conversation
 * membership") is enforced by simply rejecting non-participants
 * outright (404, see `conversation-access.service.js`) — there is
 * nothing to audit about a rejection that never reveals anything.
 *
 * The one access pattern that genuinely needs an audit trail is the
 * admin-tier exemption this module reuses from the BET-07/BET-12
 * pattern: `SOFTWARE_OWNER`/`SUPER_ADMIN`/`DIRECTOR` can read a
 * conversation they are not a participant in (for support/oversight),
 * and that bypass — allowed or denied — is exactly the kind of
 * access a future compliance review needs to be able to reconstruct.
 */
const messagingAccessLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },

    action: {
      type: String,
      enum: ['VIEW', 'WRITE'],
      required: true,
    },

    outcome: {
      type: String,
      enum: ['ALLOWED', 'DENIED'],
      required: true,
    },

    denialReason: {
      type: String,
      default: null,
    },

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

messagingAccessLogSchema.index({ conversation: 1, createdAt: -1 });
messagingAccessLogSchema.index({ actor: 1, createdAt: -1 });

export const MessagingAccessLog =
  mongoose.models.MessagingAccessLog ||
  mongoose.model('MessagingAccessLog', messagingAccessLogSchema);
