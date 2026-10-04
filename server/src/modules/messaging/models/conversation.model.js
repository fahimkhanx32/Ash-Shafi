import mongoose from 'mongoose';

/**
 * BET-13 — Secure patient-doctor messaging (master prompt §29/§30).
 *
 * One `Conversation` = one patient-doctor pair (a WhatsApp-style 1:1
 * channel, not a multi-party thread — master prompt §29's chat
 * architecture is explicitly `Patient -> ... -> Conversation ->
 * Message`, singular). `patient`/`doctor` are the only two possible
 * participants; membership is fixed at creation and never changes,
 * so "is this user a participant" is always a cheap equality check
 * rather than an array scan (`modules/messaging/services/
 * conversation-access.service.js`).
 *
 * `patientProfile` is stored (not just derived by looking up
 * `PatientProfile.findOne({ user: patient })`) so the provider-based
 * access pattern this module reuses from BET-07/BET-12
 * (`patientProfile.primaryCareProvider`) never needs an extra query
 * at authorization time, and so a future admin filter
 * (`GET /conversations?patientProfileId=`) can index directly on it.
 *
 * A unique compound index on {patient, doctor} makes conversation
 * creation naturally idempotent — `findOrCreateConversation()`
 * (`conversation.service.js`) relies on this to never create a
 * second thread for the same pair, mirroring how `PatientProfile`
 * enforces one profile per `user` at the database level (BET-06).
 */
export const CONVERSATION_STATUSES = Object.freeze(['ACTIVE', 'ARCHIVED']);

const conversationSchema = new mongoose.Schema(
  {
    patientProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: true,
      index: true,
    },

    // Denormalized from patientProfile.user at creation time —
    // never re-derived on every message send, since a PatientProfile
    // is never reassigned to a different user account.
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: CONVERSATION_STATUSES,
      default: 'ACTIVE',
    },

    // Denormalized summary fields, updated by message.service.js on
    // every send — lets the conversation list be rendered without a
    // second query per conversation. Deliberately no message-content
    // preview is stored here (master prompt §16/§85 — do not scatter
    // potentially clinical message content into a second, less
    // tightly-scoped collection); the client fetches the actual last
    // message via the messages endpoint if it wants to show one.
    lastMessageAt: {
      type: Date,
      default: null,
    },

    lastMessageSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Unread counters, one per side — incremented for the recipient
    // on every send, reset to 0 when that side calls
    // `markConversationRead`. Keeping this on the conversation
    // document (rather than COUNT()-ing unread messages on every
    // list request) keeps `GET /conversations/me` a single indexed
    // query even as message history grows long (master prompt §64 —
    // pagination/performance).
    unreadCount: {
      patient: { type: Number, default: 0, min: 0 },
      doctor: { type: Number, default: 0, min: 0 },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

conversationSchema.index({ patient: 1, doctor: 1 }, { unique: true });
conversationSchema.index({ doctor: 1, lastMessageAt: -1 });
conversationSchema.index({ patient: 1, lastMessageAt: -1 });

export const Conversation =
  mongoose.models.Conversation ||
  mongoose.model('Conversation', conversationSchema);
