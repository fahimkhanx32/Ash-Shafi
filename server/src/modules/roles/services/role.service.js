import { Role } from '../models/role.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import {
  PERMISSIONS,
  ROLE_HIERARCHY,
  ROLES,
  getRolePermissions,
  canManageRole,
} from '../../../security/permissions.js';

const ALL_PERMISSION_VALUES = Object.values(PERMISSIONS);

const PROTECTED_SYSTEM_ROLE_KEYS = [
  ROLES.SOFTWARE_OWNER,
  ROLES.SUPER_ADMIN,
];

const slugify = (value) => {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
};

const generateUniqueKey = async (name) => {
  const base = slugify(name) || 'ROLE';

  let candidate = base;
  let suffix = 1;

  // eslint-disable-next-line no-await-in-loop
  while (await Role.exists({ key: candidate })) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }

  return candidate;
};

const assertValidPermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw new AppError('Permissions must be an array.', 400, {
      code: 'INVALID_PERMISSIONS',
    });
  }

  const unknown = permissions.filter(
    (permission) => !ALL_PERMISSION_VALUES.includes(permission),
  );

  if (unknown.length > 0) {
    throw new AppError(
      `Unknown permission(s): ${unknown.join(', ')}`,
      400,
      { code: 'UNKNOWN_PERMISSIONS', details: { unknown } },
    );
  }
};

/**
 * Idempotently mirrors the fixed, code-defined roles
 * (`security/permissions.js`) into the `roles` collection so the
 * roles administration API returns a single, unified list of system
 * + custom roles. Enforcement (`hasPermission`) never reads this
 * collection for system roles — it always reads the in-memory map —
 * this is purely a read-side projection. Safe to call repeatedly
 * (server startup, seed script); never overwrites `isActive`,
 * `name`, or `description` once an administrator has customized
 * them, and never touches custom roles.
 */
export const ensureSystemRolesSeeded = async () => {
  for (const role of ROLE_HIERARCHY) {
    const permissions = getRolePermissions(role);

    // eslint-disable-next-line no-await-in-loop
    const existing = await Role.findOne({ key: role });

    if (existing) {
      // Keep the mirrored permission list in sync with the real
      // enforcement source of truth (`security/permissions.js`) —
      // this field is documentation/visibility only, never itself
      // consulted by `authorize()`.
      existing.permissions = [...permissions];
      existing.isSystem = true;
      existing.isProtected = PROTECTED_SYSTEM_ROLE_KEYS.includes(role);

      // eslint-disable-next-line no-await-in-loop
      await existing.save();

      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await Role.create({
      key: role,
      name: role
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      description: `Built-in system role (${role}).`,
      permissions: [...permissions],
      isSystem: true,
      isProtected: PROTECTED_SYSTEM_ROLE_KEYS.includes(role),
      isActive: true,
    });
  }
};

export const listRoles = async ({ includeInactive = false } = {}) => {
  const filter = includeInactive ? {} : { isActive: true };

  return Role.find(filter).sort({ isSystem: -1, name: 1 }).lean();
};

export const getRoleById = async (id) => {
  const role = await Role.findById(id);

  if (!role) {
    throw new AppError('Role not found.', 404, { code: 'ROLE_NOT_FOUND' });
  }

  return role;
};

export const createCustomRole = async ({
  name,
  description = '',
  permissions = [],
  actorId,
}) => {
  assertValidPermissions(permissions);

  const key = await generateUniqueKey(name);

  const role = await Role.create({
    key,
    name: name.trim(),
    description: description?.trim() ?? '',
    permissions: [...new Set(permissions)],
    isSystem: false,
    isProtected: false,
    isActive: true,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  });

  return role;
};

export const updateCustomRole = async (
  id,
  { name, description, permissions },
  actorId,
) => {
  const role = await getRoleById(id);

  if (role.isSystem) {
    throw new AppError(
      'System roles are read-only. Create a custom role instead.',
      403,
      { code: 'SYSTEM_ROLE_READ_ONLY' },
    );
  }

  if (name !== undefined) {
    role.name = name.trim();
  }

  if (description !== undefined) {
    role.description = description?.trim() ?? '';
  }

  if (permissions !== undefined) {
    assertValidPermissions(permissions);
    role.permissions = [...new Set(permissions)];
  }

  role.updatedBy = actorId ?? null;

  await role.save();

  return role;
};

export const deleteCustomRole = async (id) => {
  const role = await getRoleById(id);

  if (role.isSystem) {
    throw new AppError('System roles cannot be deleted.', 403, {
      code: 'SYSTEM_ROLE_UNDELETABLE',
    });
  }

  // Soft delete — preserves history/auditability rather than
  // physically removing the record (master prompt section 84
  // principle applied to configuration data, not just clinical
  // data).
  role.isActive = false;

  await role.save();

  return role;
};

/**
 * Exported for BET-05 (user/staff role assignment) to reuse rather
 * than reimplement. Confirms the acting user is actually permitted,
 * by role hierarchy, to assign `targetRole` to someone — e.g. an
 * ADMIN cannot promote a user to DIRECTOR or SOFTWARE_OWNER.
 */
export const assertCanAssignRole = (actorRole, targetRole) => {
  if (!canManageRole(actorRole, targetRole)) {
    throw new AppError(
      'You are not permitted to assign this role.',
      403,
      { code: 'ROLE_ASSIGNMENT_NOT_PERMITTED' },
    );
  }
};
