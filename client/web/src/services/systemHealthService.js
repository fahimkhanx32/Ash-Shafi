import axios from 'axios';
import { getApiBaseUrl } from './apiClient.js';

// `health/health.routes.js` is mounted at the app root on the
// backend (server/src/app.js: `app.use(healthRoutes)`, before the
// `/api/v1` prefix), unlike every other module — so this needs its
// own base URL derived from the same API base URL rather
// than reusing `apiClient` (which is pinned to `/api/v1`). No auth
// header needed: both endpoints are intentionally unauthenticated
// liveness/readiness probes.
const getRootUrl = () => getApiBaseUrl().replace(/\/api\/v1\/?$/, '');

/**
 * FET-05 — "System health indicators" on the Super Admin dashboard.
 * Real data from the real BET-02 health endpoints, not a fabricated
 * status pill. `/health/ready` intentionally responds 503 when a
 * dependency is down, so a failed request there is read as "not
 * ready" rather than treated as an unexpected error.
 */
export const getLiveness = async () => {
  const { data } = await axios.get(`${getRootUrl()}/health`);
  return data;
};

export const getReadiness = async () => {
  try {
    const { data } = await axios.get(`${getRootUrl()}/health/ready`);
    return data;
  } catch (error) {
    if (error.response?.data) {
      return error.response.data;
    }
    throw error;
  }
};
