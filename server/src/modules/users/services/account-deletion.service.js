import { User } from '../../../users/user.model.js';
import { Session } from '../../../auth/session.model.js';
import { AccountDeletionRequest } from '../models/account-deletion-request.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { ROLES, canManageRole } from '../../../security/permissions.js';
import { verifyPassword, hashPassword } from '../../../security/password.js';
import { generateOpaqueToken } from '../../../security/tokens.js';
import { sanitizeUser } from '../../../auth/auth.service.js';
import {
  getPatientProfileByUserId,
  deactivatePatientProfile,
} from '../../patients/services/patient.service.js';
import {
  sendAccountDeletionRequestReceivedEmail,
  sendAccountDeletionRequestRejectedEmail,
} from '../../../integrations/email/email.service.js';

/**
 * BET-17 Checkpoint 3 — Account Lifecycle: deletion-request workflow.
 *
 * Implements master prompt §38 end to end:
 *   Patient requests deletion
 *     -> Deletion request recorded            (requestAccountDeletion)
 *     -> Account deactivation/anonymization    (processAccountDeletion, approve path)
 *        according to policy
 *     -> Required medical records retained     (anonymizeUser never touches
 *        per retention requirements               PatientProfile/clinical collections)
 *     -> Audit trail retained                  (AccountDeletionRequest.history,
 *                                                  plus BET-17's general AuditLog
 *                                                  written by the calling controllers)
 *
 * Deliberately narrow scope for this checkpoint, per the master
 * prompt's own BET-17 roadmap split: "Permanent deletion", "Retention
 * policies", "Controlled deletion", and "Data ownership/lifecycle
 * rules" are Checkpoint 4 items and are NOT implemented here. This
 * checkpoint only covers "Account deactivation", "Account deletion
 * workflow", and "Soft deletion where appropriate" — an approved
 * request anonymizes and deactivates the `User` (and, if one exists,
 * soft-deactivates the linked `PatientProfile` via BET-06's existing
 * `deactivatePatientProfile`), it never physically deletes a
 * document from any collection.
 */

const assertNotProtected = (user) => {
  if (user.isProtected) {
    throw new AppError(
      'This account is system-protected and cannot be deleted or anonymized.',
      403,
      { code: 'PROTECTED_ACCOUNT' },
    );
  }
};

const findUserOrThrow = async (userId, { withSecrets = false } = {}) => {
  let query = User.findById(userId);

  if (withSecrets) {
    query = query.select('+passwordHash');
  }

  const user = await query;

  if (!user) {
    throw new AppError('User account not found.', 404, {
      code: 'USER_NOT_FOUND',
    });
  }

  return user;
};

/**
 * Self-service request (master prompt §38's primary flow). Requires
 * the account's own current password to confirm intent — the same
 * "prove you are who you say you are" bar `auth.service.js`'s
 * `changePassword` already sets for another account-security-
 * sensitive action, deliberately reused here rather than accepting a
 * bare `userId` from an authenticated session alone.
 */
export const requestAccountDeletion = async ({ userId, password, reason }) => {
  const user = await findUserOrThrow(userId, { withSecrets: true });

  assertNotProtected(user);

  const passwordValid = await verifyPassword(user.passwordHash, password);

  if (!passwordValid) {
    throw new AppError('Current password is incorrect.', 401, {
      code: 'INVALID_CURRENT_PASSWORD',
    });
  }

  const existingPending = await AccountDeletionRequest.findOne({
    user: user._id,
    status: 'PENDING',
  });

  if (existingPending) {
    throw new AppError(
      'A deletion request for this account is already pending.',
      409,
      { code: 'DELETION_REQUEST_ALREADY_PENDING' },
    );
  }

  const request = await AccountDeletionRequest.create({
    user: user._id,
    method: 'SELF_SERVICE',
    reason: reason || null,
    status: 'PENDING',
    requestedBy: user._id,
    requestedAt: new Date(),
    history: [
      {
        status: 'PENDING',
        actor: user._id,
        actorRole: user.role,
        notes: reason || null,
        at: new Date(),
      },
    ],
  });

  user.deletionRequestStatus = 'PENDING';
  user.deletionRequestedAt = request.requestedAt;

  await user.save();

  logger.info(
    {
      event: 'account_deletion_requested',
      userId: user._id.toString(),
      requestId: request._id.toString(),
      method: 'SELF_SERVICE',
    },
    'Account deletion requested by account holder.',
  );

  await sendAccountDeletionRequestReceivedEmail(user).catch(() => null);

  return request;
};

/**
 * Self-service cancellation. Only the still-`PENDING` request for
 * the caller's own account can be cancelled this way — once a
 * request has been approved (and the account anonymized) or
 * rejected, it is a permanent, retained record (master prompt §38's
 * "audit trail retained"), not something a caller can edit away.
 */
export const cancelAccountDeletionRequest = async ({ userId, notes }) => {
  const request = await AccountDeletionRequest.findOne({
    user: userId,
    status: 'PENDING',
  });

  if (!request) {
    throw new AppError('No pending deletion request found for this account.', 404, {
      code: 'DELETION_REQUEST_NOT_FOUND',
    });
  }

  request.status = 'CANCELLED';
  request.processedBy = userId;
  request.processedAt = new Date();
  request.processingNotes = notes || null;
  request.history.push({
    status: 'CANCELLED',
    actor: userId,
    notes: notes || null,
    at: new Date(),
  });

  await request.save();

  await User.updateOne(
    { _id: userId },
    { $set: { deletionRequestStatus: 'NONE', deletionRequestedAt: null } },
  );

  logger.info(
    {
      event: 'account_deletion_cancelled',
      userId: String(userId),
      requestId: request._id.toString(),
    },
    'Account deletion request cancelled.',
  );

  return request;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listAccountDeletionRequests = async ({
  status,
  search,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = {};

  if (status) {
    filter.status = status;
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  let query = AccountDeletionRequest.find(filter)
    .populate('user', 'name email username role status deletionRequestStatus')
    .populate('requestedBy', 'name email role')
    .populate('processedBy', 'name email role')
    .sort({ requestedAt: -1 });

  // Search is applied post-populate on the account fields, since the
  // request document itself carries no searchable PII by design —
  // fine at this collection's expected scale (deletion requests are
  // an infrequent, reviewed-by-hand workflow, not a high-volume
  // table needing a database-level text search).
  const [allMatching, total] = await Promise.all([
    query.lean(),
    AccountDeletionRequest.countDocuments(filter),
  ]);

  let items = allMatching;

  if (search) {
    const pattern = new RegExp(escapeRegExp(search), 'i');
    items = items.filter(
      (item) =>
        pattern.test(item.user?.name || '') ||
        pattern.test(item.user?.email || '') ||
        pattern.test(item.user?.username || ''),
    );
  }

  const paged = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return { items: paged, total: search ? items.length : total, page: safePage, limit: safeLimit };
};

export const getAccountDeletionRequestById = async (id) => {
  const request = await AccountDeletionRequest.findById(id)
    .populate('user', 'name email username role status deletionRequestStatus isProtected')
    .populate('requestedBy', 'name email role')
    .populate('processedBy', 'name email role');

  if (!request) {
    throw new AppError('Deletion request not found.', 404, {
      code: 'DELETION_REQUEST_NOT_FOUND',
    });
  }

  return request;
};

/**
 * The actual "deactivation/anonymization according to policy" step
 * (master prompt §38). Deliberately conservative:
 *   - never deletes the `User` document (soft-close only — "Never
 *     silently destroy medical history", master prompt §84, and the
 *     account row itself is what every existing clinical/audit
 *     record's `actor`/`patient` foreign keys point at)
 *   - never touches `PatientProfile` clinical-history subdocuments
 *     (allergies, conditions, surgeries, etc.) — only flips the same
 *     `isActive`/`patientStatus` soft-delete flags BET-06's
 *     `deactivatePatientProfile` already established, so the record
 *     becomes inaccessible for ordinary clinical workflows while
 *     remaining intact for retention/legal purposes
 *   - replaces only account-identity PII (name/email/username) with
 *     a deterministic, non-reversible placeholder derived from the
 *     account's own id, and rotates the password hash to a random,
 *     never-transmitted value so the account can never authenticate
 *     again — the account row survives (so foreign keys stay valid),
 *     but is no longer a working login
 */
const anonymizeUser = async (user) => {
  const suffix = user._id.toString();

  user.name = 'Deleted Account';
  user.email = `deleted-${suffix}@anonymized.local`;
  user.username = `deleted-${suffix}`;
  user.passwordHash = await hashPassword(generateOpaqueToken(32));
  user.status = 'INACTIVE';
  user.deletionRequestStatus = 'ANONYMIZED';
  user.anonymizedAt = new Date();
  // Outbound notification channels are turned off (the email/phone
  // identity behind them no longer belongs to anyone reachable) —
  // `uiPreferences` is left as-is; it's a cosmetic-only subdocument
  // with no PII of its own, and clearing it risks fighting Mongoose's
  // default-application semantics on an existing document for no
  // real benefit.
  user.notificationPreferences = { email: false, sms: false, whatsapp: false };

  await user.save();

  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  const patientProfile = await getPatientProfileByUserId(user._id).catch(() => null);

  if (patientProfile) {
    await deactivatePatientProfile(patientProfile._id, user._id);
  }

  return user;
};

/**
 * Admin/owner-tier review-and-process step. `approve: true` runs the
 * anonymization described above; `approve: false` rejects the
 * request and leaves the account exactly as it was (still active,
 * still reachable) — either outcome is permanently recorded on the
 * request document itself, never edited afterward.
 */
export const processAccountDeletionRequest = async ({
  requestId,
  approve,
  notes,
  actorId,
  actorRole,
}) => {
  const request = await AccountDeletionRequest.findById(requestId);

  if (!request) {
    throw new AppError('Deletion request not found.', 404, {
      code: 'DELETION_REQUEST_NOT_FOUND',
    });
  }

  if (request.status !== 'PENDING') {
    throw new AppError(
      `This deletion request has already been ${request.status.toLowerCase()} and cannot be processed again.`,
      409,
      { code: 'DELETION_REQUEST_NOT_PENDING' },
    );
  }

  const user = await findUserOrThrow(request.user);

  assertNotProtected(user);

  // Same role-hierarchy rule `setUserStatus`/`changeUserRole`
  // already enforce — an actor may only act on accounts they
  // outrank. `SOFTWARE_OWNER`/`SUPER_ADMIN` are never blocked by
  // this (see `canManageRole`); an `ADMIN` cannot process a
  // `DIRECTOR`'s own deletion request, for example.
  if (!canManageRole(actorRole, user.role) && actorRole !== ROLES.SOFTWARE_OWNER) {
    throw new AppError(
      'You are not permitted to process a deletion request for this account.',
      403,
      { code: 'ROLE_ASSIGNMENT_NOT_PERMITTED' },
    );
  }

  const newStatus = approve ? 'APPROVED' : 'REJECTED';

  request.status = newStatus;
  request.processedBy = actorId;
  request.processedAt = new Date();
  request.processingNotes = notes || null;

  if (approve) {
    await anonymizeUser(user);
    request.anonymizedAt = user.anonymizedAt;
  } else {
    user.deletionRequestStatus = 'NONE';
    user.deletionRequestedAt = null;
    await user.save();
  }

  request.history.push({
    status: newStatus,
    actor: actorId,
    actorRole,
    notes: notes || null,
    at: new Date(),
  });

  await request.save();

  logger.info(
    {
      event: approve ? 'account_deletion_approved' : 'account_deletion_rejected',
      userId: user._id.toString(),
      requestId: request._id.toString(),
      actorId: actorId ? String(actorId) : null,
    },
    approve
      ? 'Account deletion request approved; account anonymized and deactivated.'
      : 'Account deletion request rejected.',
  );

  if (!approve) {
    // Rejection is the one outcome the account holder can still act
    // on (they're still active) — worth a dedicated notice. An
    // approved/anonymized account has no working email identity left
    // to notify by the time this runs.
    await sendAccountDeletionRequestRejectedEmail(user).catch(() => null);
  }

  return { request, user: sanitizeUser(user) };
};
