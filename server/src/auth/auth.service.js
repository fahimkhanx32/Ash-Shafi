import { User } from '../users/user.model.js';
import { Session } from './session.model.js';
import { ROLES, isValidRole } from '../security/permissions.js';

import {
  verifyPassword,
  needsPasswordRehash,
  hashPassword,
} from '../security/password.js';

import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
} from '../security/tokens.js';

import env from '../config/env.js';
import { AppError } from '../middlewares/error.middleware.js';

import {
  recordSecurityEvent,
  listSecurityEventsForUser,
} from './security-event.service.js';
import { SECURITY_EVENT_TYPES } from './security-event.model.js';

import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountLockedEmail,
} from '../integrations/email/email.service.js';

const MAX_LOGIN_ATTEMPTS = env.security.maxLoginAttempts;
const LOCKOUT_MINUTES = env.security.loginLockoutMinutes;
const EMAIL_VERIFICATION_EXPIRES_MINUTES =
  env.verification.emailExpiresMinutes;
const PASSWORD_RESET_EXPIRES_MINUTES =
  env.verification.passwordResetExpiresMinutes;
const MAX_PASSWORD_RESET_ATTEMPTS =
  env.security.maxPasswordResetAttempts;

const normalizeIdentifier = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
};

// --- Usernames and phone numbers as sign-in identifiers ---------------
//
// A username is CHOSEN by the user at registration (no auto-generation,
// no name/phone-digit suffixes). If it is taken, registration is
// rejected with USERNAME_ALREADY_EXISTS and the user must pick another.
// A user can sign in with their username, email, or phone number.

// Phone numbers are stored as typed, so matching ignores spaces, dashes,
// brackets and a leading "+", and treats Bangladeshi local (01XXXXXXXXX)
// and international (8801XXXXXXXXX / +8801XXXXXXXXX) forms as the same.
const PHONE_SEPARATORS = '[\\s().-]*';

const phoneDigitForms = (value) => {
  const digits = (typeof value === 'string' ? value : '').replace(/\D+/g, '');
  if (digits.length < 6) return [];
  const forms = new Set([digits]);
  if (digits.startsWith('880') && digits.length === 13) forms.add(`0${digits.slice(3)}`);
  if (digits.startsWith('0') && digits.length === 11) forms.add(`88${digits}`);
  return [...forms];
};

const phoneMatchConditions = (value) =>
  phoneDigitForms(value).map((digits) => ({
    phone: new RegExp(`^\\+?${PHONE_SEPARATORS}${digits.split('').join(PHONE_SEPARATORS)}${PHONE_SEPARATORS}$`),
  }));

const looksLikePhone = (value) => /^\+?[\d\s().-]{6,}$/.test(value) && phoneDigitForms(value).length > 0;

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  username: user.username,
  profileImage: user.profileImage || null,
  role: user.role,
  status: user.status,
  isProtected: Boolean(user.isProtected),
  // BET-17 Checkpoint 3 — surface deletion-request state so the
  // frontend can show "deletion pending" UI without a second call;
  // `deletionRequestStatus: 'ANONYMIZED'` should never actually
  // reach a caller in practice (an anonymized account can no longer
  // authenticate — see `account-deletion.service.js`), included here
  // only for completeness/consistency with the field's own enum.
  deletionRequestStatus: user.deletionRequestStatus || 'NONE',
  deletionRequestedAt: user.deletionRequestedAt || null,
  emailVerifiedAt: user.emailVerifiedAt,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  uiPreferences: user.uiPreferences,
  // BET-13 — per-user notification channel preferences, so the
  // client can render/preselect the toggles in
  // `PATCH /notifications/me/preferences` without a second request.
  notificationPreferences: user.notificationPreferences,
});

const findUserByIdentifier = async (identifier, { withSecrets = false } = {}) => {
  const normalized = normalizeIdentifier(identifier);

  const build = (filter) => {
    const query = User.findOne(filter);
    return withSecrets ? query.select('+passwordHash') : query;
  };

  // 1) email or username.
  const direct = await build({ $or: [{ email: normalized }, { username: normalized }] });
  if (direct) return direct;

  // 2) phone number. Only when exactly ONE account has that number —
  //    never guess between accounts that share one.
  if (looksLikePhone(normalized)) {
    const conditions = phoneMatchConditions(normalized);
    const matches = await User.find({ $or: conditions }).select('_id').limit(2).lean();
    if (matches.length === 1) return build({ _id: matches[0]._id });
  }

  return null;
};

/**
 * ============================================================
 * REGISTRATION
 * ============================================================
 *
 * Self-service registration always creates a PATIENT account.
 * Staff/doctor/admin accounts are provisioned by an administrator
 * (BET-05), never through this public endpoint — the `role` field
 * is deliberately never accepted from the request body here, which
 * prevents a mass-assignment privilege-escalation vector (master
 * prompt section 80).
 */
export const register = async ({
  name,
  username,
  email,
  phone,
  password,
  ipAddress = null,
  userAgent = null,
}) => {
  const normalizedEmail = normalizeIdentifier(email);
  const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
  const normalizedUsername = normalizeIdentifier(username);

  if (await User.exists({ username: normalizedUsername })) {
    throw new AppError('That username is already taken. Please choose a different one.', 409, {
      code: 'USERNAME_ALREADY_EXISTS',
    });
  }

  if (normalizedEmail && (await User.exists({ email: normalizedEmail }))) {
    throw new AppError('An account with this email already exists.', 409, {
      code: 'EMAIL_ALREADY_EXISTS',
    });
  }

  // Phone is a sign-in identifier, so it must be unique too.
  const phoneConditions = phoneMatchConditions(trimmedPhone);
  if (phoneConditions.length && (await User.exists({ $or: phoneConditions }))) {
    throw new AppError('An account with this phone number already exists.', 409, {
      code: 'PHONE_ALREADY_EXISTS',
    });
  }

  const passwordHash = await hashPassword(password);

  // Email is now optional (phone is the required contact field) — the
  // verification-token fields and the email itself are only set when
  // one was actually provided. Deliberately NOT set to '' for a user
  // who skipped it: an empty string is still a value as far as the
  // schema's `sparse` unique index on `email` is concerned (see
  // user.model.js), so a second no-email user would collide with the
  // first. Leaving the key out entirely keeps them excluded from that
  // index, the way `sparse` is meant to be used.
  const verificationToken = normalizedEmail ? generateOpaqueToken() : null;

  const userData = {
    name: name.trim(),
    username: normalizedUsername,
    phone: trimmedPhone,
    passwordHash,
    role: ROLES.PATIENT,
    status: 'ACTIVE',
    passwordChangedAt: new Date(),
  };

  if (normalizedEmail) {
    userData.email = normalizedEmail;
    userData.emailVerificationTokenHash = hashToken(verificationToken);
    userData.emailVerificationExpiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRES_MINUTES * 60 * 1000,
    );
  }

  const user = await User.create(userData);

  if (normalizedEmail) {
    await sendVerificationEmail(user, verificationToken);
  }

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.REGISTERED,
    ipAddress,
    userAgent,
  });

  return { user: sanitizeUser(user) };
};

/**
 * ============================================================
 * LOGIN
 * ============================================================
 */
export const login = async ({
  identifier,
  password,
  ipAddress = null,
  userAgent = null,
}) => {
  if (
    normalizeIdentifier(identifier) === '' ||
    typeof password !== 'string'
  ) {
    throw new AppError('Username/email and password are required.', 400, {
      code: 'INVALID_LOGIN_INPUT',
    });
  }

  const user = await findUserByIdentifier(identifier, { withSecrets: true });

  if (!user) {
    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.LOGIN_FAILED,
      ipAddress,
      userAgent,
      metadata: { reason: 'ACCOUNT_NOT_FOUND', identifier: normalizeIdentifier(identifier) },
    });

    throw new AppError('Invalid username/email or password.', 401, {
      code: 'INVALID_CREDENTIALS',
    });
  }

  if (user.status !== 'ACTIVE') {
    await recordSecurityEvent({
      userId: user._id,
      type: SECURITY_EVENT_TYPES.LOGIN_FAILED,
      ipAddress,
      userAgent,
      metadata: { reason: 'ACCOUNT_NOT_ACTIVE' },
    });

    throw new AppError('This account is not active.', 403, {
      code: 'ACCOUNT_NOT_ACTIVE',
    });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordSecurityEvent({
      userId: user._id,
      type: SECURITY_EVENT_TYPES.LOGIN_FAILED,
      ipAddress,
      userAgent,
      metadata: { reason: 'ACCOUNT_LOCKED' },
    });

    throw new AppError(
      'Too many failed login attempts. Please try again later.',
      429,
      { code: 'ACCOUNT_TEMPORARILY_LOCKED' },
    );
  }

  // A lock that has run its course starts a fresh window: without this the
  // stale counter (>= MAX) made the first wrong password after expiry
  // re-lock the account immediately.
  if (user.lockedUntil && user.lockedUntil <= new Date()) {
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);

  if (!passwordValid) {
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;

    user.failedLoginAttempts = failedAttempts;

    let justLocked = false;

    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      justLocked = true;
    }

    await user.save();

    await recordSecurityEvent({
      userId: user._id,
      type: SECURITY_EVENT_TYPES.LOGIN_FAILED,
      ipAddress,
      userAgent,
      metadata: { reason: 'INVALID_PASSWORD', failedAttempts },
    });

    if (justLocked) {
      await recordSecurityEvent({
        userId: user._id,
        type: SECURITY_EVENT_TYPES.ACCOUNT_LOCKED,
        ipAddress,
        userAgent,
        metadata: { lockedUntil: user.lockedUntil },
      });

      await sendAccountLockedEmail(user);
    }

    throw new AppError('Invalid username/email or password.', 401, {
      code: 'INVALID_CREDENTIALS',
    });
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();

  if (await needsPasswordRehash(user.passwordHash)) {
    user.passwordHash = await hashPassword(password);
    user.passwordChangedAt = new Date();
  }

  await user.save();

  const tokenPayload = { sub: user._id.toString(), role: user.role };

  const accessToken = createAccessToken(tokenPayload);
  const { token: refreshToken, tokenId } = createRefreshToken(tokenPayload);
  const refreshTokenPayload = verifyRefreshToken(refreshToken);

  await Session.create({
    userId: user._id,
    tokenIdHash: hashToken(tokenId),
    expiresAt: new Date(refreshTokenPayload.exp * 1000),
    ipAddress,
    userAgent,
  });

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
    ipAddress,
    userAgent,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/**
 * ============================================================
 * REFRESH (with rotation and reuse detection)
 * ============================================================
 *
 * If a refresh token that has already been revoked (i.e. already
 * used once, or explicitly logged out) is presented again, this is
 * treated as a signal of possible token theft: the entire session
 * family for that user is revoked, forcing re-authentication
 * everywhere, and a REFRESH_TOKEN_REUSE_DETECTED security event is
 * recorded.
 */
export const refresh = async ({
  refreshToken,
  ipAddress = null,
  userAgent = null,
}) => {
  if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
    throw new AppError('Refresh token is required.', 401, {
      code: 'REFRESH_TOKEN_REQUIRED',
    });
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401, {
      code: 'INVALID_REFRESH_TOKEN',
    });
  }

  const userId =
    typeof payload.sub === 'string' && payload.sub.trim() ? payload.sub : null;

  const tokenId =
    typeof payload.tokenId === 'string' && payload.tokenId.trim()
      ? payload.tokenId
      : null;

  if (!userId || !tokenId) {
    throw new AppError('Invalid refresh token.', 401, {
      code: 'INVALID_REFRESH_TOKEN',
    });
  }

  const tokenIdHash = hashToken(tokenId);

  const session = await Session.findOne({ userId, tokenIdHash });

  if (!session) {
    throw new AppError('Session not found or already revoked.', 401, {
      code: 'INVALID_SESSION',
    });
  }

  if (session.revokedAt) {
    // Reuse of an already-rotated/revoked refresh token: treat as a
    // possible compromise and revoke every active session for this
    // user so the attacker (and the legitimate user) are both forced
    // to re-authenticate.
    await Session.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    await recordSecurityEvent({
      userId,
      type: SECURITY_EVENT_TYPES.REFRESH_TOKEN_REUSE_DETECTED,
      ipAddress,
      userAgent,
    });

    throw new AppError(
      'This session is no longer valid. Please sign in again.',
      401,
      { code: 'REFRESH_TOKEN_REVOKED' },
    );
  }

  if (!session.expiresAt || session.expiresAt <= new Date()) {
    throw new AppError('Refresh token has expired.', 401, {
      code: 'REFRESH_TOKEN_EXPIRED',
    });
  }

  const user = await User.findById(userId);

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('This account is not active.', 403, {
      code: 'ACCOUNT_NOT_ACTIVE',
    });
  }

  const tokenPayload = { sub: user._id.toString(), role: user.role };

  const accessToken = createAccessToken(tokenPayload);
  const { token: newRefreshToken, tokenId: newTokenId } =
    createRefreshToken(tokenPayload);
  const newRefreshPayload = verifyRefreshToken(newRefreshToken);
  const newTokenIdHash = hashToken(newTokenId);

  await Session.create({
    userId: user._id,
    tokenIdHash: newTokenIdHash,
    expiresAt: new Date(newRefreshPayload.exp * 1000),
    userAgent,
    ipAddress,
  });

  session.revokedAt = new Date();
  session.replacedByTokenIdHash = newTokenIdHash;

  await session.save();

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.REFRESH_TOKEN_ROTATED,
    ipAddress,
    userAgent,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * ============================================================
 * LOGOUT (single session)
 * ============================================================
 */
export const logout = async ({ refreshToken }) => {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new AppError('Refresh token is required.', 400, {
      code: 'REFRESH_TOKEN_REQUIRED',
    });
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401, {
      code: 'INVALID_REFRESH_TOKEN',
    });
  }

  const tokenIdHash = hashToken(payload.tokenId);

  const session = await Session.findOne({ tokenIdHash });

  if (!session) {
    throw new AppError('Session not found.', 401, {
      code: 'SESSION_NOT_FOUND',
    });
  }

  if (!session.revokedAt) {
    session.revokedAt = new Date();
    await session.save();
  }

  await recordSecurityEvent({
    userId: session.userId,
    type: SECURITY_EVENT_TYPES.LOGOUT,
  });

  return true;
};

/**
 * ============================================================
 * LOGOUT FROM ALL DEVICES
 * ============================================================
 */
export const logoutAll = async ({ userId }) => {
  await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  await recordSecurityEvent({
    userId,
    type: SECURITY_EVENT_TYPES.LOGOUT_ALL,
  });

  return true;
};

/**
 * ============================================================
 * SESSION / DEVICE MANAGEMENT
 * ============================================================
 */
export const listSessions = async ({ userId, currentTokenIdHash = null }) => {
  const sessions = await Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  return sessions.map((session) => ({
    id: session._id.toString(),
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    current: currentTokenIdHash
      ? session.tokenIdHash === currentTokenIdHash
      : false,
  }));
};

export const revokeSession = async ({ userId, sessionId }) => {
  const session = await Session.findOne({ _id: sessionId, userId });

  if (!session) {
    throw new AppError('Session not found.', 404, {
      code: 'SESSION_NOT_FOUND',
    });
  }

  if (!session.revokedAt) {
    session.revokedAt = new Date();
    await session.save();
  }

  await recordSecurityEvent({
    userId,
    type: SECURITY_EVENT_TYPES.SESSION_REVOKED,
    metadata: { sessionId },
  });

  return true;
};

/**
 * ============================================================
 * EMAIL VERIFICATION
 * ============================================================
 */
export const verifyEmail = async ({ token }) => {
  if (typeof token !== 'string' || !token.trim()) {
    throw new AppError('Verification token is required.', 400, {
      code: 'VERIFICATION_TOKEN_REQUIRED',
    });
  }

  const tokenHash = hashToken(token);

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
  }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');

  if (
    !user ||
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt <= new Date()
  ) {
    throw new AppError('Invalid or expired verification token.', 400, {
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  }

  user.emailVerifiedAt = new Date();
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpiresAt = null;

  await user.save();

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.EMAIL_VERIFIED,
  });

  return { user: sanitizeUser(user) };
};

export const resendVerificationEmail = async ({ identifier }) => {
  const user = await findUserByIdentifier(identifier);

  // Always respond as if the request succeeded, whether or not the
  // account exists, is already verified, or has no email at all to
  // verify (email is optional at registration now) — avoids leaking
  // account existence (enumeration protection).
  if (!user || user.emailVerifiedAt || !user.email) {
    return true;
  }

  const verificationToken = generateOpaqueToken();

  user.emailVerificationTokenHash = hashToken(verificationToken);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_EXPIRES_MINUTES * 60 * 1000,
  );

  await user.save();

  await sendVerificationEmail(user, verificationToken);

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.EMAIL_VERIFICATION_REQUESTED,
  });

  return true;
};

/**
 * ============================================================
 * PASSWORD CHANGE (authenticated)
 * ============================================================
 */
export const changePassword = async ({
  userId,
  currentPassword,
  newPassword,
}) => {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    throw new AppError('User account not found.', 404, {
      code: 'USER_NOT_FOUND',
    });
  }

  const currentValid = await verifyPassword(user.passwordHash, currentPassword);

  if (!currentValid) {
    throw new AppError('Current password is incorrect.', 401, {
      code: 'INVALID_CURRENT_PASSWORD',
    });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();

  await user.save();

  // Changing a password invalidates every existing session (a
  // standard account-security practice), including the session that
  // just made this request — every refresh token, current device
  // included, is revoked. The caller's own short-lived access token
  // keeps working only until it naturally expires; it cannot be
  // refreshed afterward, so the frontend signs the user out
  // immediately rather than waiting for that expiry to surface as a
  // confusing "session expired" event later.
  await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  await recordSecurityEvent({
    userId,
    type: SECURITY_EVENT_TYPES.PASSWORD_CHANGED,
  });

  await sendPasswordChangedEmail(user);

  return true;
};

/**
 * ============================================================
 * PASSWORD RESET (forgot password flow)
 * ============================================================
 */
export const requestPasswordReset = async ({
  identifier,
  ipAddress = null,
  userAgent = null,
}) => {
  const user = await findUserByIdentifier(identifier);

  // Enumeration protection: always behave the same whether or not
  // the account exists.
  if (!user || user.status !== 'ACTIVE') {
    return true;
  }

  if (
    (user.passwordResetAttempts || 0) >= MAX_PASSWORD_RESET_ATTEMPTS &&
    user.passwordResetExpiresAt &&
    user.passwordResetExpiresAt > new Date()
  ) {
    // A reset is already pending and the attempt budget for this
    // window is spent; do not issue another one or leak that fact.
    return true;
  }

  const resetToken = generateOpaqueToken();

  user.passwordResetTokenHash = hashToken(resetToken);
  user.passwordResetExpiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000,
  );
  user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;

  await user.save();

  await sendPasswordResetEmail(user, resetToken);

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.PASSWORD_RESET_REQUESTED,
    ipAddress,
    userAgent,
  });

  return true;
};

export const resetPassword = async ({
  token,
  newPassword,
  ipAddress = null,
  userAgent = null,
}) => {
  if (typeof token !== 'string' || !token.trim()) {
    throw new AppError('Reset token is required.', 400, {
      code: 'RESET_TOKEN_REQUIRED',
    });
  }

  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
  }).select('+passwordResetTokenHash +passwordResetExpiresAt +passwordHash');

  if (
    !user ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt <= new Date()
  ) {
    throw new AppError('Invalid or expired reset token.', 400, {
      code: 'INVALID_RESET_TOKEN',
    });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.passwordResetAttempts = 0;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;

  await user.save();

  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.PASSWORD_RESET_COMPLETED,
    ipAddress,
    userAgent,
  });

  await sendPasswordChangedEmail(user);

  return true;
};

export const getSecurityEvents = async (userId, options) => {
  return listSecurityEventsForUser(userId, options);
};

/**
 * FET-03 — self-service preference update (`PATCH /auth/me/preferences`).
 * Deliberately separate from the admin `PATCH /users/:id` path
 * (BET-05) — a user updating their own theme is not the same
 * operation as an admin editing a user record, needs no
 * `USERS_WRITE` permission, and must never touch the protected-account
 * guarded fields (`role`/`status`/`isProtected`) — merging only known
 * `uiPreferences` sub-fields keeps that true by construction.
 */
export const updateUserPreferences = async (userId, updates) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  user.uiPreferences = {
    ...(user.uiPreferences ? user.uiPreferences.toObject() : {}),
    ...updates,
  };

  await user.save();
  return sanitizeUser(user);
};

export const updateUsername = async (userId, rawUsername) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  const normalizedUsername = normalizeIdentifier(rawUsername);

  if (normalizedUsername === user.username) {
    // No-op — already their username (e.g. the field wasn't
    // actually changed but the form was submitted anyway).
    return sanitizeUser(user);
  }

  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    throw new AppError('That username is already taken.', 409, {
      code: 'USERNAME_ALREADY_EXISTS',
    });
  }

  user.username = normalizedUsername;
  await user.save();

  return sanitizeUser(user);
};

export const updateEmail = async (userId, { email, currentPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  // Sign-in email: require the current password before changing it.
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new AppError('Current password is incorrect.', 401, {
      code: 'INVALID_CURRENT_PASSWORD',
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (normalizedEmail === user.email) {
    return sanitizeUser(user);
  }

  const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).select('_id');
  if (existing) {
    throw new AppError('That email is already in use.', 409, {
      code: 'EMAIL_ALREADY_EXISTS',
    });
  }

  const verificationToken = generateOpaqueToken();
  user.email = normalizedEmail;
  user.emailVerifiedAt = null;
  user.emailVerificationTokenHash = hashToken(verificationToken);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_EXPIRES_MINUTES * 60 * 1000,
  );
  await user.save();

  await sendVerificationEmail(user, verificationToken);

  return sanitizeUser(user);
};

export const updateProfileImage = async (userId, profileImage) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }
  user.profileImage = profileImage || null;
  await user.save();
  return sanitizeUser(user);
};

export { sanitizeUser, isValidRole };
