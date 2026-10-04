import apiClient, { tokenStorage } from './apiClient.js';
import { decodeJwtPayload } from '../lib/jwt.js';

/**
 * Thin wrappers around the real backend auth endpoints
 * (server/src/auth/auth.routes.js). Field names below are copied
 * exactly from server/src/auth/auth.validation.js — do not rename.
 */

// Patients only: POST /auth/register always creates a PATIENT-role
// account server-side (role is never read from the request body),
// so this is the only self-registration flow the backend supports.
// No `username` param — it's generated server-side now (slugified
// name + last 3 phone digits); see `updateUsername` below for
// changing it afterward.
export const registerPatient = async ({ name, username, email, phone, password }) => {
  const { data } = await apiClient.post('/auth/register', {
    name,
    username,
    email,
    phone,
    password,
  });
  return data;
};

export const login = async ({ identifier, password }) => {
  const { data } = await apiClient.post('/auth/login', { identifier, password });
  const { accessToken, refreshToken, user } = data.data;
  tokenStorage.setTokens({ accessToken, refreshToken });
  return user;
};

export const logout = async () => {
  const refreshToken = tokenStorage.getRefreshToken();
  try {
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refreshToken });
    }
  } finally {
    tokenStorage.clear();
  }
};

export const logoutAll = async () => {
  try {
    await apiClient.post('/auth/logout-all');
  } finally {
    // Mirrors `logout()`'s try/finally above: the local tokens must
    // be cleared even if the request itself fails (e.g. the network
    // drops after the server already processed it), otherwise a
    // stale, now-invalid refresh token stays in localStorage.
    tokenStorage.clear();
  }
};

export const fetchCurrentUser = async () => {
  const { data } = await apiClient.get('/auth/me');
  return data.data.user;
};

export const forgotPassword = async ({ identifier }) => {
  const { data } = await apiClient.post('/auth/forgot-password', { identifier });
  return data;
};

export const resetPassword = async ({ token, newPassword }) => {
  const { data } = await apiClient.post('/auth/reset-password', { token, newPassword });
  return data;
};

export const verifyEmail = async ({ token }) => {
  const { data } = await apiClient.post('/auth/verify-email', { token });
  return data;
};

export const resendVerification = async ({ identifier }) => {
  const { data } = await apiClient.post('/auth/resend-verification', { identifier });
  return data;
};

export const changePassword = async ({ currentPassword, newPassword }) => {
  const { data } = await apiClient.post('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return data;
};

// Self-service "change my username" (Settings). PATCH /auth/me/username
// mirrors the existing PATCH /auth/me/preferences pattern exactly —
// self-lookup off the authenticated user, no special permission
// beyond being logged in.
export const updateUsername = async ({ username }) => {
  const { data } = await apiClient.patch('/auth/me/username', { username });
  return data;
};

export const updateEmail = async ({ email, currentPassword }) => {
  const { data } = await apiClient.patch('/auth/me/email', { email, currentPassword });
  return data;
};

export const updateProfileImage = async (profileImage) => {
  const { data } = await apiClient.patch('/auth/me/profile-image', { profileImage });
  return data;
};

export const listSessions = async () => {
  // FET-04: identify "this device" in the list by sending the
  // (non-secret) tokenId claim already embedded in our own refresh
  // token — see server/src/auth/auth.controller.js's
  // listSessionsController for what the backend does with it.
  const refreshToken = tokenStorage.getRefreshToken();
  const currentTokenId = refreshToken ? decodeJwtPayload(refreshToken)?.tokenId : null;

  const { data } = await apiClient.get('/auth/sessions', {
    headers: currentTokenId ? { 'X-Current-Token-Id': currentTokenId } : {},
  });
  return data.data.sessions;
};

export const revokeSession = async (sessionId) => {
  const { data } = await apiClient.delete(`/auth/sessions/${sessionId}`);
  return data;
};
