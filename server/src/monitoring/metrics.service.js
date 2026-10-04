/**
 * In-process request/error metrics (BET-23 — Monitoring).
 *
 * This project has no external metrics/APM system wired up (no
 * Prometheus, Datadog, etc. dependency exists) and standing this up
 * for real is an infrastructure decision outside a single backend
 * session's scope. What this module provides instead is a
 * lightweight, dependency-free, in-process counter set — enough for
 * an operator to `curl` a single admin-gated endpoint and get a real
 * signal on request volume, error rate, and latency distribution
 * without needing a separate monitoring stack running yet.
 *
 * Deliberately in-memory, not persisted or shared across processes:
 * if this API is ever run as more than one instance, each process
 * reports only its own traffic. That's an accepted, documented
 * limitation (see `docs/reliability/BET-23-RELIABILITY.md`) — a real
 * multi-instance deployment should replace this with a proper
 * metrics backend (Prometheus + `prom-client`, or an APM vendor
 * agent) rather than trying to aggregate these counters across
 * processes by hand.
 */

const state = {
  startedAt: Date.now(),
  totalRequests: 0,
  requestsByStatusClass: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  requestsByRoute: new Map(),
  totalErrors5xx: 0,
  // Reservoir of the most recent N request durations, used only to
  // report simple percentiles — not a substitute for a real
  // histogram-based metrics backend, but useful for a quick health
  // signal without a dependency.
  recentDurationsMs: [],
};

const MAX_RECENT_DURATIONS = 1000;
const MAX_TRACKED_ROUTES = 200;

const statusClassOf = (statusCode) => {
  if (statusCode >= 500) return '5xx';
  if (statusCode >= 400) return '4xx';
  if (statusCode >= 300) return '3xx';
  return '2xx';
};

/**
 * Record one completed HTTP request.
 *
 * @param {{ method: string, route: string, statusCode: number, durationMs: number }} sample
 */
export const recordRequest = ({ method, route, statusCode, durationMs }) => {
  state.totalRequests += 1;

  const statusClass = statusClassOf(statusCode);
  state.requestsByStatusClass[statusClass] += 1;

  if (statusClass === '5xx') {
    state.totalErrors5xx += 1;
  }

  // Cap the number of distinct route keys tracked, so a client
  // hammering unmapped/enumerated paths (e.g. an ID-guessing probe)
  // can't grow this map unbounded — a denial-of-service-adjacent
  // concern for the metrics endpoint itself.
  const routeKey = `${method} ${route}`;
  if (state.requestsByRoute.size < MAX_TRACKED_ROUTES || state.requestsByRoute.has(routeKey)) {
    state.requestsByRoute.set(routeKey, (state.requestsByRoute.get(routeKey) ?? 0) + 1);
  }

  state.recentDurationsMs.push(durationMs);
  if (state.recentDurationsMs.length > MAX_RECENT_DURATIONS) {
    state.recentDurationsMs.shift();
  }
};

const percentile = (sortedValues, p) => {
  if (sortedValues.length === 0) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor((p / 100) * sortedValues.length),
  );
  return sortedValues[index];
};

/**
 * Snapshot the current metrics, including process-level memory/uptime.
 */
export const getMetricsSnapshot = () => {
  const sorted = [...state.recentDurationsMs].sort((a, b) => a - b);
  const memory = process.memoryUsage();

  return {
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      metricsWindowStartedAt: new Date(state.startedAt).toISOString(),
      pid: process.pid,
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
        externalMb: Math.round(memory.external / (1024 * 1024)),
      },
    },
    http: {
      totalRequests: state.totalRequests,
      requestsByStatusClass: { ...state.requestsByStatusClass },
      totalErrors5xx: state.totalErrors5xx,
      errorRate5xx:
        state.totalRequests > 0
          ? Number((state.totalErrors5xx / state.totalRequests).toFixed(4))
          : 0,
      latencyMs: {
        sampleSize: sorted.length,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      },
      // Top 20 busiest routes by request count, not the full map —
      // keeps the response body small and readable.
      topRoutes: [...state.requestsByRoute.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([route, count]) => ({ route, count })),
    },
  };
};

export default { recordRequest, getMetricsSnapshot };
