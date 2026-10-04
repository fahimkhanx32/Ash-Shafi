import http from 'http';

import app from './app.js';
import env from './config/env.js';
import { logger } from './config/logger.js';
import {
  connectDatabase,
  disconnectDatabase,
} from './config/database.js';
import {
  connectRedis,
  disconnectRedis,
} from './config/redis.js';
import { ensureSystemRolesSeeded } from './modules/roles/services/role.service.js';
import { ensureBuiltInSectionsSeeded } from './modules/cms/services/dynamic-site.service.js';
import { initializeSocket, getIo } from './socket/index.js';

const server = http.createServer(app);

// BET-13 — Socket.IO attaches to the same HTTP server/port as the
// REST API (no separate port/process). Initialized unconditionally
// at module load (not deferred until after `connectDatabase()`
// below) so `getIo()` always returns a live instance once the
// process is up, the same way `app` itself is available immediately.
initializeSocket(server);

const startServer = async () => {
  try {
    await connectDatabase();

    // Idempotent read-side projection of the fixed system roles into
    // the `roles` collection (BET-04). Deliberately non-fatal: the
    // in-memory role/permission enforcement in
    // `security/permissions.js` works regardless of whether this
    // succeeds, so a transient DB hiccup here must never block the
    // API from starting.
    try {
      await ensureSystemRolesSeeded();
    } catch (error) {
      logger.warn(
        { err: { message: error.message, name: error.name } },
        'Failed to sync system roles at startup; continuing anyway.',
      );
    }

    // FET-16 — idempotently ensures the five built-in homepage section
    // rows (hero/services/certificates/stats/about) exist so the public
    // site has a sensible default layout before an admin has ever
    // visited the dashboard. Same non-fatal treatment as role seeding
    // above: a transient DB hiccup here must never block the API from
    // starting, and it's a no-op on every subsequent boot once seeded.
    try {
      await ensureBuiltInSectionsSeeded();
    } catch (error) {
      logger.warn(
        { err: { message: error.message, name: error.name } },
        'Failed to seed built-in homepage sections at startup; continuing anyway.',
      );
    }

    await connectRedis();

    server.listen(env.app.port, () => {
      logger.info(
        {
          port: env.app.port,
          environment: env.app.nodeEnv,
          healthCheck: `${env.app.serverUrl}/health`,
        },
        `Ash-Shāfī API running on port ${env.app.port}.`,
      );
    });
  } catch (error) {
    logger.fatal(
      { err: { message: error.message, name: error.name, stack: error.stack } },
      'Server startup failed.',
    );

    try {
      await disconnectRedis();
    } catch (redisError) {
      logger.error(
        { err: { message: redisError.message } },
        'Error while closing Redis during failed-startup cleanup.',
      );
    }

    try {
      await disconnectDatabase();
    } catch (databaseError) {
      logger.error(
        { err: { message: databaseError.message } },
        'Error while closing database during failed-startup cleanup.',
      );
    }

    process.exit(1);
  }
};

/**
 * Graceful shutdown (BET-23 — Graceful shutdown / Recovery
 * procedures).
 *
 * Order matters:
 * 1. Stop accepting new HTTP connections (`server.close()`) and new
 *    Socket.IO connections, while letting requests already in flight
 *    finish naturally.
 * 2. Once the server has actually finished draining, close Redis and
 *    MongoDB.
 * 3. Exit 0.
 *
 * Two failure modes this guards against that the original bare
 * `server.close(callback)` did not:
 * - **A signal arriving twice** (e.g. an impatient double Ctrl-C, or
 *   an orchestrator sending SIGTERM followed by SIGKILL's precursor
 *   signal on some platforms) previously re-entered this whole
 *   function a second time, racing two independent
 *   disconnect+process.exit sequences against each other. A module-
 *   level flag makes every signal after the first a no-op.
 * - **`server.close()`'s callback never firing** — normally caused by
 *   a client holding a keep-alive connection open indefinitely, or
 *   (rarer) a hung disconnect call inside the callback itself. Either
 *   way, an orchestrator that already stopped routing traffic to this
 *   instance (because a `SIGTERM` was sent) would otherwise wait on a
 *   process that never exits and never restarts. `env.app.shutdownTimeoutMs`
 *   (default 10s) bounds the entire shutdown sequence; past it, this
 *   forces `process.exit(1)` regardless of what's still in flight.
 */
let shuttingDown = false;

const shutdown = async (reason) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info({ reason }, `${reason} received. Shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error(
      { timeoutMs: env.app.shutdownTimeoutMs },
      'Graceful shutdown did not complete in time; forcing exit.',
    );

    process.exit(1);
  }, env.app.shutdownTimeoutMs);

  // A timer that only exists to force-exit the process should never
  // itself be the reason the process stays alive.
  forceExitTimer.unref();

  try {
    // Stop accepting new Socket.IO connections/rooms before the HTTP
    // server stops accepting new connections, so no new socket
    // handshake can complete after this point.
    const io = getIo();

    if (io) {
      await new Promise((resolve) => io.close(() => resolve()));
    }

    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    await disconnectRedis();
    await disconnectDatabase();

    clearTimeout(forceExitTimer);

    logger.info('Server shutdown complete.');

    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);

    logger.error(
      { err: { message: error.message, name: error.name, stack: error.stack } },
      'Error during graceful shutdown.',
    );

    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/**
 * Last-resort process-level safety nets (BET-23 — Graceful shutdown /
 * Recovery procedures).
 *
 * Neither of these existed before this checkpoint, which meant an
 * uncaught synchronous throw or an unhandled promise rejection
 * anywhere in the process (including in a `setImmediate`/timer
 * callback with no request context to catch it) would either crash
 * the process with a bare stack trace on stderr and no structured
 * log entry, or — for an unhandled rejection specifically, depending
 * on Node version/flags — sometimes not crash it at all, leaving the
 * process running in a potentially inconsistent state indefinitely.
 * Both cases are logged with full context and then routed through
 * the same graceful-shutdown path above (not a bare `process.exit()`)
 * so in-flight requests still get a chance to finish and the database/
 * Redis connections still close cleanly — but the shutdown is still
 * time-bounded by the same force-exit timer, in case the error that
 * triggered this left something in a state that can't drain cleanly.
 *
 * This is deliberately fail-*stopped*, not fail-open: Node's own
 * documentation recommends against trying to resume normal operation
 * after an uncaught exception, since arbitrary in-process state may
 * now be inconsistent. A process manager (PM2/systemd/Docker restart
 * policy — see docs/reliability/RECOVERY_PROCEDURES.md) is expected
 * to bring a fresh process back up immediately after.
 */
process.on('uncaughtException', (error) => {
  logger.fatal(
    { err: { message: error.message, name: error.name, stack: error.stack } },
    'Uncaught exception. Shutting down.',
  );

  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));

  logger.fatal(
    { err: { message: error.message, name: error.name, stack: error.stack } },
    'Unhandled promise rejection. Shutting down.',
  );

  shutdown('unhandledRejection');
});

startServer();
