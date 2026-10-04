import apiClient from './apiClient.js';

/**
 * FET-12/13 — thin wrapper around the real backend messaging
 * endpoints (`server/src/modules/messaging/routes/conversation.routes.js`
 * and `message.routes.js`, BET-13), mounted at `/api/v1/conversations`
 * and `/api/v1/messages`. Field/shape names copied exactly from
 * `message.validation.js` and the two controllers — no client-side
 * invented shape, no mock data.
 *
 * Every write here still requires the caller to have already joined
 * the conversation's socket room for real-time delivery
 * (`socketService.js`'s `conversation:join`) — this file only ever
 * performs the authenticated REST call itself, never a socket emit,
 * mirroring the server's own "writes happen over REST, sockets only
 * push" design (see `server/src/socket/index.js`'s docstring).
 */

const withId = (doc) => {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: doc.id || (_id ? String(_id) : undefined) };
};

// ---- Conversations ----

/** `GET /conversations/me` — the signed-in patient's or doctor's own conversations. */
export const getMyConversations = async ({ page = 1, limit = 20 } = {}) => {
  const { data } = await apiClient.get('/conversations/me', { params: { page, limit } });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination || null };
};

/**
 * `POST /conversations` — idempotently creates (or fetches) the
 * conversation between a patient and their assigned doctor. A
 * PATIENT actor may only pass their own `patientProfileId` and their
 * assigned `primaryCareProvider` as `doctorId` — the backend
 * re-verifies this regardless of what the client sends (master
 * prompt §80).
 */
export const startConversation = async ({ patientProfileId, doctorId }) => {
  const { data } = await apiClient.post('/conversations', { patientProfileId, doctorId });
  return withId(data.data);
};

export const getConversation = async (id) => {
  const { data } = await apiClient.get(`/conversations/${id}`);
  return withId(data.data);
};

export const markConversationRead = async (id) => {
  const { data } = await apiClient.post(`/conversations/${id}/read`);
  return data.data;
};

// ---- Messages ----

export const listMessages = async (conversationId, { page = 1, limit = 30 } = {}) => {
  const { data } = await apiClient.get(`/conversations/${conversationId}/messages`, {
    params: { page, limit },
  });
  return { items: (data.data || []).map(withId), pagination: data.meta?.pagination || null };
};

/**
 * Sends a TEXT message. Always `multipart/form-data` on the wire
 * (matching `sendImageMessage`/`sendDocumentMessage`/
 * `sendVoiceMessage` below) even though a TEXT message has no file —
 * the backend's `receiveMessageAttachment` middleware accepts a
 * fileless multipart request just as readily as JSON, and using one
 * body-building helper for every message type keeps this file simple.
 */
const buildFormData = ({ messageType, content = '', file = null, durationSeconds = null }) => {
  const form = new FormData();
  form.append('messageType', messageType);
  if (content) form.append('content', content);
  if (file) form.append('file', file);
  if (durationSeconds != null) form.append('durationSeconds', String(durationSeconds));
  return form;
};

const sendMessage = async (conversationId, payload) => {
  const { data } = await apiClient.post(
    `/conversations/${conversationId}/messages`,
    buildFormData(payload),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return withId(data.data);
};

export const sendTextMessage = (conversationId, content) =>
  sendMessage(conversationId, { messageType: 'TEXT', content });

export const sendImageMessage = (conversationId, file, caption = '') =>
  sendMessage(conversationId, { messageType: 'IMAGE', file, content: caption });

export const sendDocumentMessage = (conversationId, file, caption = '') =>
  sendMessage(conversationId, { messageType: 'DOCUMENT', file, content: caption });

export const sendVoiceMessage = (conversationId, file, durationSeconds) =>
  sendMessage(conversationId, { messageType: 'VOICE', file, durationSeconds });

export const deleteMessage = async (id) => {
  const { data } = await apiClient.delete(`/messages/${id}`);
  return withId(data.data);
};

/**
 * Downloads an attachment as a blob (the backend streams the file's
 * bytes directly — see `downloadMessageAttachmentController` — never
 * a Cloudinary URL). Caller is responsible for turning the blob into
 * an object URL / triggering a save, same convention
 * `reportsService.js` uses for report downloads.
 */
export const downloadMessageAttachment = async (messageId) => {
  const { data, headers } = await apiClient.get(`/messages/${messageId}/attachment`, {
    responseType: 'blob',
  });
  return { blob: data, contentType: headers['content-type'] };
};
