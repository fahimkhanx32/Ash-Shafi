import apiClient from './apiClient.js';

/**
 * FET-20 — Backup Administration. Thin wrapper around the real,
 * already-complete `modules/backups` backend (BET-18,
 * `server/src/modules/backups/routes/backup.routes.js`, mounted at
 * `/api/v1/backups`). Every route there — and therefore every
 * function here — requires `SYSTEM_ADMIN` (today: SOFTWARE_OWNER,
 * SUPER_ADMIN only); calling any of these as another role 403s
 * regardless of what the UI shows.
 *
 * No client-side business logic, no mock data — each function is a
 * direct 1:1 call, same convention `rolesService.js`/`staffService.js`
 * already use.
 */

export const listBackups = async ({ status, page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/backups', {
    params: { ...(status ? { status } : {}), page, limit },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

export const getBackup = async (id) => {
  const { data } = await apiClient.get(`/backups/${id}`);
  return data.data;
};

// Trigger a backup right now. No fields required — see this
// project's own `triggerBackupSchema` (an empty JSON object body).
export const triggerBackup = async () => {
  const { data } = await apiClient.post('/backups', {});
  return data.data;
};

// Restore testing — always safe: restores into a disposable scratch
// database, never production. No confirmation dialog needed for this
// one on the frontend; the backend itself never touches live data.
export const runRestoreTest = async (id) => {
  const { data } = await apiClient.post(`/backups/${id}/restore-test`);
  return data.data;
};

/**
 * The one genuinely destructive call in this file. Backend requires
 * `password` + `confirm: true` + a written `reason` (min 10 chars) —
 * the same confirmation contract `data-lifecycle`'s purge already
 * established. This function does not soften or default any of
 * that; the caller (the restore dialog) must collect all three.
 */
export const restoreToProduction = async (id, { password, reason }) => {
  const { data } = await apiClient.post(`/backups/${id}/restore`, {
    password,
    confirm: true,
    reason,
  });
  return data.data;
};

export const purgeExpiredBackups = async () => {
  const { data } = await apiClient.post('/backups/retention/purge');
  return data.data;
};
