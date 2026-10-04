import { User, USER_ROLES, USER_STATUSES } from '../../../users/user.model.js';
import { Session } from '../../../auth/session.model.js';
import { StaffProfile } from '../../staff/models/staff-profile.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { ROLES, isProtectedRole } from '../../../security/permissions.js';
import { assertCanAssignRole } from '../../roles/services/role.service.js';
import { hashPassword } from '../../../security/password.js';
import {
  generateOpaqueToken,
  hashToken,
} from '../../../security/tokens.js';
import env from '../../../config/env.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { sanitizeUser } from '../../../auth/auth.service.js';
import {
  sendWelcomeSetPasswordEmail,
  sendAccountStatusChangedEmail,
} from '../../../integrations/email/email.service.js';

/**
 * BET-05 — User, Staff & Organization Management.
 *
 * This module is the administrative counterpart to the self-service
 * flows already built in `auth/auth.service.js` (BET-03). It never
 * duplicates authentication concerns (login, sessions, password
 * change/reset all remain in `auth/`) — it only adds the
 * administrator-facing operations the master prompt reserves for
 * BET-05: listing/searching accounts, provisioning staff/doctor/
 * admin accounts (`auth/auth.service.js`'s `register` is
 * intentionally patient-only and never touched here), editing basic
 * profile fields, role assignment, and account activation/
 * deactivation/suspension.
 *
 * Every mutation here goes through `User.findById` + field
 * assignment + `doc.save()` (never a raw `updateOne`/
 * `findOneAndUpdate` with a plain object), so the protected-account
 * Mongoose hooks on `users/user.model.js` (BET-03) always run. On
 * top of that, protected accounts are checked explicitly up front so
 * a blocked action returns a clean 403 `AppError` instead of a
 * generic 500 from the Mongoose hook — the hook remains defense in
 * depth, not the primary error path.
 *
 * Role-hierarchy enforcement reuses `assertCanAssignRole()`
 * (`modules/roles/services/role.service.js`), which BET-04 exported
 * specifically for this task rather than reimplementing hierarchy
 * logic here.
 */

// Self-service registration (`auth/auth.service.js`) is the only way
// to create a PATIENT account; administrators provision every other
// role through this module. `SOFTWARE_OWNER` is never assignable
// through ordinary CRUD at all (see `isProtectedRole`) — creating or
// promoting someone to it would need its own explicit, audited,
// MFA-gated operation, which is intentionally out of scope here (see
// master prompt section 10).
export const ADMIN_ASSIGNABLE_ROLES = Object.freeze(
  USER_ROLES.filter(
    (role) => role !== ROLES.PATIENT && !isProtectedRole(role),
  ),
);

const USER_SUMMARY_FIELDS =
  'name email username role status isProtected isDeleted deletedAt deletedBy emailVerifiedAt lastLoginAt createdAt updatedAt';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

const assertNotProtected = (user, action) => {
  if (user.isProtected) {
    throw new AppError(
      `This account is system-protected and cannot ${action} through ordinary user management.`,
      403,
      { code: 'PROTECTED_ACCOUNT' },
    );
  }
};

const findUserOrThrow = async (id, { withSecrets = false } = {}) => {
  let query = User.findById(id);

  if (withSecrets) {
    query = query.select('+passwordHash');
  }

  const user = await query;

  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  return user;
};

const buildListFilter = ({ role, status, search, includeDeleted = false, onlyDeleted = false, actorRole }) => {
  const filter = {};
  const isSuperOrOwner = actorRole === ROLES.SOFTWARE_OWNER || actorRole === ROLES.SUPER_ADMIN;

  if (isSuperOrOwner && onlyDeleted) {
    filter.isDeleted = true;
  } else if (isSuperOrOwner && includeDeleted) {
    // Show both active and deleted when explicitly requested by Owner/SuperAdmin
  } else {
    filter.isDeleted = { $ne: true };
  }

  if (role) {
    filter.role = role;
  }

  if (status) {
    filter.status = status;
  }

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { username: pattern }];
  }

  return filter;
};

export const listUsers = async ({
  role,
  status,
  search,
  includeDeleted = false,
  onlyDeleted = false,
  actorRole,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = buildListFilter({ role, status, search, includeDeleted, onlyDeleted, actorRole });

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(USER_SUMMARY_FIELDS)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { items, total, page: safePage, limit: safeLimit };
};

export const getUserById = async (id) => {
  const user = await User.findById(id).select(USER_SUMMARY_FIELDS);

  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  return user;
};

/**
 * Administrator-provisioned account creation for staff, doctors, and
 * other administrators (master prompt BET-05: "Users", "Staff",
 * "Doctors", "Administrators", ...). Deliberately never accepts a
 * client-supplied password (master prompt: "Never send plaintext
 * passwords" / never trust the frontend with credential handling) —
 * a cryptographically random password is generated server-side, only
 * its hash is ever persisted, and the new user is emailed a
 * password-*set* link that reuses the existing BET-03
 * `POST /auth/reset-password` flow rather than building a parallel
 * "set initial password" mechanism.
 */
export const createUserByAdmin = async (
  { name, email, username, role, password },
  actorId,
  actorRole,
) => {
  if (!ADMIN_ASSIGNABLE_ROLES.includes(role)) {
    throw new AppError(
      'This role cannot be assigned through user management.',
      400,
      { code: 'ROLE_NOT_ASSIGNABLE' },
    );
  }

  assertCanAssignRole(actorRole, role);

  const normalizedEmail = normalize(email);
  const normalizedUsername = normalize(username);

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
  });

  if (existing) {
    throw new AppError(
      'An account with this email or username already exists.',
      409,
      { code: 'ACCOUNT_ALREADY_EXISTS' },
    );
  }

  // Use admin-supplied password if provided, otherwise generate a random token
  const rawPassword = password && typeof password === 'string' && password.trim() ? password.trim() : generateOpaqueToken(24);
  const passwordHash = await hashPassword(rawPassword);

  const resetToken = generateOpaqueToken();

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    passwordHash,
    role,
    status: 'ACTIVE',
    // Administrator-entered contact details are treated as verified
    // at creation time — there is no self-service email-ownership
    // step for accounts an administrator provisions directly.
    emailVerifiedAt: new Date(),
    passwordResetTokenHash: hashToken(resetToken),
    passwordResetExpiresAt: new Date(
      Date.now() + env.verification.passwordResetExpiresMinutes * 60 * 1000,
    ),
  });

  await sendWelcomeSetPasswordEmail(user, resetToken);

  logger.info(
    {
      event: 'user_created_by_admin',
      userId: user._id.toString(),
      role,
      actorId: actorId ? String(actorId) : null,
    },
    'User account created by administrator.',
  );

  return sanitizeUser(user);
};

const UPDATABLE_PROFILE_FIELDS = ['name', 'email', 'username'];

export const updateUserProfile = async (id, updates, actorId) => {
  const user = await findUserOrThrow(id);

  assertNotProtected(user, 'be edited');

  if (updates.email !== undefined || updates.username !== undefined) {
    const normalizedEmail =
      updates.email !== undefined ? normalize(updates.email) : user.email;
    const normalizedUsername =
      updates.username !== undefined
        ? normalize(updates.username)
        : user.username;

    const conflict = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (conflict) {
      throw new AppError(
        'Another account already uses this email or username.',
        409,
        { code: 'ACCOUNT_ALREADY_EXISTS' },
      );
    }
  }

  for (const field of UPDATABLE_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      user[field] = field === 'name' ? updates[field].trim() : normalize(updates[field]);
    }
  }

  await user.save();

  logger.info(
    {
      event: 'user_profile_updated',
      userId: user._id.toString(),
      actorId: actorId ? String(actorId) : null,
      fields: Object.keys(updates),
    },
    'User profile updated by administrator.',
  );

  return sanitizeUser(user);
};

/**
 * Role assignment (master prompt BET-05: "Role assignment"). Checked
 * against the acting user's own role twice: once against the
 * account's *current* role (an actor must already be permitted to
 * manage someone at their existing level) and once against the
 * *requested* role (an actor must also be permitted to grant that
 * level) — this stops, for example, an ADMIN laterally reassigning
 * another ADMIN to DOCTOR just because DOCTOR itself sits lower in
 * the hierarchy than ADMIN.
 */
export const changeUserRole = async (id, role, actorId, actorRole) => {
  if (!ADMIN_ASSIGNABLE_ROLES.includes(role)) {
    throw new AppError(
      'This role cannot be assigned through user management.',
      400,
      { code: 'ROLE_NOT_ASSIGNABLE' },
    );
  }

  const user = await findUserOrThrow(id);

  assertNotProtected(user, 'have its role changed');

  assertCanAssignRole(actorRole, user.role);
  assertCanAssignRole(actorRole, role);

  const previousRole = user.role;

  if (previousRole === role) {
    return sanitizeUser(user);
  }

  user.role = role;

  await user.save();

  logger.info(
    {
      event: 'user_role_changed',
      userId: user._id.toString(),
      from: previousRole,
      to: role,
      actorId: actorId ? String(actorId) : null,
    },
    'User role changed by administrator.',
  );

  return sanitizeUser(user);
};

/**
 * Account activation/deactivation/suspension (master prompt BET-05:
 * "Account activation/deactivation"). Setting a non-ACTIVE status
 * revokes every active session for that account, the same way a
 * password change does in `auth/auth.service.js` — an administrator
 * disabling an account should take effect immediately, not merely
 * once the access token happens to expire.
 */
export const setUserStatus = async (id, status, actorId, actorRole) => {
  if (!USER_STATUSES.includes(status)) {
    throw new AppError('Invalid account status.', 400, {
      code: 'INVALID_STATUS',
    });
  }

  const user = await findUserOrThrow(id);

  assertNotProtected(user, 'have its status changed');

  // Reuses the same hierarchy rule as role assignment: an actor may
  // only change the status of accounts they outrank.
  assertCanAssignRole(actorRole, user.role);

  const previousStatus = user.status;

  if (previousStatus === status) {
    return sanitizeUser(user);
  }

  user.status = status;

  await user.save();

  if (status !== 'ACTIVE') {
    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  logger.info(
    {
      event: 'user_status_changed',
      userId: user._id.toString(),
      from: previousStatus,
      to: status,
      actorId: actorId ? String(actorId) : null,
    },
    'User account status changed by administrator.',
  );

  await sendAccountStatusChangedEmail(user, status);

  return sanitizeUser(user);
};

/**
 * Admin-initiated password reset (User Account Management module,
 * BET-05 / master prompt section 8/9).
 *
 * Security guarantees:
 * - The old password is NEVER read, NEVER compared, NEVER returned.
 * - Only the Argon2id hash of `newPassword` is persisted; the
 *   plaintext is never stored, logged, or transmitted.
 * - All active sessions are revoked immediately — same as the
 *   self-service password-change path in `auth/auth.service.js`.
 * - `passwordChangedAt` is updated so any outstanding JWTs that
 *   pre-date the reset are implicitly invalid.
 * - Protected accounts cannot have their password reset through this
 *   path (they have their own MFA-gated ownership-transfer flow).
 */
export const adminResetPassword = async (id, newPassword, actorId, actorRole) => {
  const user = await findUserOrThrow(id, { withSecrets: true });

  assertNotProtected(user, 'have its password reset');

  // Role hierarchy: the actor must outrank the target account.
  assertCanAssignRole(actorRole, user.role);

  const passwordHash = await hashPassword(newPassword);

  user.passwordHash = passwordHash;
  user.passwordChangedAt = new Date();
  // Clear any outstanding password-reset tokens so they cannot be
  // used after an admin explicitly resets the password.
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.passwordResetAttempts = 0;

  await user.save();

  // Immediately revoke every active session so the account cannot
  // continue using a pre-reset session with a still-valid JWT.
  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  logger.info(
    {
      event: 'user_password_reset_by_admin',
      userId: user._id.toString(),
      actorId: actorId ? String(actorId) : null,
    },
    'User password reset by administrator.',
  );

  return sanitizeUser(user);
};

/**
 * Admin-initiated account deletion (User Account Management module).
 *
 * Supports two tiers of deletion:
 * 1. Hard Delete (Permanent Database Purge):
 *    Exclusive to SOFTWARE_OWNER and SUPER_ADMIN when requested with hardDelete: true.
 *    Permanently deletes user and associated profile documents from MongoDB.
 * 2. Soft Delete (Archival / Transparent Deletion):
 *    For all other roles or when hardDelete is not requested.
 *    Marks isDeleted: true, status: 'INACTIVE', deletedAt, deletedBy,
 *    revokes active sessions, and hides from regular staff views while
 *    remaining inspectable by Owner/SuperAdmin.
 */
export const deleteUser = async (id, actorId, actorRole, { hardDelete = false } = {}) => {
  const user = await findUserOrThrow(id);

  assertNotProtected(user, 'be deleted');

  // Role hierarchy: the actor must outrank the target account.
  assertCanAssignRole(actorRole, user.role);

  const isSuperOrOwner = actorRole === ROLES.SOFTWARE_OWNER || actorRole === ROLES.SUPER_ADMIN;

  // Tier 1: Permanent Hard Delete (Only for Software Owner & Super Admin)
  if (hardDelete && isSuperOrOwner) {
    // Revoke and delete sessions
    await Session.deleteMany({ userId: user._id });

    // Clean up associated profiles
    await StaffProfile.deleteOne({ user: user._id }).catch(() => {});
    await PatientProfile.deleteOne({ user: user._id }).catch(() => {});

    // Delete user from database collection
    await User.deleteOne({ _id: user._id });

    logger.info(
      {
        event: 'user_hard_deleted_by_admin',
        userId: user._id.toString(),
        role: user.role,
        actorId: actorId ? String(actorId) : null,
      },
      'User account permanently deleted from database by Super Admin / Owner.',
    );

    return {
      _id: user._id,
      id: user._id.toString(),
      deletedPermanently: true,
      name: user.name,
      email: user.email,
    };
  }

  // Tier 2: Soft Delete
  const previousStatus = user.status;
  const targetRole = user.role;

  user.isDeleted = true;
  user.deletedAt = new Date();
  user.deletedBy = actorId;
  user.status = 'INACTIVE';
  await user.save();

  // Revoke all active sessions immediately.
  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  logger.info(
    {
      event: 'user_deleted_by_admin',
      userId: user._id.toString(),
      previousStatus,
      role: targetRole,
      actorId: actorId ? String(actorId) : null,
    },
    'User account soft-deleted by administrator.',
  );

  return sanitizeUser(user);
};

/**
 * Restores a soft-deleted user account.
 * Only SOFTWARE_OWNER and SUPER_ADMIN can execute this.
 */
export const restoreUser = async (id, actorId, actorRole) => {
  const isSuperOrOwner = actorRole === ROLES.SOFTWARE_OWNER || actorRole === ROLES.SUPER_ADMIN;
  if (!isSuperOrOwner) {
    throw new AppError('Only Software Owner or Super Admin can restore deleted accounts.', 403, {
      code: 'FORBIDDEN',
    });
  }

  const user = await findUserOrThrow(id);
  assertNotProtected(user, 'be restored');

  user.isDeleted = false;
  user.deletedAt = null;
  user.deletedBy = null;
  user.status = 'ACTIVE';
  await user.save();

  logger.info(
    {
      event: 'user_restored_by_admin',
      userId: user._id.toString(),
      role: user.role,
      actorId: actorId ? String(actorId) : null,
    },
    'User account restored by administrator.',
  );

  return sanitizeUser(user);
};

/**
 * Temporary deactivation of account (Status -> INACTIVE, preserves record for reactivation).
 */
export const deactivateUser = async (id, actorId, actorRole) => {
  return setUserStatus(id, 'INACTIVE', actorId, actorRole);
};

/**
 * Reactivation of temporarily deactivated account (Status -> ACTIVE).
 */
export const reactivateUser = async (id, actorId, actorRole) => {
  return setUserStatus(id, 'ACTIVE', actorId, actorRole);
};

