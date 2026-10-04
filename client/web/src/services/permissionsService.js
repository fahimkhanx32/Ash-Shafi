import apiClient from './apiClient.js';

/**
 * FET-05 — thin wrapper around `server/src/modules/permissions`
 * (`permissions:read`). Permissions themselves are a fixed,
 * code-defined catalog (not database records) — see
 * `permission.service.js` on the backend — so this is read-only.
 */
export const getPermissionCatalog = async () => {
  const { data } = await apiClient.get('/permissions');
  return data.data; // { permissions: string[], groups: [{ key, label, permissions }] }
};

export const getSystemRoleMatrix = async () => {
  const { data } = await apiClient.get('/permissions/role-matrix');
  return data.data; // [{ role, permissions: string[] }]
};
