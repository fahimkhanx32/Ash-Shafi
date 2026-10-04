import { z } from 'zod';

/**
 * Mirrors server/src/auth/auth.validation.js exactly (same pattern,
 * same limits, same field names) so a form only ever fails client-side
 * for a reason the backend would also reject it for. The backend
 * remains authoritative — these are UX-only, not a security boundary.
 *
 * FET-17 — "Localized validation messages": every schema below is now
 * a factory (`buildXSchema(t)`) instead of a pre-built object, so the
 * message strings resolve through `validation.auth.*` in the caller's
 * active language. Same optional-`t`-with-English-fallback pattern
 * `constants/billing.js`'s label helpers already established — a
 * caller that doesn't pass `t` (or passes a `t` that's missing a key)
 * still gets the exact original English string, so nothing regresses
 * for a call site that hasn't been updated yet.
 */
const msg = (t, key, fallback) => (typeof t === 'function' ? t(key, fallback) : fallback);

// Deliberately simple: at least 8 characters, nothing else required —
// mirrors the backend's own passwordSchema (auth.validation.js),
// which was relaxed for the same reason (most patients won't set a
// password meeting an upper+lower+digit complexity rule, and a
// length-only floor is still a real improvement over nothing).
const buildPasswordField = (t) =>
  z
    .string()
    .min(8, msg(t, 'validation.auth.passwordStrength', 'Password must be at least 8 characters.'));

export const buildLoginSchema = (t) =>
  z.object({
    identifier: z
      .string()
      .trim()
      .min(3, msg(t, 'validation.auth.identifierRequired', 'Enter your username, email or phone'))
      .max(254),
    password: z.string().min(1, msg(t, 'validation.auth.passwordRequired', 'Password is required')),
    rememberMe: z.boolean().optional(),
  });

export const buildRegisterSchema = (t) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(2, msg(t, 'validation.auth.nameRequired', 'Enter your full name'))
      .max(120),
    // Optional — phone is the required contact field instead (see
    // below). `.or(z.literal(''))` so an empty field doesn't fail the
    // `.email()` format check the way a required field would.
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email(msg(t, 'validation.auth.emailInvalid', 'Enter a valid email address'))
      .optional()
      .or(z.literal('')),
    // The user chooses their own username. If it is already taken the
    // server answers 409 USERNAME_ALREADY_EXISTS and the form asks for
    // another. Same rules as `buildUsernameSchema` below.
    username: z
      .string()
      .trim()
      .min(3, msg(t, 'validation.auth.usernameMin', 'Username must be at least 3 characters'))
      .max(50)
      .regex(
        /^[A-Za-z0-9_.-]+$/,
        msg(t, 'validation.auth.usernamePattern', 'Letters, numbers, dots, underscores, and hyphens only'),
      )
      .regex(/[A-Za-z]/, msg(t, 'validation.auth.usernameLetter', 'Include at least one letter')),
    phone: z
      .string()
      .trim()
      .min(6, msg(t, 'validation.auth.phoneRequired', 'Enter your phone number'))
      .max(30),
    password: buildPasswordField(t),
  });

// Mirrors server/src/auth/auth.validation.js's `updateUsernameSchema`
// exactly (same pattern/limits) — used by the Settings "change
// username" form, the one place a username is now ever typed by a
// user (registration no longer collects one; see buildRegisterSchema
// above).
export const buildUsernameSchema = (t) =>
  z.object({
    username: z
      .string()
      .trim()
      .min(3, msg(t, 'validation.auth.usernameMin', 'Username must be at least 3 characters'))
      .max(50)
      .regex(
        /^[A-Za-z0-9_.-]+$/,
        msg(t, 'validation.auth.usernamePattern', 'Letters, numbers, dots, underscores, and hyphens only'),
      )
      .regex(/[A-Za-z]/, msg(t, 'validation.auth.usernameLetter', 'Include at least one letter')),
  });

export const buildForgotPasswordSchema = (t) =>
  z.object({
    identifier: z
      .string()
      .trim()
      .min(3, msg(t, 'validation.auth.identifierRequired', 'Enter your username, email or phone'))
      .max(254),
  });

export const buildResetPasswordSchema = (t) =>
  z
    .object({
      newPassword: buildPasswordField(t),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: msg(t, 'validation.auth.passwordsMismatch', "Passwords don't match"),
      path: ['confirmPassword'],
    });

// FET-04 — authenticated "change password" form. Mirrors
// server/src/auth/auth.validation.js's changePasswordSchema exactly
// (currentPassword required, newPassword must meet the same
// strength pattern). The "must differ from current" check has no
// backend equivalent — it's a harmless, purely client-side UX
// nicety, not a security boundary.
export const buildChangePasswordSchema = (t) =>
  z
    .object({
      currentPassword: z.string().min(1, msg(t, 'validation.auth.currentPasswordRequired', 'Enter your current password')),
      newPassword: buildPasswordField(t),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: msg(t, 'validation.auth.passwordsMismatch', "Passwords don't match"),
      path: ['confirmPassword'],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: msg(
        t,
        'validation.auth.newPasswordSameAsCurrent',
        'New password must be different from your current password',
      ),
      path: ['newPassword'],
    });
