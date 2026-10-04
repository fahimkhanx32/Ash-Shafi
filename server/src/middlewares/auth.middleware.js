import { User } from '../users/user.model.js';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canManageRole,
  isProtectedRole,
} from '../security/permissions.js';
import { verifyAccessToken } from '../security/tokens.js';
import { AppError } from './error.middleware.js';

export const authenticate = async (req, res, next) => {
  try {
    const authorization = req.get('authorization');

    if (!authorization) {
      throw new AppError(
        'Authentication required.',
        401,
        {
          code: 'AUTHENTICATION_REQUIRED',
        },
      );
    }

    const [scheme, token] = authorization
      .trim()
      .split(/\s+/);

    if (
      scheme !== 'Bearer' ||
      !token
    ) {
      throw new AppError(
        'Invalid authorization header.',
        401,
        {
          code: 'INVALID_AUTHORIZATION_HEADER',
        },
      );
    }

    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(
        'Invalid or expired access token.',
        401,
        {
          code: 'INVALID_ACCESS_TOKEN',
        },
      );
    }

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim()
    ) {
      throw new AppError(
        'Invalid access token.',
        401,
        {
          code: 'INVALID_ACCESS_TOKEN',
        },
      );
    }

    const user = await User.findById(
      payload.sub,
    );

    if (!user) {
      throw new AppError(
        'User account not found.',
        401,
        {
          code: 'USER_NOT_FOUND',
        },
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(
        'This account is not active.',
        403,
        {
          code: 'ACCOUNT_NOT_ACTIVE',
        },
      );
    }

    req.auth = payload;
    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
};

export const authorize = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(
          'Authentication required.',
          401,
          {
            code: 'AUTHENTICATION_REQUIRED',
          },
        );
      }

      if (
        !hasPermission(
          req.user.role,
          permission,
        )
      ) {
        throw new AppError(
          'You do not have permission to perform this action.',
          403,
          {
            code: 'FORBIDDEN',
          },
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const authorizeAny = (permissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(
          'Authentication required.',
          401,
          {
            code: 'AUTHENTICATION_REQUIRED',
          },
        );
      }

      if (
        !hasAnyPermission(
          req.user.role,
          permissions,
        )
      ) {
        throw new AppError(
          'You do not have permission to perform this action.',
          403,
          {
            code: 'FORBIDDEN',
          },
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const authorizeAll = (permissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(
          'Authentication required.',
          401,
          {
            code: 'AUTHENTICATION_REQUIRED',
          },
        );
      }

      if (
        !hasAllPermissions(
          req.user.role,
          permissions,
        )
      ) {
        throw new AppError(
          'You do not have permission to perform this action.',
          403,
          {
            code: 'FORBIDDEN',
          },
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

/**
 * BET-04 — resource-level / ownership authorization.
 *
 * Grants access if the authenticated user either (a) owns the
 * resource being accessed, or (b) holds the given permission. The
 * "owner" id is read from `req.params[paramName]` by default (the
 * common `/patients/:id`, `/appointments/:id` shape), but a request
 * can supply a custom `resolveOwnerId(req)` for resources where the
 * owner id lives somewhere else (e.g. a nested `patientId` on the
 * body, or a value the controller layer resolved from a lookup and
 * attached to `req`).
 *
 * This is the shared building block later clinical/appointment/
 * billing modules (BET-06 onward) are expected to reuse for "a
 * patient may read their own record; staff need `patients:read`"
 * style rules, instead of every module hand-rolling its own
 * ownership check.
 */
export const authorizeSelfOrPermission = (
  permission,
  { paramName = 'id', resolveOwnerId } = {},
) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(
          'Authentication required.',
          401,
          {
            code: 'AUTHENTICATION_REQUIRED',
          },
        );
      }

      const ownerId =
        typeof resolveOwnerId === 'function'
          ? resolveOwnerId(req)
          : req.params?.[paramName];

      const isOwner =
        !!ownerId &&
        String(ownerId) === String(req.user._id);

      if (isOwner) {
        return next();
      }

      if (hasPermission(req.user.role, permission)) {
        return next();
      }

      throw new AppError(
        'You do not have permission to perform this action.',
        403,
        {
          code: 'FORBIDDEN',
        },
      );
    } catch (error) {
      return next(error);
    }
  };
};

/**
 * BET-04 — administrative/hierarchy authorization. Ensures the
 * authenticated actor's role outranks (per `ROLE_HIERARCHY`) the
 * role of the account they are trying to act on, in addition to
 * whatever plain permission check already gated the route. Intended
 * for user-management style endpoints (role changes, deactivation)
 * that BET-05 builds on top of `authorize(PERMISSIONS.USERS_WRITE)`.
 * `resolveTargetRole(req)` must return the target account's current
 * role (typically resolved by the controller/service after a DB
 * lookup and attached to the request, since the role usually is not
 * known from the URL alone).
 */
export const authorizeManagesRole = (resolveTargetRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(
          'Authentication required.',
          401,
          {
            code: 'AUTHENTICATION_REQUIRED',
          },
        );
      }

      const targetRole = resolveTargetRole(req);

      if (!targetRole) {
        return next();
      }

      if (!canManageRole(req.user.role, targetRole)) {
        throw new AppError(
          'You are not permitted to manage an account with this role.',
          403,
          {
            code: 'ROLE_HIERARCHY_VIOLATION',
          },
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

/**
 * BET-04 — blocks a request outright when it targets a role that is
 * globally protected (currently `SOFTWARE_OWNER` — see
 * `isProtectedRole()`), regardless of the acting user's own role.
 * Complements (does not replace) the Mongoose-level guards already
 * on `User` for the two specific protected accounts — this operates
 * at the role level, before a specific account is even looked up.
 */
export const blockProtectedRoleTarget = (resolveTargetRole) => {
  return (req, res, next) => {
    try {
      const targetRole = resolveTargetRole(req);

      if (targetRole && isProtectedRole(targetRole)) {
        throw new AppError(
          'This role is system-protected and cannot be modified through this endpoint.',
          403,
          {
            code: 'PROTECTED_ROLE',
          },
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
