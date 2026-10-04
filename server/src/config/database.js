import dns from 'node:dns/promises';
import mongoose from 'mongoose';

import env from './env.js';
import { logger } from './logger.js';

/**
 * MongoDB Database Configuration
 *
 * Responsibilities:
 * - Configure DNS resolvers for MongoDB SRV resolution.
 * - Establish a pooled Mongoose connection, retrying transient
 *   startup failures with backoff (BET-23 — Recovery procedures).
 * - Reuse an existing connection.
 * - Expose connection status, including a real live-ping health
 *   check (BET-23 — Database health), not just the cached
 *   `readyState` flag.
 * - Gracefully disconnect.
 *
 * Secrets are never logged.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Configure DNS resolvers.
 *
 * Cloud-hosted MongoDB SRV records can occasionally encounter
 * local DNS resolver problems. Using the configured resolvers
 * gives the application a predictable DNS configuration.
 */
dns.setServers([
  env.database.dnsPrimary,
  env.database.dnsSecondary,
]);

let connectionPromise = null;

/**
 * MongoDB connection options.
 *
 * These are deliberately defined here rather than scattered
 * throughout the application.
 */
const mongooseOptions = {
  dbName: env.database.name,

  // BET-23 — Query optimization / production readiness.
  //
  // Mongoose's default (`autoIndex: true`) builds every schema-declared
  // index on every connection, including in production. On a
  // multi-collection app like this one (39 models, several with
  // compound/text indexes) that means every deploy/restart pays an
  // index-build cost against the live cluster, and — worse — a
  // background index build can compete with production traffic for
  // the same collection locks. The standard production pattern is to
  // disable automatic index builds and create indexes explicitly via
  // a controlled script (`npm run indexes`, `src/database/indexes.js`,
  // expanded this session to cover every registered model) as part of
  // the deploy pipeline, run against a maintenance window or with
  // `background: true` semantics under operator control — not
  // implicitly on every process boot.
  autoIndex: env.app.nodeEnv !== 'production',

  // Connection pool.
  maxPoolSize: 20,
  minPoolSize: 5,

  // Connection timeouts.
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,

  // MongoDB retryable writes.
  retryWrites: true,

  // Prefer IPv4 for broad compatibility.
  family: 4,
};

/**
 * Attempt a single MongoDB connection (no retry logic here — that
 * lives in `connectDatabase` below, which is the only exported entry
 * point and the only thing that should ever call this).
 *
 * @returns {Promise<mongoose.Connection>}
 */
const attemptConnect = async () => {
  const mongooseInstance = await mongoose.connect(
    env.database.uri,
    mongooseOptions,
  );

  logger.info(
    { database: mongooseInstance.connection.name },
    'MongoDB connected successfully.',
  );

  return mongooseInstance.connection;
};

/**
 * Connect to MongoDB, retrying transient startup failures with
 * exponential backoff (BET-23 — Recovery procedures).
 *
 * A cloud-hosted cluster can be unreachable for a few seconds at the
 * exact moment this process boots (DNS not yet warm, a rolling
 * maintenance window on the cluster, a brief network blip) without
 * that meaning anything is actually broken. Failing fatally on the
 * very first attempt turns a self-recovering blip into an
 * unnecessary crash-loop. `env.database.connectRetryAttempts`
 * (default 5) controls how many *additional* attempts are made
 * beyond the first before this function finally rejects and lets the
 * caller (`server.js`) exit non-zero — at which point the process
 * manager's own restart policy takes over (see
 * docs/reliability/RECOVERY_PROCEDURES.md). Set
 * `DB_CONNECT_RETRY_ATTEMPTS=0` to fail immediately instead, e.g. in
 * CI where a missing/misconfigured DB should surface as fast as
 * possible.
 *
 * @returns {Promise<mongoose.Connection>}
 */
export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (!env.database.uri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  const maxAttempts = env.database.connectRetryAttempts + 1;

  connectionPromise = (async () => {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await attemptConnect();
      } catch (error) {
        lastError = error;

        const isLastAttempt = attempt === maxAttempts;

        logger.error(
          {
            attempt,
            maxAttempts,
            err: { message: error.message, name: error.name },
          },
          isLastAttempt
            ? 'MongoDB connection failed; no attempts remaining.'
            : 'MongoDB connection attempt failed; retrying.',
        );

        if (isLastAttempt) {
          break;
        }

        // Exponential backoff: delay, 2*delay, 4*delay, ... capped so
        // a large retry-attempt count never produces an unreasonably
        // long single wait.
        const backoffMs = Math.min(
          env.database.connectRetryDelayMs * 2 ** (attempt - 1),
          30_000,
        );

        await sleep(backoffMs);
      }
    }

    connectionPromise = null;

    throw lastError;
  })();

  return connectionPromise;
};

/**
 * Disconnect from MongoDB gracefully.
 *
 * @returns {Promise<void>}
 */
export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.disconnect();

    connectionPromise = null;

    logger.info('MongoDB disconnected gracefully.');
  } catch (error) {
    logger.error(
      { err: { message: error.message, name: error.name } },
      'MongoDB graceful disconnect failed.',
    );

    throw error;
  }
};

/**
 * Get current database connection status.
 *
 * @returns {{
 *   state: string,
 *   readyState: number,
 *   host: string|null,
 *   database: string|null
 * }}
 */
export const getDatabaseStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    state:
      states[mongoose.connection.readyState] ?? 'unknown',

    readyState: mongoose.connection.readyState,

    host:
      mongoose.connection.host || null,

    database:
      mongoose.connection.name || null,
  };
};

/**
 * Live database health check (BET-23 — Database health).
 *
 * `getDatabaseStatus()` below only reflects Mongoose's cached
 * `readyState` — it can briefly lag reality (e.g. a half-open TCP
 * connection that hasn't yet fired Mongoose's own 'disconnected'
 * event) and says nothing about whether the *server itself* is
 * actually able to service commands. This issues a real `ping`
 * admin command against the current connection and bounds how long
 * it's allowed to hang, so `GET /health/ready` (BET-02/23) reports a
 * true dependency check rather than a cached flag, and never itself
 * hangs waiting on a database that isn't responding.
 *
 * @returns {Promise<{ healthy: boolean, latencyMs: number|null, error: string|null }>}
 */
export const pingDatabase = async () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      healthy: false,
      latencyMs: null,
      error: 'Not connected.',
    };
  }

  const startedAt = Date.now();

  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_resolve, reject) => {
        setTimeout(
          () => reject(new Error('Database ping timed out.')),
          env.database.healthPingTimeoutMs,
        );
      }),
    ]);

    return {
      healthy: true,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - startedAt,
      error: error.message,
    };
  }
};

/**
 * MongoDB event listeners.
 *
 * These do not expose credentials or connection strings.
 */
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established.');
});

mongoose.connection.on('disconnected', () => {
  connectionPromise = null;
  logger.warn('MongoDB connection disconnected.');
});

// Mongoose's underlying driver reconnects automatically on a dropped
// connection (no manual reconnect loop needed here) — these two
// events exist purely so that recovery is visible in the logs rather
// than silent, per this checkpoint's "recovery procedures should be
// observable" goal.
mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB connection re-established after a disconnect.');
});

mongoose.connection.on('reconnectFailed', () => {
  logger.error(
    'MongoDB gave up attempting to reconnect (driver-level retries exhausted).',
  );
});

mongoose.connection.on('error', (error) => {
  logger.error(
    { err: { message: error.message, name: error.name } },
    'MongoDB runtime error.',
  );
});