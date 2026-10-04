import apiClient from './apiClient.js';

/**
 * FET-21 — thin wrapper around the real backend import endpoint
 * (`server/src/modules/imports/routes/import.routes.js`, BET-19),
 * mounted at `/api/v1/imports`. No client-side parsing/validation of
 * the file's contents — the server is the sole authority on which
 * rows are valid (`patient-import.service.js`'s per-row Joi schema).
 * This file only uploads the raw file and returns the server's
 * per-row summary for `ImportTab.jsx` to render.
 */

/**
 * `POST /api/v1/imports/patients` — bulk patient import from a
 * `.csv`/`.xlsx` file, field name `file` (matches
 * `uploadSingle('file')` on the route).
 *
 * @returns {Promise<{
 *   totalRows: number,
 *   createdCount: number,
 *   failedCount: number,
 *   results: Array<{ rowNumber: number, status: 'CREATED'|'FAILED', patientId?: string, error?: string }>
 * }>}
 */
export const importPatients = async (file) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post('/imports/patients', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};
