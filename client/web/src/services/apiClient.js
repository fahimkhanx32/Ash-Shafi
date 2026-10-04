import axios from 'axios';

/**
 * Dynamically resolves the API base URL.
 * - Respects explicit non-localhost VITE_API_URL in production/custom setups.
 * - When accessed over LAN (e.g. http://192.168.0.102:5173), dynamically routes
 *   API requests to the current host machine on port 5000 rather than failing on localhost.
 * - Seamlessly falls back to http://localhost:5000/api/v1.
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env?.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        if (
          (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
          hostname !== 'localhost' &&
          hostname !== '127.0.0.1'
        ) {
          parsed.hostname = hostname;
          return parsed.toString().replace(/\/$/, '');
        }
        return envUrl;
      } catch {
        return envUrl;
      }
    }
    const protocol = window.location.protocol || 'http:';
    return `${protocol}//${hostname}:5000/api/v1`;
  }
  return envUrl || 'http://localhost:5000/api/v1';
};

export const API_URL = getApiBaseUrl();

const ACCESS_TOKEN_KEY = 'ashshafi.accessToken';
const REFRESH_TOKEN_KEY = 'ashshafi.refreshToken';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: ({ accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Queue concurrent requests while a single refresh call is in flight,
// so a burst of 401s doesn't trigger multiple simultaneous refreshes.
let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error, token) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

// Set by AuthProvider so the interceptor can force a logout when the
// refresh token itself is invalid/expired/revoked.
let onSessionExpired = () => {};
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login')
      || originalRequest?.url?.includes('/auth/refresh')
      || originalRequest?.url?.includes('/auth/register');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        onSessionExpired();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data.data;
        tokenStorage.setTokens({ accessToken, refreshToken: newRefreshToken });
        flushQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        tokenStorage.clear();
        onSessionExpired();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Normalizes the backend's error shape
 * ({ success:false, error:{ code, message, details } }) into a plain
 * object the UI can render without ever leaking a raw stack trace.
 */
export const extractApiError = (error) => {
  const payload = error?.response?.data?.error;
  if (payload) {
    return {
      code: payload.code || 'UNKNOWN_ERROR',
      message: payload.message || 'Something went wrong. Please try again.',
      details: payload.details,
    };
  }
  if (error?.request) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' };
};

/**
 * Downloads a protected file securely via Bearer-authenticated XHR/fetch.
 * Prevents exposing raw backend URLs or sensitive medical files to public unauthenticated access.
 */
export const downloadSecureFile = async (urlPath, filename = 'download') => {
  const response = await apiClient.get(urlPath, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: response.headers['content-type'] });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
};

export default apiClient;
