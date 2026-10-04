import { io } from 'socket.io-client';

import { tokenStorage, getApiBaseUrl } from './apiClient.js';

/**
 * FET-12/13/14 — thin client-side wrapper around the real-time layer
 * `server/src/socket/index.js` already exposes (BET-13/BET-14). One
 * singleton connection per browser tab, authenticated with the same
 * JWT access token every REST call already uses (no separate
 * socket-specific credential — mirrors the server's own design
 * decision, see that file's docstring).
 *
 * Deliberately does not perform any write over the socket — every
 * mutation (sending a message, marking read, creating/joining a video
 * session) still goes through the authenticated REST services
 * (`messagingService.js`/`videoCallsService.js`), exactly as the
 * server module documents. This file only opens the connection and
 * lets callers subscribe/emit the specific realtime events the
 * server actually supports (`conversation:join`, `typing:*`,
 * `video:join`, `video:signal`, `video:leave`).
 *
 * The API server URL doubles as the socket URL (both live on the
 * same Express+http server per `server/src/server.js`) — derived by
 * stripping the `/api/v1` suffix from `getApiBaseUrl()`, never
 * hardcoded, per this project's existing "no hardcoded localhost"
 * convention (see `apiClient.js`).
 */

const getSocketUrl = () => getApiBaseUrl().replace(/\/api\/v1\/?$/, '');

let socket = null;

/**
 * Returns the live connection, creating it on first call. Safe to
 * call repeatedly — subsequent calls return the same instance rather
 * than opening a second connection.
 */
export const getSocket = () => {
  const token = tokenStorage.getAccessToken();

  if (!token) return null;

  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  } else {
    // A previously-created socket with a now-stale token (e.g. after
    // a token refresh) needs the new one before reconnecting.
    socket.auth = { token };
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

/** Tears down the connection entirely — call on logout. */
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export default getSocket;
