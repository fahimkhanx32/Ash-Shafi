import mongoose from 'mongoose';

/**
 * BET-13 — Messages, Attachments & Voice Messages.
 *
 * One collection, one timeline — a voice message is a `Message` with
 * `messageType: 'VOICE'` and a populated `attachment`, not a separate
 * collection. The master prompt lists "Voice" (§31) as its own
 * roadmap section, but architecturally a voice note behaves exactly
 * like an image/document attachment (same upload/storage/authz/
 * lifecycle shape) except it also carries a duration and a stricter
 * size/duration cap (`env.messaging.maxVoiceMessageSizeMb/
 * maxVoiceMessageDurationSeconds`, enforced in
 * `routes/conversation.routes.js`, not here) — forking a second
 * collection would only duplicate the conversation-membership/
 * read-status/history logic below for no real gain, and would break
 * "message history" (the roadmap's own wording) into two interleaved
 * timelines the client would have to merge itself.
 *
 * Attachments reuse the exact Cloudinary authenticated-upload pattern
 * BET-12's `report-storage.service.js` established (never public,
 * only ever served through a short-lived server-minted signed URL —
 * see `services/message-storage.service.js`), rather than a new
 * storage design.
 */
export const MESSAGE_TYPES = Object.freeze([
  'TEXT',
  'IMAGE',
  'DOCUMENT',
  'VOICE',
  'REPORT_NOTICE',
]);

/**
 * The subset a client may send through the messages API. `REPORT_NOTICE`
 * is written only by the server (report intake) — it must never be
 * accepted from a request body, or any participant could forge a
 * "X has uploaded a report" notice.
 */
export const CLIENT_MESSAGE_TYPES = Object.freeze(['TEXT', 'IMAGE', 'DOCUMENT', 'VOICE']);

const attachmentSchema = new mongoose.Schema(
  {
    cloudinaryPublicId: { type: String, required: true },
    cloudinaryResourceType: { type: String, required: true },
    mimeType: { type: String, required: true },
    // Original filename is sanitized (never trusted verbatim) before
    // storage — see security/file-security.js#sanitizeFilename,
    // reused by message-storage.service.js — and kept only for
    // display; the actual stored object uses a randomly generated
    // name (generateStorageFilename), never the client-supplied one.
    originalFilename: { type: String, default: '', maxlength: 255 },
    sizeBytes: { type: Number, required: true, min: 0 },
    // Voice messages only. Client-reported at upload time (there is
    // no reliable server-side way to measure audio duration without
    // decoding the file) — validated against
    // env.messaging.maxVoiceMessageDurationSeconds at the route
    // layer, but still an untrusted, informational value, never used
    // for anything security-relevant.
    durationSeconds: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The other participant at send time — denormalized from the
    // conversation so `markConversationRead` can do a single
    // `updateMany({ conversation, recipient: actorId, readAt: null })`
    // without re-deriving "who is the other side" per message.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    messageType: {
      type: String,
      enum: MESSAGE_TYPES,
      required: true,
    },

    // Required for TEXT; optional caption text is allowed alongside
    // an attachment (IMAGE/DOCUMENT/VOICE) but never required —
    // enforced in validators/message.validation.js, not here, since
    // Mongoose conditional-required based on a sibling field is
    // awkward and the validator layer is the existing convention for
    // this project's cross-field rules (see e.g.
    // `prescription.validation.js`).
    content: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
    },

    attachment: {
      type: attachmentSchema,
      default: null,
    },

    // Set only on `REPORT_NOTICE` messages: the report this notice is
    // about. The notice text itself never carries report contents, and
    // opening the report still goes through the normal report access
    // checks — this is a pointer, not a grant.
    relatedReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalReport',
      default: null,
    },

    // Single-recipient read receipt (WhatsApp-style double-tick) —
    // a conversation has exactly one other participant, so there is
    // never more than one person who could mark this read.
    readAt: {
      type: Date,
      default: null,
    },

    // Soft-delete only (master prompt §84 — never destroy history
    // outright). `content`/`attachment` are cleared on deletion (and
    // the underlying Cloudinary object is removed — see
    // `message.service.js#deleteMessage`) so a deleted message's
    // actual content is genuinely gone, but the row itself, its
    // timestamp, and who sent/deleted it remain in the timeline as a
    // "this message was deleted" placeholder — the same
    // amend-don't-erase shape as `Encounter`'s finalize/amend split.
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, readAt: 1 });

export const Message =
  mongoose.models.Message || mongoose.model('Message', messageSchema);
