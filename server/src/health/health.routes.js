import express from 'express';
import mongoose from 'mongoose';

import env from '../config/env.js';
import { getDatabaseStatus, pingDatabase } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import { getMetricsSnapshot } from '../monitoring/metrics.service.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../security/permissions.js';

/**
 * Dedicated health-check router (BET-02, extended BET-23).
 *
 * - GET /health          liveness probe: process is up, always 200
 *                         as long as the event loop can respond.
 * - GET /health/ready     readiness probe: verifies the database
 *                         (and Redis, if enabled) are actually
 *                         reachable — including a real `ping` admin
 *                         command against MongoDB (BET-23), not just
 *                         Mongoose's cached `readyState`, which can
 *                         briefly lag a genuinely stalled connection.
 *                         Returns 503 when a required dependency is
 *                         down, so orchestrators (Docker/K8s/PM2) can
 *                         avoid routing traffic to an instance that
 *                         cannot serve requests.
 * - GET /health/metrics   BET-23 — admin-only (`system:admin`, the
 *                         same permission `modules/backups`/
 *                         `modules/data-lifecycle` already gate on)
 *                         snapshot of in-process request volume,
 *                         error rate, latency percentiles, and
 *                         memory usage. Not exposed publicly — this
 *                         is operational data, not something an
 *                         unauthenticated caller (or even an
 *                         ordinary authenticated user) needs, and it
 *                         reveals internal route/traffic shape that
 *                         shouldn't be handed to arbitrary callers.
 */

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Ash-Shāfī API is healthy.',
    environment: env.app.nodeEnv,
    version: env.app.version,
    uptimeSeconds: Math.floor(process.uptime()),
    requestId: req.requestId,
  });
});

router.get('/health/ready', async (req, res) => {
  const status = getDatabaseStatus();

  // BET-23 — Database health. `readyState === connected` only means
  // Mongoose *believes* the socket is up; it does not confirm the
  // server is actually responding to commands right now. A bounded
  // live ping catches the gap (e.g. a half-dead TCP connection that
  // hasn't yet triggered Mongoose's own 'disconnected' event) without
  // risking this endpoint hanging if the database itself is the thing
  // that's stuck — `pingDatabase()` times out on its own.
  const ping =
    status.readyState === mongoose.ConnectionStates.connected
      ? await pingDatabase()
      : { healthy: false, latencyMs: null, error: 'Not connected.' };

  const database = { ...status, ping };
  const databaseHealthy = ping.healthy;

  let redis = { enabled: env.redis.enabled, ready: null };

  if (env.redis.enabled) {
    const client = getRedisClient();
    redis.ready = Boolean(client?.isReady);
  }

  const redisHealthy = !env.redis.enabled || redis.ready === true;
  const ready = databaseHealthy && redisHealthy;

  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready
      ? 'Service is ready to accept traffic.'
      : 'Service is not ready; a required dependency is unavailable.',
    checks: {
      database,
      redis,
    },
    requestId: req.requestId,
  });
});

router.get(
  '/health/metrics',
  authenticate,
  authorize(PERMISSIONS.SYSTEM_ADMIN),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Metrics snapshot retrieved successfully.',
      data: getMetricsSnapshot(),
      requestId: req.requestId,
    });
  },
);

export default router;
