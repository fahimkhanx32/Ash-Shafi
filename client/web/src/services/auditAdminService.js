import apiClient from './apiClient.js';

/**
 * FET-20 — Audit Administration, checkpoint 1: Audit log, User
 * activity, Administrative activity.
 *
 * Thin wrapper around the real, already-complete
 * `modules/audit-logs` admin viewer (`GET /api/v1/audit-logs`,
 * `AUDIT_READ`-gated server-side — see
 * `server/src/modules/audit-logs/routes/audit-log.routes.js`). No
 * backend changes were needed for this checkpoint: `category` was
 * already a filterable field, and `USER_ACTION`/
 * `ADMINISTRATIVE_ACTION` were already two of the real
 * `AUDIT_CATEGORIES` values (`server/src/audit/audit.model.js`) —
 * "User activity" and "Administrative activity" are simply this
 * same endpoint with `category` fixed client-side, the identical
 * pattern `SecurityEventsSection.jsx` already established for
 * "Security events" vs "Authentication events".
 *
 * Deliberately does not yet wrap `GET /audit-logs/:id` for
 * "Sensitive-record access"/"File access" — see the checkpoint 4
 * note below on why.
 *
 * Checkpoint 2 adds `listSensitiveRecordAccess` and `listFileAccess`
 * below, wrapping the two new admin-viewer endpoints built this
 * checkpoint (`GET /audit-logs/sensitive-record-access`,
 * `GET /audit-logs/file-access`) for the "Sensitive-record access"
 * and "File access" bullets. "Clinical record access" needed no new
 * endpoint — it is `listAuditLogs` above with `category:
 * 'CLINICAL_ACCESS'`, the same general trail "Audit log"/"User
 * activity"/"Administrative activity" already read.
 *
 * Checkpoint 4 adds `getAuditLogById`, wrapping
 * `GET /audit-logs/:id` for "Audit details" — that route (and its
 * backing `getAuditLogById` service function) was already complete
 * server-side since checkpoint 1 ("FET-20 prerequisite backend" in
 * its own comment), just never called from the frontend until now.
 * Scoped to the general `AuditLog` collection only — "Sensitive-
 * record access"/"File access" rows are already shown unabbreviated
 * inline (no truncated `resourceId` to expand), and neither
 * collection has a single-entry endpoint yet.
 */

export const listAuditLogs = async ({
  actor,
  actorRole,
  category,
  action,
  resourceType,
  resourceId,
  patientId,
  outcome,
  search,
  from,
  to,
  page = 1,
  limit = 20,
} = {}) => {
  const { data } = await apiClient.get('/audit-logs', {
    params: {
      ...(actor ? { actor } : {}),
      ...(actorRole ? { actorRole } : {}),
      ...(category ? { category } : {}),
      ...(action ? { action } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(resourceId ? { resourceId } : {}),
      ...(patientId ? { patientId } : {}),
      ...(outcome ? { outcome } : {}),
      ...(search ? { search } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page,
      limit,
    },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

export const listSensitiveRecordAccess = async ({
  actor,
  actorRole,
  patientId,
  action,
  outcome,
  from,
  to,
  page = 1,
  limit = 20,
} = {}) => {
  const { data } = await apiClient.get('/audit-logs/sensitive-record-access', {
    params: {
      ...(actor ? { actor } : {}),
      ...(actorRole ? { actorRole } : {}),
      ...(patientId ? { patientId } : {}),
      ...(action ? { action } : {}),
      ...(outcome ? { outcome } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page,
      limit,
    },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};

export const getAuditLogById = async (id) => {
  const { data } = await apiClient.get(`/audit-logs/${id}`);
  return data.data;
};

export const listFileAccess = async ({
  actor,
  actorRole,
  patientId,
  reportId,
  action,
  outcome,
  from,
  to,
  page = 1,
  limit = 20,
} = {}) => {
  const { data } = await apiClient.get('/audit-logs/file-access', {
    params: {
      ...(actor ? { actor } : {}),
      ...(actorRole ? { actorRole } : {}),
      ...(patientId ? { patientId } : {}),
      ...(reportId ? { reportId } : {}),
      ...(action ? { action } : {}),
      ...(outcome ? { outcome } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page,
      limit,
    },
  });
  return { items: data.data || [], pagination: data.meta?.pagination };
};
