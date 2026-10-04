import mongoose from 'mongoose';

/**
 * BET-14 — Video Consultation (master prompt §32, roadmap BET-14.1–14.8).
 *
 * One `VideoSession` = one appointment's video-consultation lifecycle,
 * the same "one record per appointment, ever" shape `QueueEntry`
 * (BET-10) already established — `appointment` is required and
 * unique, so an appointment can never accumulate two competing
 * sessions. If a video appointment is rescheduled, BET-10's existing
 * reschedule-via-new-document behavior naturally produces a new
 * `Appointment` id, and a fresh `VideoSession` is created against
 * that new id the first time either party creates/joins it — no
 * change to `appointment.service.js` was needed for this (see
 * `video-session.service.js`'s docstring for why the appointment's
 * *current* status/mode is instead re-checked lazily, on every read,
 * rather than this module hooking into BET-10's cancel/reschedule
 * write path).
 *
 * `status` is a state machine enforced in `video-session.service.js`
 * (the model stays a plain data container, matching the established
 * convention from `encounter.model.js`/`appointment.model.js`/
 * `queue-entry.model.js`), with every transition appended to the
 * immutable `history` array — master prompt §50/§84, clinical/
 * operational history must never be silently overwritten.
 */

export const VIDEO_SESSION_STATUSES = Object.freeze([
  'CREATED', // session record exists; nobody has joined yet
  'WAITING', // exactly one party is currently connected, waiting for the other
  'ACTIVE', // both patient and doctor are currently connected
  'ENDED', // consultation finished (explicitly ended by doctor/admin-tier)
  'CANCELLED', // the underlying appointment became CANCELLED/RESCHEDULED/NO_SHOW before use
  'EXPIRED', // nobody joined before the waiting-room window elapsed
]);

export const ACTIVE_VIDEO_SESSION_STATUSES = Object.freeze(['CREATED', 'WAITING', 'ACTIVE']);
export const TERMINAL_VIDEO_SESSION_STATUSES = Object.freeze(['ENDED', 'CANCELLED', 'EXPIRED']);

export const VIDEO_PARTICIPANT_ROLES = Object.freeze(['DOCTOR', 'PATIENT']);

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, maxlength: 60 },
    fromStatus: { type: String, enum: [...VIDEO_SESSION_STATUSES, null], default: null },
    toStatus: { type: String, enum: VIDEO_SESSION_STATUSES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

/**
 * A join credential is issued fresh on every authorized `POST
 * /:id/join` call (master prompt BET-14.5.2 "secure meeting
 * tokens/credentials") — only its SHA-256 hash is ever persisted
 * (same convention as password-reset/email-verification tokens in
 * `security/tokens.js`), single-use, short-TTL, and specific to one
 * participant. The socket layer (`socket/index.js`'s `video:join`
 * handler) must present the matching plaintext token before it is
 * allowed to join the signaling room, on top of the socket already
 * being authenticated with the same JWT the REST API uses — this is
 * deliberate defense-in-depth, not the only guard.
 */
const joinCredentialSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },
  },
  { _id: false },
);

const participantEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: VIDEO_PARTICIPANT_ROLES, required: true },

    // REST-layer presence — the authoritative source for session
    // `status` transitions (see `video-session.service.js`).
    // `leftAt` is cleared back to `null` on every fresh join.
    joinedAt: { type: Date, default: null },
    leftAt: { type: Date, default: null },

    joinCredential: { type: joinCredentialSchema, default: () => ({}) },

    // Best-effort, informational only (master prompt §45 — audit
    // events should record device/session information where
    // appropriate). Never used for any authorization decision.
    lastIpAddress: { type: String, default: null },
    lastUserAgent: { type: String, default: null },
  },
  { _id: true },
);

const videoSessionSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
    },

    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Which `VideoProvider` implementation created/owns this room
    // (master prompt §32 — provider abstraction so the concrete
    // video vendor can change later without a data-model rewrite).
    provider: { type: String, required: true, default: 'native' },

    // Opaque, unguessable room identifier used as the Socket.IO room
    // name (`video:<roomId>`) — deliberately never the appointment id
    // or session `_id` itself, so a leaked/logged appointment
    // reference can never be used to derive a joinable room (master
    // prompt §80 — never trust/expose a client-derivable id as an
    // authorization boundary).
    roomId: { type: String, required: true, unique: true },

    status: { type: String, enum: VIDEO_SESSION_STATUSES, default: 'CREATED', index: true },

    participants: { type: [participantEntrySchema], default: [] },

    // Copied from the appointment at creation time so the waiting-
    // room expiry window can be computed without a re-populate on
    // every read.
    scheduledStart: { type: Date, required: true },

    // Waiting-room/session expiry (BET-14.4.6 "expired/invalid
    // session handling") — beyond this, joining is refused and the
    // session is lazily flipped to EXPIRED the next time it's read,
    // the same "computed on demand" convention `availability.service.js`
    // (BET-10) already established for appointment slots, rather than
    // depending on a cron job (this project has no job runner yet —
    // `jobs/` is empty, reserved for a later BET).
    expiresAt: { type: Date, required: true },

    maxDurationMinutes: { type: Number, required: true },

    startedAt: { type: Date, default: null }, // when ACTIVE was first reached
    endedAt: { type: Date, default: null },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    endReason: { type: String, trim: true, maxlength: 500, default: '' },

    // Digital consent (master prompt §96) — recorded only for the
    // patient side; the doctor's participation is itself the
    // clinical/professional consent equivalent and is not separately
    // captured here.
    consent: {
      patientConsented: { type: Boolean, default: false },
      consentedAt: { type: Date, default: null },
    },

    // Deliberately always `false` and never toggled by any code path
    // in this task — master prompt §32: "Do not record consultations
    // unless explicitly designed, consented, legally appropriate, and
    // securely implemented." No recording pipeline exists yet; a
    // future, separate task would need its own consent/legal/secure-
    // storage design rather than this field being flipped on here.
    recordingEnabled: { type: Boolean, default: false },

    history: { type: [historyEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

videoSessionSchema.index({ doctor: 1, status: 1 });
videoSessionSchema.index({ patient: 1, status: 1 });
videoSessionSchema.index({ expiresAt: 1, status: 1 });

export const VideoSession = mongoose.model('VideoSession', videoSessionSchema, 'video_sessions');
