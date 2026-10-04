import mongoose from 'mongoose';

import { ROLES } from '../security/permissions.js';

const USER_ROLES = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.ADMIN,
  ROLES.DOCTOR,
  ROLES.STAFF,
  ROLES.RECEPTIONIST,
  ROLES.PATIENT,
];

const USER_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
];

/**
 * Symbol used to explicitly bypass protected-account guards below.
 * Only a future, dedicated, audited, MFA-gated privileged operation
 * (e.g. an emergency ownership transfer flow) is permitted to use
 * this. It must never be used by ordinary CRUD/update paths.
 */
const PROTECTED_MUTATION_BYPASS = Symbol('protectedMutationBypass');

const GUARDED_PROTECTED_FIELDS = ['role', 'status', 'isProtected'];

/**
 * FET-03 — per-user theme/accessibility/wallpaper preferences (master
 * prompt §7/§8). Deliberately narrow for now: `wallpaper.type` is
 * `BUILT_IN`-only — custom wallpaper *upload* needs the file-handling
 * pipeline (validation, optimization, secure storage) that BET-12
 * builds, which doesn't exist yet in this session; adding an upload
 * field here without that backing would be exactly the kind of fake
 * functionality master prompt §79 rules out. Extending `wallpaper` to
 * `CUSTOM` is an additive, non-breaking follow-up once BET-12 ships.
 */
const uiPreferencesSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['LIGHT', 'DARK', 'SYSTEM'], default: 'SYSTEM' },
    // i18n gap-closure pass: app-wide language, same persistence tier
    // as every other uiPreferences field (client state -> localStorage
    // -> this field, PATCH /auth/me/preferences). EN/BN only
    // (Multilingual UI & Localization). Adding a language is a
    // client-side locale-file change plus appending its code here.
    language: { type: String, enum: ['EN', 'BN'], default: 'EN' },
    colorTheme: {
      type: String,
      enum: ['TEAL', 'ROSE', 'VIOLET', 'SLATE'],
      default: 'TEAL',
    },
    // Text-color contrast fix follow-up: a *separate* knob from
    // `colorTheme` (which only recolors primary/accent) — this picks
    // the hue of ordinary body text itself (`--foreground`/
    // `--card-foreground`/`--secondary-foreground`). Deliberately a
    // closed enum of curated light/dark HSL *pairs*
    // (`client/web/src/index.css`'s `[data-text-color]` rules), never
    // a free-form hex value — an arbitrary color a user picks in one
    // mode has no guarantee of staying readable after `mode` flips to
    // the other, which is exactly the class of bug this preference
    // exists to let people choose around, not reintroduce.
    textColor: {
      type: String,
      enum: ['DEFAULT', 'CHARCOAL', 'NAVY', 'FOREST', 'PLUM'],
      default: 'DEFAULT',
    },
    typographyScale: {
      type: String,
      enum: ['SM', 'MD', 'LG', 'XL'],
      default: 'MD',
    },
    uiZoomPercent: { type: Number, min: 90, max: 150, default: 100 },
    reducedMotion: { type: Boolean, default: false },
    highContrast: { type: Boolean, default: false },
    wallpaper: {
      type: { type: String, enum: ['NONE', 'BUILT_IN'], default: 'NONE' },
      value: { type: String, default: null, maxlength: 100 },
    },
    // FET-18 — Text-to-Speech & Accessibility Interaction. Same
    // persistence tier as every other field in this subdocument
    // (client state -> localStorage -> here via
    // PATCH /auth/me/preferences). `voiceName` is the browser
    // SpeechSynthesisVoice's own `.name` string when the user picks
    // a specific installed voice in Settings; null means "Auto" —
    // let the client pick the best voice for the active language at
    // speak-time (voice availability is a browser/OS property, not
    // something meaningful to validate server-side).
    speech: {
      enabled: { type: Boolean, default: true },
      rate: { type: Number, min: 0.5, max: 2, default: 1 },
      pitch: { type: Number, min: 0, max: 2, default: 1 },
      volume: { type: Number, min: 0, max: 1, default: 1 },
      voiceName: { type: String, default: null, maxlength: 200 },
    },
    // ElevenLabs voice agent — user-owned assistant persona name
    // (master naming prompt §1/§2). Same persistence tier as every
    // other uiPreferences field: client state -> localStorage cache
    // -> PATCH /auth/me/preferences -> here. Deliberately just the
    // display name for now (§9: "implement at minimum { assistantName
    // }") — NOT the ElevenLabs Agent ID (§13), which stays a single
    // server-side env value (ELEVENLABS_AGENT_ID) shared by all users;
    // this field is only the runtime dynamic-variable/personalization
    // value passed into that one shared agent's session.
    voiceAssistant: {
      assistantName: {
        type: String,
        trim: true,
        maxlength: 50,
        default: 'Ash-Shāfī Assistant',
      },
    },
  },
  { _id: false },
);

/**
 * BET-13 — per-user notification channel preferences (master prompt
 * §43/§85). In-app is always effectively "on" (there is no reason to
 * let a user disable seeing their own in-app notification list), so
 * only the three opt-in outbound channels are toggleable here.
 * Deliberately a single flat set of toggles rather than per-category
 * (messages vs. system, etc.) — BET-13 only has one real notification
 * category (`MESSAGE_RECEIVED`) plus a generic `SYSTEM` broadcast
 * type; splitting preferences per category before a second real
 * category exists would be speculative. Extending this to
 * per-category toggles later is additive, not breaking.
 */
const notificationPreferencesSchema = new mongoose.Schema(
  {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    email: {
      type: String,
      unique: true,
      sparse: true, // required=false now (self-registration made email
      // optional — phone is the required contact field instead), so
      // this can no longer be a plain unique index: multiple users
      // with no email would collide on a non-sparse one. `sparse`
      // excludes documents that don't have the field at all, while
      // still enforcing uniqueness among the ones that do.
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    // Required at self-registration (see auth.validation.js's
    // registerSchema) — not required here at the model level so
    // admin-created staff/doctor/admin accounts (POST /users, which
    // never collects this) don't start failing to save.
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    // Self-service profile picture, stored as a small (client-resized)
    // image data URL so it travels with the user object everywhere the
    // avatar is shown. Validated in auth.validation.js (type + size).
    profileImage: {
      type: String,
      default: null,
      maxlength: 200000,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      default: ROLES.PATIENT,
    },

    status: {
      type: String,
      enum: USER_STATUSES,
      required: true,
      default: 'ACTIVE',
    },

    /**
     * Marks a permanent, system-protected account (the Owner and the
     * Director accounts). Protected accounts cannot have their role,
     * status, or protection flag changed or be deleted through
     * ordinary CRUD — see the pre-hooks below. See master prompt
     * section 10 ("Protected Account Rule").
     */
    isProtected: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetAttempts: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    /**
     * BET-17 Checkpoint 3 — Account Lifecycle (master prompt §38).
     * Mirrors the current `AccountDeletionRequest`'s status onto the
     * `User` document itself so auth/login and everyday reads never
     * need a second query to know whether an account has a deletion
     * request in flight or has already been anonymized — the
     * `AccountDeletionRequest` collection remains the authoritative,
     * append-only history/audit trail; these three fields are a
     * read-optimized projection of its current state, always written
     * by the same service call that mutates the request, never
     * independently.
     */
    deletionRequestStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'ANONYMIZED'],
      default: 'NONE',
    },

    deletionRequestedAt: {
      type: Date,
      default: null,
    },

    // Set once (and only once) the account is actually anonymized —
    // never merely "requested". A non-null value here means the
    // account is closed and its PII has been scrubbed per master
    // prompt §38's "deactivation/anonymization according to policy"
    // step; it is never cleared back to null by ordinary CRUD.
    anonymizedAt: {
      type: Date,
      default: null,
    },

    // Soft-deletion tracking (two-tier deletion: soft vs. permanent)
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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

    uiPreferences: {
      type: uiPreferencesSchema,
      default: () => ({}),
    },

    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({
  role: 1,
  status: 1,
});

userSchema.index({
  passwordResetTokenHash: 1,
});

userSchema.index({
  emailVerificationTokenHash: 1,
});

/**
 * PROTECTED ACCOUNT ENFORCEMENT
 * =============================
 * These hooks are the backend-authoritative guard described in
 * master prompt section 10 and section 80 ("no fake security" —
 * never rely on hidden buttons or frontend role checks). They apply
 * regardless of which controller/service calls into Mongoose, so
 * future BET-05 user-management endpoints inherit this protection
 * automatically instead of having to remember to re-implement it.
 */

userSchema.statics.PROTECTED_BYPASS = PROTECTED_MUTATION_BYPASS;

// Document-level guard for `doc.save()` after mutation.
userSchema.pre('save', function guardProtectedSave(next) {
  if (this.isNew) {
    return next();
  }

  if (!this.isProtected) {
    return next();
  }

  if (this.$locals?.protectedBypass === PROTECTED_MUTATION_BYPASS) {
    return next();
  }

  const mutatedGuardedFields = GUARDED_PROTECTED_FIELDS.filter((field) =>
    this.isModified(field),
  );

  if (mutatedGuardedFields.length > 0) {
    return next(
      new Error(
        `Protected account fields cannot be modified through ordinary operations: ${mutatedGuardedFields.join(', ')}`,
      ),
    );
  }

  return next();
});

// Document-level guard for `doc.deleteOne()`.
userSchema.pre(
  'deleteOne',
  { document: true, query: false },
  function guardProtectedDocDelete(next) {
    if (this.isProtected) {
      return next(new Error('Protected accounts cannot be deleted.'));
    }

    return next();
  },
);

// Query-level guard for `User.deleteOne(filter)` and
// `User.findOneAndDelete(filter)`.
userSchema.pre(
  ['deleteOne', 'findOneAndDelete'],
  { document: false, query: true },
  async function guardProtectedQueryDelete(next) {
    const target = await this.model
      .findOne(this.getFilter())
      .select('isProtected')
      .lean();

    if (target?.isProtected) {
      return next(new Error('Protected accounts cannot be deleted.'));
    }

    return next();
  },
);

// Bulk-deletion guard: silently excludes protected accounts from any
// `User.deleteMany(...)` instead of allowing them to be swept up
// accidentally (see master prompt: "Protected accounts cannot
// accidentally be deleted through bulk deletion.").
userSchema.pre('deleteMany', function guardProtectedBulkDelete(next) {
  const filter = this.getFilter();

  this.setQuery({
    ...filter,
    isProtected: { $ne: true },
  });

  return next();
});

// Query-level guard for `User.findOneAndUpdate(...)`, which is the
// typical shape of an admin "edit user" endpoint.
userSchema.pre(
  'findOneAndUpdate',
  async function guardProtectedUpdate(next) {
    const update = this.getUpdate() || {};
    const setPart = { ...(update.$set || {}), ...update };

    const attemptsGuardedChange = GUARDED_PROTECTED_FIELDS.some((field) =>
      Object.prototype.hasOwnProperty.call(setPart, field),
    );

    if (!attemptsGuardedChange) {
      return next();
    }

    const target = await this.model
      .findOne(this.getFilter())
      .select('isProtected')
      .lean();

    if (target?.isProtected) {
      return next(
        new Error(
          'Protected account fields cannot be modified through ordinary operations.',
        ),
      );
    }

    return next();
  },
);

export const User = mongoose.model('User', userSchema, 'users');

export { USER_ROLES, USER_STATUSES, PROTECTED_MUTATION_BYPASS };
