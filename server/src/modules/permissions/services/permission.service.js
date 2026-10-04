import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_HIERARCHY,
  getRolePermissions,
} from '../../../security/permissions.js';

/**
 * BET-04 — Permission catalog.
 *
 * Permissions themselves are NOT database records — they are a
 * fixed, code-defined catalog (`security/permissions.js`), the same
 * way route names are fixed by code rather than data. This keeps
 * enforcement (`hasPermission` / `authorize`) simple, synchronous,
 * and impossible to break by an admin accidentally deleting a
 * permission a live authorization check depends on.
 *
 * What BET-04 makes data-driven instead is *roles* (see
 * `role.service.js`) — an administrator can define a **custom role**
 * as a named subset of this fixed permission catalog.
 */

export const getPermissionCatalog = () => {
  return {
    permissions: Object.values(PERMISSIONS),
    groups: PERMISSION_GROUPS,
  };
};

export const getSystemRolePermissionMatrix = () => {
  return ROLE_HIERARCHY.map((role) => ({
    role,
    permissions: getRolePermissions(role),
  }));
};
