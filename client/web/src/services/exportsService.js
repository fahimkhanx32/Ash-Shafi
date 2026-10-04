import apiClient from './apiClient.js';

/**
 * FET-21 — thin wrapper around the real backend export endpoints
 * (`server/src/modules/exports/routes/export.routes.js`, BET-19),
 * mounted at `/api/v1/exports`. No client-side file generation of
 * any kind — every CSV/XLSX/PDF/JSON byte comes from the server;
 * this file only triggers the request and hands the response's
 * blob + real filename back to the caller for a browser download.
 */

const EXTENSION_BY_FORMAT = { CSV: 'csv', XLSX: 'xlsx', PDF: 'pdf', JSON: 'json' };

/**
 * Pulls the real filename the server chose out of
 * `Content-Disposition: attachment; filename="..."` rather than
 * guessing one client-side — falls back to a reasonable default only
 * if that header is ever missing (shouldn't happen; every export
 * controller sets it).
 */
const filenameFromDisposition = (headers, fallback) => {
  const disposition = headers?.['content-disposition'];
  const match = disposition && /filename="?([^"]+)"?/i.exec(disposition);
  return match ? match[1] : fallback;
};

/** Triggers an actual browser "Save file" for an already-fetched blob. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick — some browsers need the click to fully
  // process before the object URL is safe to free.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * `GET /api/v1/exports/:entityType?format=...` — checkpoint 1, bulk
 * tabular export. `filters` is passed straight through as query
 * params (see `constants/dataTools.js`'s `EXPORT_ENTITY_FILTER_FIELDS`
 * for which keys a given entity type actually uses). Returns the raw
 * `{blob, filename, recordCount}` rather than saving it itself, so
 * the caller (`ExportTab.jsx`) can show a confirmation/record-count
 * toast before or after the save.
 */
export const exportEntityTabular = async (entityType, format, filters = {}) => {
  const response = await apiClient.get(`/exports/${entityType}`, {
    params: { format, ...filters },
    responseType: 'blob',
  });
  const filename = filenameFromDisposition(
    response.headers,
    `${entityType.toLowerCase()}-export.${EXTENSION_BY_FORMAT[format] || 'dat'}`,
  );
  const recordCount = Number(response.headers?.['x-export-record-count'] ?? 0);
  return { blob: response.data, filename, recordCount };
};

/**
 * `POST /api/v1/exports/patients/:patientProfileId/medical-record` —
 * checkpoint 2, "Medical-record export". Deliberately does not
 * return file bytes (the backend never sends them on this response,
 * see the controller's own docstring) — only the single-use,
 * time-limited download token/URL. The caller must follow up with
 * `downloadControlledExport` (or a plain link to `downloadUrl`) to
 * actually retrieve the file.
 */
export const requestMedicalRecordExport = async (patientProfileId, format = 'PDF') => {
  const { data } = await apiClient.post(`/exports/patients/${patientProfileId}/medical-record`, {
    format,
  });
  return data.data; // { downloadToken, downloadUrl, format, filename, sizeBytes, expiresAt }
};

/**
 * `GET /api/v1/exports/download/:token` — deliberately unauthenticated
 * on the backend (the token itself is the credential — see that
 * route's own comment), but calling it through `apiClient` is still
 * correct and harmless: the interceptor will attach a bearer token
 * if one exists, which the backend route simply ignores since it
 * never reads `req.user`. Single-use — a second call with the same
 * token will fail with an expired/consumed error, by design.
 */
export const downloadControlledExport = async (token, fallbackFilename = 'medical-record') => {
  const response = await apiClient.get(`/exports/download/${token}`, { responseType: 'blob' });
  const filename = filenameFromDisposition(response.headers, fallbackFilename);
  return { blob: response.data, filename };
};
