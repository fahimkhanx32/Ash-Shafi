import { User } from '../../../users/user.model.js';
import { Session } from '../../../auth/session.model.js';
import { SecurityEvent, SECURITY_EVENT_TYPES } from '../../../auth/security-event.model.js';
import {
  recordSecurityEvent,
  listSecurityEventsAdmin,
} from '../../../auth/security-event.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';

/**
 * FET-20 prerequisite backend — Security Administration.
 *
 * Everything here is admin-tier: routes are gated at the route layer
 * (`routes/security-admin.routes.js`) on `AUDIT_READ` for read
 * endpoints and `SYSTEM_ADMIN` for the two mutating endpoints
 * (revoke another user's session, unlock another user's account) —
 * the same read/write permission split this project uses throughout
 * (e.g. `SENSITIVE_RECORDS_READ`/`WRITE`). This service assumes that
 * gate has already run; it does not re-check the caller's role
 * itself, matching every other admin-tier service in this project
 * (e.g. `modules/backups/controllers/backup.controller.js`).
 *
 * Nothing here is fabricated: every figure is a real query against
 * `users`, `sessions`, or `security_events` — no placeholder/mock
 * data, per master prompt §102 ("Never create fake medical data
 * workflows in place of real functionality" — the same principle
 * applies to security data).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const summarizeUser = (user) =>
  user && {
    id: (user._id ?? user.id)?.toString?.() ?? String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    isProtected: !!user.isProtected,
  };

// ------------------------------------------------------------------
// Security dashboard
// ------------------------------------------------------------------

export const getSecurityDashboard = async () => {
  const now = new Date();
  const since24h = new Date(now.getTime() - DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);

  const [
    totalUsers,
    activeSessionsCount,
    lockedAccountsCount,
    protectedAccountsCount,
    usersByStatusRaw,
    failedLogins24h,
    accountsLocked24h,
    loginSuccess24h,
    refreshTokenReuse7d,
    securityEvents24h,
  ] = await Promise.all([
    User.countDocuments({}),
    Session.countDocuments({ revokedAt: null, expiresAt: { $gt: now } }),
    User.countDocuments({ lockedUntil: { $gt: now } }),
    User.countDocuments({ isProtected: true }),
    User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SecurityEvent.countDocuments({
      type: SECURITY_EVENT_TYPES.LOGIN_FAILED,
      createdAt: { $gte: since24h },
    }),
    SecurityEvent.countDocuments({
      type: SECURITY_EVENT_TYPES.ACCOUNT_LOCKED,
      createdAt: { $gte: since24h },
    }),
    SecurityEvent.countDocuments({
      type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
      createdAt: { $gte: since24h },
    }),
    SecurityEvent.countDocuments({
      type: SECURITY_EVENT_TYPES.REFRESH_TOKEN_REUSE_DETECTED,
      createdAt: { $gte: since7d },
    }),
    SecurityEvent.countDocuments({ createdAt: { $gte: since24h } }),
  ]);

  const usersByStatus = usersByStatusRaw.reduce((acc, row) => {
    acc[row._id || 'UNKNOWN'] = row.count;
    return acc;
  }, {});

  return {
    generatedAt: now,
    totals: {
      users: totalUsers,
      protectedAccounts: protectedAccountsCount,
      usersByStatus,
    },
    sessions: {
      activeSessions: activeSessionsCount,
    },
    accountSecurity: {
      lockedAccountsNow: lockedAccountsCount,
      accountsLockedLast24h: accountsLocked24h,
    },
    authenticationLast24h: {
      loginSuccess: loginSuccess24h,
      loginFailed: failedLogins24h,
      totalSecurityEvents: securityEvents24h,
    },
    riskSignalsLast7d: {
      refreshTokenReuseDetected: refreshTokenReuse7d,
    },
  };
};

// ------------------------------------------------------------------
// Active sessions (admin — cross-user)
// ------------------------------------------------------------------

/**
 * Admin-tier sibling of `auth.service.js#listSessions` (which is
 * self-scoped to the caller). Deliberately only returns currently
 * active sessions (not revoked, not expired) — matching the "Active
 * sessions" bullet's wording; a future checkpoint that wants a full
 * session history view can add a `status=ALL` option without
 * breaking this default.
 */
export const listSessionsAdmin = async ({ userId, search, page = 1, limit = 20 } = {}) => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);

  const match = { revokedAt: null, expiresAt: { $gt: new Date() } };

  if (userId) {
    match.userId = userId;
  } else if (search && search.trim()) {
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(safe, 'i');
    const matchingUsers = await User.find({
      $or: [{ name: pattern }, { email: pattern }, { username: pattern }],
    })
      .select('_id')
      .limit(200)
      .lean();

    match.userId = { $in: matchingUsers.map((u) => u._id) };
  }

  const [sessions, total] = await Promise.all([
    Session.find(match)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('userId', 'name email username role status isProtected')
      .lean(),
    Session.countDocuments(match),
  ]);

  return {
    items: sessions.map((session) => ({
      id: session._id.toString(),
      user: summarizeUser(session.userId),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    })),
    total,
    page: safePage,
    limit: safeLimit,
  };
};

export const revokeSessionAdmin = async ({ sessionId, actorId, actorRole, reason }) => {
  const session = await Session.findById(sessionId);

  if (!session) {
    throw new AppError('Session not found.', 404, { code: 'SESSION_NOT_FOUND' });
  }

  const targetUser = await User.findById(session.userId).select('isProtected name email role').lean();

  if (!session.revokedAt) {
    session.revokedAt = new Date();
    await session.save();
  }

  await recordSecurityEvent({
    userId: session.userId,
    type: SECURITY_EVENT_TYPES.SESSION_REVOKED_BY_ADMIN,
    metadata: {
      sessionId: session._id.toString(),
      revokedBy: actorId,
      revokedByRole: actorRole,
      reason,
      targetIsProtected: !!targetUser?.isProtected,
    },
  });

  return {
    revoked: true,
    sessionId: session._id.toString(),
    targetUser: summarizeUser(targetUser),
  };
};

// ------------------------------------------------------------------
// Account security (admin view of one user's security posture)
// ------------------------------------------------------------------

export const getAccountSecurityAdmin = async (userId) => {
  const user = await User.findById(userId)
    .select(
      'name email username role status isProtected failedLoginAttempts lockedUntil lastLoginAt passwordChangedAt deletionRequestStatus createdAt',
    )
    .lean();

  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const [activeSessionCount, recentSecurityEventsCount] = await Promise.all([
    Session.countDocuments({ userId, revokedAt: null, expiresAt: { $gt: now } }),
    SecurityEvent.countDocuments({ userId, createdAt: { $gte: since30d } }),
  ]);

  return {
    user: summarizeUser(user),
    failedLoginAttempts: user.failedLoginAttempts || 0,
    lockedUntil: user.lockedUntil,
    isCurrentlyLocked: !!(user.lockedUntil && user.lockedUntil > now),
    lastLoginAt: user.lastLoginAt,
    passwordChangedAt: user.passwordChangedAt,
    deletionRequestStatus: user.deletionRequestStatus,
    activeSessionCount,
    recentSecurityEventsCount30d: recentSecurityEventsCount,
    accountCreatedAt: user.createdAt,
  };
};

/**
 * Clears an account lockout. Deliberately allowed even for protected
 * accounts (Owner/Director) — unlocking is a protective, non-
 * demoting action, unlike the role/status/deletion changes master
 * prompt §10 guards against. `failedLoginAttempts`/`lockedUntil` are
 * not in `GUARDED_PROTECTED_FIELDS` (`users/user.model.js`) for
 * exactly this reason.
 */
export const unlockAccountAdmin = async ({ userId, actorId, actorRole, reason }) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  await recordSecurityEvent({
    userId: user._id,
    type: SECURITY_EVENT_TYPES.ACCOUNT_UNLOCKED_BY_ADMIN,
    metadata: {
      unlockedBy: actorId,
      unlockedByRole: actorRole,
      reason,
      targetIsProtected: !!user.isProtected,
    },
  });

  return { unlocked: true, user: summarizeUser(user) };
};

// ------------------------------------------------------------------
// Security / authentication events (admin — cross-user)
// ------------------------------------------------------------------

export const listSecurityEventsForAdmin = (filters) => listSecurityEventsAdmin(filters);

// ------------------------------------------------------------------
// Security alerts — derived from real, already-recorded signals.
// No new detection logic invented here beyond simple threshold/
// existence checks over data this project already records.
// ------------------------------------------------------------------

export const listSecurityAlerts = async () => {
  const now = new Date();
  const since24h = new Date(now.getTime() - DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);

  const [lockedNow, refreshTokenReuseEvents, recentLockEvents] = await Promise.all([
    User.find({ lockedUntil: { $gt: now } })
      .select('name email role isProtected lockedUntil failedLoginAttempts')
      .lean(),
    SecurityEvent.find({
      type: SECURITY_EVENT_TYPES.REFRESH_TOKEN_REUSE_DETECTED,
      createdAt: { $gte: since7d },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email role isProtected')
      .lean(),
    SecurityEvent.find({
      type: SECURITY_EVENT_TYPES.ACCOUNT_LOCKED,
      createdAt: { $gte: since24h },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email role isProtected')
      .lean(),
  ]);

  const alerts = [];

  for (const user of lockedNow) {
    alerts.push({
      id: `locked-now:${user._id}`,
      type: 'ACCOUNT_CURRENTLY_LOCKED',
      severity: user.isProtected ? 'critical' : 'high',
      message: `${user.name} (${user.email}) is currently locked out after ${user.failedLoginAttempts || 0} failed login attempt(s).`,
      user: summarizeUser(user),
      detectedAt: user.lockedUntil,
    });
  }

  for (const event of recentLockEvents) {
    alerts.push({
      id: `lock-event:${event._id}`,
      type: 'ACCOUNT_LOCKED_EVENT',
      severity: event.userId?.isProtected ? 'critical' : 'medium',
      message: event.userId
        ? `${event.userId.name} (${event.userId.email}) was locked out.`
        : 'An account was locked out.',
      user: summarizeUser(event.userId),
      detectedAt: event.createdAt,
    });
  }

  for (const event of refreshTokenReuseEvents) {
    alerts.push({
      id: `token-reuse:${event._id}`,
      type: 'REFRESH_TOKEN_REUSE_DETECTED',
      severity: 'critical',
      message: event.userId
        ? `Possible stolen/replayed refresh token detected for ${event.userId.name} (${event.userId.email}).`
        : 'Possible stolen/replayed refresh token detected.',
      user: summarizeUser(event.userId),
      detectedAt: event.createdAt,
    });
  }

  alerts.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));

  return { alerts, generatedAt: now };
};

export default {
  getSecurityDashboard,
  listSessionsAdmin,
  revokeSessionAdmin,
  getAccountSecurityAdmin,
  unlockAccountAdmin,
  listSecurityEventsForAdmin,
  listSecurityAlerts,
};
