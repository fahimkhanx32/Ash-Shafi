import apiClient from './apiClient.js';

/**
 * FET-12/14 — thin wrapper around the real backend video-consultation
 * endpoints (`server/src/modules/video-calls/routes/video-session.routes.js`,
 * BET-14), mounted at `/api/v1/video-calls`. Field/shape names copied
 * exactly from `video-session.controller.js` — `joinSession` in
 * particular returns `{ session, joinToken, roomId, iceServers }`,
 * and `joinToken` is the single-use plaintext credential the socket
 * layer's `video:join` handler requires (never persisted anywhere
 * client-side beyond the in-memory call state — see
 * `VideoConsultationPage.jsx`).
 */

const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: doc.id || (_id ? String(_id) : undefined) };
};

/**
 * `POST /video-calls/appointments/:appointmentId/session` —
 * idempotently creates (or fetches) the video session tied to this
 * appointment. Safe to call every time the video page mounts.
 */
export const getOrCreateSessionForAppointment = async (appointmentId) => {
  const { data } = await apiClient.post(`/video-calls/appointments/${appointmentId}/session`);
  return withId(data.data);
};

export const getSession = async (id) => {
  const { data } = await apiClient.get(`/video-calls/sessions/${id}`);
  return withId(data.data);
};

/** Patient-only — a doctor's participation is itself the clinical consent equivalent (see the model's docstring). */
export const recordConsent = async (id) => {
  const { data } = await apiClient.post(`/video-calls/sessions/${id}/consent`);
  return withId(data.data);
};

export const joinSession = async (id) => {
  const { data } = await apiClient.post(`/video-calls/sessions/${id}/join`);
  return {
    session: withId(data.data.session),
    joinToken: data.data.joinToken,
    roomId: data.data.roomId,
    iceServers: data.data.iceServers,
  };
};

export const leaveSession = async (id) => {
  const { data } = await apiClient.post(`/video-calls/sessions/${id}/leave`);
  return withId(data.data);
};

export const endSession = async (id, { reason = '' } = {}) => {
  const { data } = await apiClient.post(`/video-calls/sessions/${id}/end`, { reason });
  return withId(data.data);
};
