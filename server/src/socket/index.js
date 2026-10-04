import { Server } from 'socket.io';

import env from '../config/env.js';
import { logger } from '../config/logger.js';
import { corsOptions } from '../config/cors.js';
import { verifyAccessToken } from '../security/tokens.js';
import { User } from '../users/user.model.js';

/**
 * Real-time layer (BET-13, master prompt §29/§30/§43).
 *
 * `socket.io` was an installed-but-unwired dependency until this
 * task (see `SESSION_HANDOFF.md`'s Current Architecture note). This
 * module is the only place that creates/owns the `Server` instance.
 *
 * Design decisions:
 * - Every write (sending a message, marking read, creating a
 *   notification) still happens over the existing authenticated REST
 *   API, exactly like every other module in this project — never
 *   over a raw socket event. This module exists purely to *push*
 *   already-authorized state changes to connected clients in real
 *   time (`message:new`, `message:read`, `notification:new`) and to
 *   relay two genuinely ephemeral, non-persisted signals (typing
 *   start/stop). This avoids building and maintaining a second,
 *   parallel authorization/validation path for the same writes the
 *   REST controllers already handle correctly (master prompt §80 —
 *   "never trust frontend authentication state" applies equally to a
 *   socket transport as it does to HTTP).
 * - The handshake is authenticated with the same JWT access token the
 *   REST API already uses (`security/tokens.js#verifyAccessToken`) —
 *   no separate socket-specific credential. A connection is rejected
 *   outright if the token is missing/invalid/expired or the account
 *   is not `ACTIVE`.
 * - Every authenticated socket automatically joins a personal room
 *   (`user:<userId>`) so any server-side code can push a targeted
 *   event to a specific user without needing to track socket ids
 *   itself (`getIo().to(userRoom(userId)).emit(...)`).
 * - Joining a *conversation* room (`conversation:<conversationId>`)
 *   is a deliberate, explicit client action (`conversation:join`)
 *   that re-verifies conversation membership server-side on every
 *   join — a client cannot simply guess/enumerate a conversation id
 *   and start receiving its events (master prompt §30 — "do not
 *   trust IDs supplied by the client").
 */

let ioInstance = null;

export const userRoom = (userId) => `user:${userId}`;

export const conversationRoom = (conversationId) => `conversation:${conversationId}`;

// BET-14 — video-call signaling room, keyed by `VideoSession.roomId`
// (an opaque, unguessable identifier — never the appointment id or
// the session's own `_id`, per the model's docstring), not the
// session id itself.
export const videoRoom = (roomId) => `video:${roomId}`;

const extractToken = (socket) => {
  const fromAuth = socket.handshake.auth?.token;

  if (typeof fromAuth === 'string' && fromAuth.trim()) {
    return fromAuth.trim();
  }

  const header = socket.handshake.headers?.authorization;

  if (typeof header === 'string') {
    const [scheme, token] = header.trim().split(/\s+/);

    if (scheme === 'Bearer' && token) {
      return token;
    }
  }

  return null;
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = extractToken(socket);

    if (!token) {
      return next(new Error('Authentication required.'));
    }

    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(new Error('Invalid or expired access token.'));
    }

    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      return next(new Error('Invalid access token.'));
    }

    const user = await User.findById(payload.sub);

    if (!user) {
      return next(new Error('User account not found.'));
    }

    if (user.status !== 'ACTIVE') {
      return next(new Error('This account is not active.'));
    }

    socket.user = {
      _id: user._id,
      role: user.role,
      name: user.name,
    };

    return next();
  } catch (error) {
    logger.error({ err: error }, 'Socket authentication failed unexpectedly.');

    return next(new Error('Authentication failed.'));
  }
};

/**
 * Registers the connection-scoped event handlers. Kept as a named,
 * exported function (rather than inlined into `initializeSocket`) so
 * a future test can exercise the handler logic against a mocked
 * socket without needing a live server — the same testability
 * concern documented throughout this project's `tests/unit/`.
 */
export const registerConnectionHandlers = (io, socket) => {
  socket.join(userRoom(socket.user._id));

  socket.on('conversation:join', async (payload, ack) => {
    try {
      const conversationId = payload?.conversationId;

      if (!conversationId) {
        return typeof ack === 'function' && ack({ ok: false, reason: 'MISSING_CONVERSATION_ID' });
      }

      // Deliberately re-imported inline (not at module top level) to
      // avoid a circular import: `modules/messaging/services/*`
      // imports `getIo()` from this file to push events, and this
      // file would otherwise need to import back into
      // `modules/messaging` just for this one membership check.
      const { assertIsConversationParticipantById } = await import(
        '../modules/messaging/services/conversation-access.service.js'
      );

      await assertIsConversationParticipantById(conversationId, socket.user._id);

      socket.join(conversationRoom(conversationId));

      return typeof ack === 'function' && ack({ ok: true });
    } catch (error) {
      logger.warn(
        { err: error, userId: socket.user._id },
        'Rejected conversation:join — not a participant or conversation not found.',
      );

      return typeof ack === 'function' && ack({ ok: false, reason: 'FORBIDDEN' });
    }
  });

  socket.on('conversation:leave', (payload) => {
    const conversationId = payload?.conversationId;

    if (conversationId) {
      socket.leave(conversationRoom(conversationId));
    }
  });

  // Ephemeral only — never persisted, never audited (matches every
  // other WhatsApp-style chat's typing-indicator behavior). The
  // server does not re-verify membership here beyond "is this socket
  // currently in the room" (enforced by `conversation:join` above) —
  // broadcasting to a room the sender isn't in has no effect.
  socket.on('typing:start', (payload) => {
    const conversationId = payload?.conversationId;

    if (conversationId) {
      socket.to(conversationRoom(conversationId)).emit('typing:start', {
        conversationId,
        userId: socket.user._id,
      });
    }
  });

  // BET-14 — Video Consultation signaling (master prompt §32).
  //
  // Every write (session creation, join-token issuance, participant
  // joined/left/ended state) still happens over the authenticated
  // REST API (`modules/video-calls`), exactly like messaging above —
  // this handler only admits an already-REST-authorized participant
  // into the signaling room and relays the two genuinely ephemeral,
  // non-persisted SDP/ICE payloads peers need to establish a direct
  // WebRTC connection (`native-webrtc.provider.js` — media itself
  // never touches this server).
  //
  // `token` must be the plaintext join credential returned by
  // `POST /video-calls/sessions/:id/join` — presenting the matching
  // hash is deliberate defense-in-depth on top of the socket already
  // being authenticated with the same JWT the REST API uses (master
  // prompt §80). Single-use: `joinCredential.usedAt` is stamped on
  // first successful use and rejected on any replay.
  socket.on('video:join', async (payload, ack) => {
    try {
      const sessionId = payload?.sessionId;
      const token = payload?.token;

      if (!sessionId || !token) {
        return typeof ack === 'function' && ack({ ok: false, reason: 'MISSING_PARAMS' });
      }

      // Inline imports for the same circular-import reason documented
      // on `conversation:join` above.
      const { assertIsSessionParticipantById } = await import(
        '../modules/video-calls/services/video-access.service.js'
      );
      const { hashToken } = await import('../security/tokens.js');

      const session = await assertIsSessionParticipantById(sessionId, socket.user._id);

      const entry = session.participants.find((p) => String(p.user) === String(socket.user._id));
      const credential = entry?.joinCredential;

      const tokenIsValid =
        entry &&
        credential?.tokenHash &&
        !credential.usedAt &&
        credential.expiresAt &&
        credential.expiresAt.getTime() >= Date.now() &&
        credential.tokenHash === hashToken(token);

      if (!tokenIsValid) {
        return typeof ack === 'function' && ack({ ok: false, reason: 'INVALID_OR_EXPIRED_TOKEN' });
      }

      entry.joinCredential.usedAt = new Date();
      await session.save();

      const room = videoRoom(session.roomId);
      socket.join(room);
      socket.data.videoRooms = socket.data.videoRooms || new Set();
      socket.data.videoRooms.add(room);

      socket.to(room).emit('video:participant-connected', { userId: socket.user._id });

      return typeof ack === 'function' && ack({ ok: true, roomId: session.roomId });
    } catch (error) {
      logger.warn(
        { err: error, userId: socket.user._id },
        'Rejected video:join — not a participant, session not found, or invalid token.',
      );

      return typeof ack === 'function' && ack({ ok: false, reason: 'FORBIDDEN' });
    }
  });

  // Relays an SDP offer/answer or ICE candidate to the other peer in
  // the same signaling room. `roomId` must be a room this socket has
  // actually joined via `video:join` above — otherwise silently
  // dropped rather than trusted (master prompt §80: never trust a
  // client-supplied room id as an authorization boundary).
  socket.on('video:signal', (payload) => {
    const roomId = payload?.roomId;
    const data = payload?.data;

    if (!roomId || !data) return;

    const room = videoRoom(roomId);
    if (!socket.rooms.has(room)) return;

    socket.to(room).emit('video:signal', { from: socket.user._id, data });
  });

  socket.on('video:leave', (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) return;

    const room = videoRoom(roomId);
    socket.leave(room);
    socket.data.videoRooms?.delete(room);
    socket.to(room).emit('video:participant-disconnected', { userId: socket.user._id });
  });

  socket.on('typing:stop', (payload) => {
    const conversationId = payload?.conversationId;

    if (conversationId) {
      socket.to(conversationRoom(conversationId)).emit('typing:stop', {
        conversationId,
        userId: socket.user._id,
      });
    }
  });
};

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    path: env.socket.path,
    cors: {
      origin: corsOptions.origin,
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info({ userId: socket.user._id }, 'Socket connected.');

    registerConnectionHandlers(io, socket);

    socket.on('disconnect', () => {
      // BET-14 — best-effort presence notice only, never a DB write:
      // an abrupt network drop should let the remaining peer know the
      // signaling connection dropped, but the authoritative
      // `leaveSession` state change stays a REST call the reconnecting
      // client (or the doctor ending the call) makes explicitly — same
      // "writes happen over REST, sockets only push" rule this file's
      // header already documents for messaging.
      if (socket.data.videoRooms?.size) {
        for (const room of socket.data.videoRooms) {
          socket.to(room).emit('video:participant-disconnected', { userId: socket.user._id });
        }
      }

      logger.info({ userId: socket.user._id }, 'Socket disconnected.');
    });
  });

  ioInstance = io;

  return io;
};

/**
 * Returns the live `Server` instance so REST controllers/services can
 * push events after a successful write. Returns `null` if sockets
 * haven't been initialized (e.g. under `supertest`, which exercises
 * `app.js` directly without booting `server.js`) — every caller must
 * treat a push as best-effort, never a requirement for the request
 * to succeed.
 */
export const getIo = () => ioInstance;
