/**
 * BET-18 — Google Drive backup.
 *
 * Same provider-abstraction / secrets-management posture BET-16
 * established for external integrations: `isGoogleDriveConfigured()`
 * is the only thing callers check before attempting an upload, and
 * credentials (`GOOGLE_DRIVE_CLIENT_ID/SECRET`, the long-lived
 * `GOOGLE_DRIVE_REFRESH_TOKEN`) are read only from `config/env.js`,
 * never persisted anywhere, never logged, never returned in an API
 * response.
 *
 * No `googleapis` dependency is installed in this project, so this
 * talks to Google's OAuth token endpoint and the Drive v3 upload
 * endpoint directly over `https` — two plain REST calls, not a
 * justification for a large SDK dependency. `refreshAccessToken`
 * exchanges the stored refresh token for a short-lived access token
 * on every call (Drive access tokens expire in ~1 hour; there is no
 * long-lived session to cache safely across requests in this
 * request-scoped backend), and `uploadBackupToGoogleDrive` performs
 * a standard RFC 2387 multipart upload (metadata part + binary part)
 * against `POST https://www.googleapis.com/upload/drive/v3/files`.
 */

import https from 'node:https';

import env from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

export const isGoogleDriveConfigured = () => {
  const { clientId, clientSecret, refreshToken } = env.googleDrive;
  return Boolean(clientId && clientSecret && refreshToken);
};

const requestJson = ({ hostname, path: reqPath, method, headers, body }) =>
  new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: reqPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Google API request failed (${res.statusCode}): ${raw.slice(0, 500)}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

const refreshAccessToken = async () => {
  const { clientId, clientSecret, refreshToken } = env.googleDrive;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }).toString();

  const response = await requestJson({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });

  if (!response?.access_token) {
    throw new Error('Google OAuth token refresh did not return an access token.');
  }

  return response.access_token;
};

/**
 * @param {{ buffer: Buffer, filename: string }} args
 * @returns {Promise<{ fileId: string, folderId: string }>}
 */
export const uploadBackupToGoogleDrive = async ({ buffer, filename }) => {
  if (!isGoogleDriveConfigured()) {
    throw new Error('Google Drive backup is not configured.');
  }

  const accessToken = await refreshAccessToken();
  const folderId = env.googleDrive.backupFolderId || null;

  const metadata = {
    name: filename,
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const boundary = `ashshafi-backup-${Date.now()}`;
  const metadataPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    'utf8',
  );
  const filePartHeader = Buffer.from(
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'utf8',
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, 'utf8');

  const body = Buffer.concat([metadataPart, filePartHeader, buffer, closing]);

  const result = await requestJson({
    hostname: 'www.googleapis.com',
    path: '/upload/drive/v3/files?uploadType=multipart&fields=id,parents',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    body,
  });

  if (!result?.id) {
    throw new Error('Google Drive upload did not return a file id.');
  }

  logger.info({ driveFileId: result.id }, 'BET-18 backup: uploaded to Google Drive');

  return { fileId: result.id, folderId: folderId || '' };
};

/**
 * Backup retention (BET-18) needs to remove the Drive copy too, not
 * just the local file — a copy left behind past its retention
 * window on external storage is exactly the kind of "controlled
 * deletion" gap master prompt §38/§84 warns about.
 */
export const deleteBackupFromGoogleDrive = async (fileId) => {
  if (!isGoogleDriveConfigured() || !fileId) return;

  const accessToken = await refreshAccessToken();

  await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'www.googleapis.com',
        path: `/drive/v3/files/${encodeURIComponent(fileId)}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      (res) => {
        // Drive returns 204 on success, 404 if already gone —
        // either is an acceptable outcome for a retention sweep.
        if (res.statusCode === 204 || res.statusCode === 404) {
          resolve();
        } else {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            reject(new Error(`Google Drive delete failed (${res.statusCode}): ${Buffer.concat(chunks).toString('utf8').slice(0, 300)}`)),
          );
          return;
        }
        res.resume();
      },
    );
    req.on('error', reject);
    req.end();
  });
};
