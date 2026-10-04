import { recordRequest } from '../monitoring/metrics.service.js';

/**
 * Metrics-collection middleware (BET-23 — Monitoring).
 *
 * Mirrors the timing approach `middlewares/audit.middleware.js`
 * already uses (`process.hrtime.bigint()` around a `res.on('finish')`
 * listener) rather than introducing a second timing mechanism.
 * Deliberately separate from `auditMiddleware`: that middleware's
 * job is per-request structured logging (one line per request, for
 * log aggregation/tracing by `requestId`); this one's job is
 * aggregate, in-process counters (for the `/health/metrics`
 * snapshot). Combining them would couple two different consumers
 * (a log pipeline vs. an operator polling a metrics endpoint) into
 * one function.
 *
 * Uses `req.route?.path` (the matched Express route pattern, e.g.
 * `/:id`) rather than `req.originalUrl` (which would contain the
 * real, unbounded-cardinality ID) as the route key, so the tracked
 * route set stays small and meaningful instead of growing one entry
 * per distinct resource ID ever requested.
 */
export const metricsMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    // req.route is only populated once Express has matched a route
    // handler; for a 404 (no route matched at all) fall back to the
    // path prefix so unmatched-route traffic is still visible in the
    // metrics rather than silently dropped.
    const routePattern =
      req.route?.path ?? req.baseUrl ?? req.path ?? 'unmatched';

    recordRequest({
      method: req.method,
      route: routePattern,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};

export default metricsMiddleware;
