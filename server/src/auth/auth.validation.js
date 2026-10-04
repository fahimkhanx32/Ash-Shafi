import Joi from 'joi';

/**
 * Joi request-validation schemas for the auth module (BET-03).
 *
 * Follows the existing `validate(schema, source)` middleware
 * convention already established in `middlewares/validation.middleware.js`.
 */

// Deliberately simple: at least 8 characters, nothing else required.
// Was previously an uppercase+lowercase+digit complexity pattern —
// relaxed per product decision that most patients won't set a
// "strong" password by that definition, and a length-only floor is
// still a real (if modest) improvement over no rule at all. Applies
// app-wide (registration, change-password, reset-password all share
// this), not just the registration form, so the same password that
// passes signup can't then get rejected on a password change.
export const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters.',
  });

// Shared by registration (the user chooses their username) and the
// self-service "change my username" endpoint below. Any simple
// username: letters of either case, digits, dots, underscores,
// hyphens; no spaces/symbols. Storage still normalizes to lowercase
// (auth.service.js's `normalizeIdentifier`), so case never affects
// uniqueness or login.
const usernamePattern = /^[A-Za-z0-9_.-]+$/;
const usernameFieldSchema = Joi.string()
  .trim()
  .min(3)
  .max(50)
  .pattern(usernamePattern)
  // At least one letter, so a username can never look like a phone number
  // (phone numbers are also valid sign-in identifiers).
  .pattern(/[A-Za-z]/, 'letter')
  .messages({
    'string.pattern.base':
      'Username may only contain letters, numbers, dots, underscores, and hyphens.',
    'string.pattern.name': 'Username must include at least one letter.',
  });

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  username: usernameFieldSchema.required(),
  // Optional now — phone is the required contact field instead (see
  // below). `allow('', null)` so an empty string from a form that
  // always sends the key doesn't fail validation before reaching the
  // service layer, which treats '' the same as not-provided.
  email: Joi.string().trim().lowercase().email().optional().allow('', null),
  phone: Joi.string().trim().min(6).max(30).required(),
  password: passwordSchema,
});

export const updateUsernameSchema = Joi.object({
  username: usernameFieldSchema.required(),
});

export const updateEmailSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(254).required(),
  currentPassword: Joi.string().required(),
});

// Data URL of a small raster image (the client resizes to <=256px JPEG).
// ~150k chars ≈ 110 KB binary; SVG is excluded on purpose (script risk).
export const updateProfileImageSchema = Joi.object({
  profileImage: Joi.alternatives()
    .try(
      Joi.string()
        .max(150000)
        .pattern(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
      Joi.valid(null),
    )
    .required(),
});

export const loginSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(254).required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(254).required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export const resendVerificationSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(254).required(),
});

export const revokeSessionParamsSchema = Joi.object({
  sessionId: Joi.string().hex().length(24).required(),
});

// FET-03 — self-service theme/accessibility/wallpaper preferences.
// Mirrors `users/user.model.js`'s `uiPreferencesSchema` enums exactly.
export const updatePreferencesSchema = Joi.object({
  mode: Joi.string().valid('LIGHT', 'DARK', 'SYSTEM'),
  language: Joi.string().valid('EN', 'BN'), // FET-17
  colorTheme: Joi.string().valid('TEAL', 'ROSE', 'VIOLET', 'SLATE'),
  textColor: Joi.string().valid('DEFAULT', 'CHARCOAL', 'NAVY', 'FOREST', 'PLUM'),
  typographyScale: Joi.string().valid('SM', 'MD', 'LG', 'XL'),
  uiZoomPercent: Joi.number().integer().min(90).max(150),
  reducedMotion: Joi.boolean(),
  highContrast: Joi.boolean(),
  wallpaper: Joi.object({
    type: Joi.string().valid('NONE', 'BUILT_IN').required(),
    value: Joi.string().trim().max(100).allow(null),
  }),
  // FET-18 — mirrors `users/user.model.js`'s `speech` subdocument exactly.
  speech: Joi.object({
    enabled: Joi.boolean(),
    rate: Joi.number().min(0.5).max(2),
    pitch: Joi.number().min(0).max(2),
    volume: Joi.number().min(0).max(1),
    voiceName: Joi.string().trim().max(200).allow(null),
  }),
  // ElevenLabs voice agent persona name (naming spec §10). No control
  // characters and no `<`/`>` (blocks HTML/script injection without
  // over-restricting normal names like "Dr. AI" or "Ash-Shāfī").
  voiceAssistant: Joi.object({
    assistantName: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .pattern(/^[^\x00-\x1F\x7F<>]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Assistant name contains characters that are not allowed.',
      }),
  }),
}).min(1);
