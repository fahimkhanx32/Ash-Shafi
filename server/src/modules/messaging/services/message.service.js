import { Message } from '../models/message.model.js';
import { Conversation } from '../models/conversation.model.js';
import { assertIsConversationParticipant } from './conversation-access.service.js';
import { findConversationOrThrow } from './conversation.service.js';
import {
  uploadMessageAttachment,
  getMessageAttachmentBuffer,
  deleteMessageAttachment,
} from './message-storage.service.js';
import { getIo, userRoom, conversationRoom } from '../../../socket/index.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import { NOTIFICATION_TYPES } from '../../notifications/models/notification.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-13 — Messages, Attachments, Voice Messages, Read Status
 * (master prompt §29/§30/§31).
 *
 * Every write here still happens over the authenticated REST API
 * exactly like every other module in this project — this service is
 * the single place both the message-send controller and the
 * voice-message controller funnel through, and the single place that
 * pushes the resulting real-time events (`message:new`,
 * `message:read`) via the existing `socket/index.js`. A push is
 * always best-effort (`getIo()` can be `null` under `supertest`,
 * which never boots `server.js` — see that module's own docstring)
 * and never blocks or fails the request if it doesn't happen.
 */

const otherParticipant = (conversation, actorId) => {
  const patientId = String(conversation.patient?._id ?? conversation.patient);
  const doctorId = String(conversation.doctor?._id ?? conversation.doctor);
  return String(actorId) === patientId ? doctorId : patientId;
};

const bumpUnreadAndLastMessage = async (conversation, senderId, recipientId) => {
  const isPatientSender = String(senderId) === String(conversation.patient?._id ?? conversation.patient);
  const recipientSide = isPatientSender ? 'doctor' : 'patient';

  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessageAt: new Date(),
        lastMessageSender: senderId,
      },
      $inc: { [`unreadCount.${recipientSide}`]: 1 },
    },
  );
};

const pushSocketEvent = (room, event, payload) => {
  try {
    const io = getIo();
    if (io) {
      io.to(room).emit(event, payload);
    }
  } catch (error) {
    // Never let a socket push failure affect the REST response.
    logger.warn({ err: error, event }, 'Failed to push real-time messaging event.');
  }
};

/**
 * @param {object} params
 * @param {string} params.conversationId
 * @param {object} params.actor
 * @param {string} [params.content]
 * @param {'TEXT'|'IMAGE'|'DOCUMENT'|'VOICE'} params.messageType
 * @param {object} [params.attachmentFile] raw multer file (buffer/mimetype/originalname/size) already validated by security/file-security.js at the route layer
 * @param {number} [params.durationSeconds] voice messages only
 */
export const sendMessage = async ({
  conversationId,
  actor,
  content = '',
  messageType,
  attachmentFile = null,
  durationSeconds = null,
  requestMeta = {},
}) => {
  const conversation = await findConversationOrThrow(conversationId);

  await assertIsConversationParticipant({
    actor,
    conversation,
    write: true,
    requestMeta,
  });

  // An admin-tier caller who is not an actual participant may *view*
  // a conversation for oversight, but sending a message as a
  // non-participant would misrepresent who the message is from —
  // messaging remains strictly between the two real participants.
  if (!(
    String(actor._id) === String(conversation.patient?._id ?? conversation.patient) ||
    String(actor._id) === String(conversation.doctor?._id ?? conversation.doctor)
  )) {
    throw new AppError(
      'Only the two participants of a conversation may send messages.',
      403,
      { code: 'NOT_PARTICIPANT' },
    );
  }

  const recipientId = otherParticipant(conversation, actor._id);

  let attachment = null;

  if (attachmentFile) {
    const { cloudinaryPublicId, cloudinaryResourceType } = await uploadMessageAttachment({
      buffer: attachmentFile.buffer,
      storageFilename: attachmentFile.storageFilename,
      mimeType: attachmentFile.mimetype,
      conversationId: conversation._id,
    });

    attachment = {
      cloudinaryPublicId,
      cloudinaryResourceType,
      mimeType: attachmentFile.mimetype,
      originalFilename: attachmentFile.sanitizedOriginalName || '',
      sizeBytes: attachmentFile.size,
      durationSeconds: messageType === 'VOICE' ? durationSeconds : null,
    };
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: actor._id,
    recipient: recipientId,
    messageType,
    content: content || '',
    attachment,
  });

  await bumpUnreadAndLastMessage(conversation, actor._id, recipientId);

  pushSocketEvent(conversationRoom(conversation._id), 'message:new', {
    conversationId: String(conversation._id),
    message: {
      id: String(message._id),
      sender: String(actor._id),
      recipient: String(recipientId),
      messageType: message.messageType,
      content: message.content,
      attachment: message.attachment,
      createdAt: message.createdAt,
    },
  });

  // Best-effort — a notification failure must never fail a message
  // send. Deliberately generic body (master prompt §85 — privacy-
  // first notifications): never surfaces message content.
  try {
    await createNotification({
      recipientId,
      type:
        messageType === 'VOICE'
          ? NOTIFICATION_TYPES.VOICE_MESSAGE_RECEIVED
          : NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      title: 'New message',
      body: 'You have a new secure message on Ash-Shāfī.',
      relatedResource: { type: 'CONVERSATION', id: conversation._id },
    });
  } catch (error) {
    logger.warn(
      { err: error, conversationId: conversation._id },
      'Failed to create notification for new message.',
    );
  }

  return message;
};

export const listMessages = async (
  conversationId,
  actor,
  { page = 1, limit = 30 } = {},
  requestMeta = {},
) => {
  const conversation = await findConversationOrThrow(conversationId);

  await assertIsConversationParticipant({
    actor,
    conversation,
    write: false,
    requestMeta,
  });

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Message.find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Message.countDocuments({ conversation: conversation._id }),
  ]);

  return { items, page, limit, total };
};

/**
 * Marks every unread message sent *to* the actor in this conversation
 * as read, resets that side's unread counter, and pushes
 * `message:read` so the sender's client can update its ticks in real
 * time.
 */
export const markConversationRead = async (conversationId, actor, requestMeta = {}) => {
  const conversation = await findConversationOrThrow(conversationId);

  await assertIsConversationParticipant({
    actor,
    conversation,
    write: false,
    requestMeta,
  });

  const now = new Date();

  const result = await Message.updateMany(
    { conversation: conversation._id, recipient: actor._id, readAt: null },
    { $set: { readAt: now } },
  );

  const readerSide =
    String(actor._id) === String(conversation.patient?._id ?? conversation.patient)
      ? 'patient'
      : 'doctor';

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { [`unreadCount.${readerSide}`]: 0 } },
  );

  pushSocketEvent(conversationRoom(conversation._id), 'message:read', {
    conversationId: String(conversation._id),
    readBy: String(actor._id),
    readAt: now,
  });

  return { markedRead: result.modifiedCount ?? 0 };
};

const findMessageOrThrow = async (id) => {
  const message = await Message.findById(id);

  if (!message) {
    throw new AppError('Message not found.', 404, { code: 'MESSAGE_NOT_FOUND' });
  }

  return message;
};

/**
 * Sender-only soft delete, plus admin-tier for moderation/compliance
 * (logged the same way admin conversation access is logged).
 * Clears `content`/`attachment` and removes the underlying Cloudinary
 * object — the message row, timestamps, and sender/deleter identity
 * remain (master prompt §84 — never destroy history outright).
 */
export const deleteMessage = async (messageId, actor, requestMeta = {}) => {
  const message = await findMessageOrThrow(messageId);
  const conversation = await findConversationOrThrow(message.conversation);

  const isSender = String(message.sender) === String(actor._id);
  const adminTier = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR].includes(
    actor.role,
  );

  if (!isSender && !adminTier) {
    throw new AppError('You can only delete your own messages.', 403, {
      code: 'FORBIDDEN',
    });
  }

  if (!isSender && adminTier) {
    await assertIsConversationParticipant({
      actor,
      conversation,
      write: true,
      requestMeta,
    });
  }

  if (message.attachment?.cloudinaryPublicId) {
    await deleteMessageAttachment({
      cloudinaryPublicId: message.attachment.cloudinaryPublicId,
      cloudinaryResourceType: message.attachment.cloudinaryResourceType,
    });
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = actor._id;
  message.content = '';
  message.attachment = null;

  await message.save();

  pushSocketEvent(conversationRoom(conversation._id), 'message:deleted', {
    conversationId: String(conversation._id),
    messageId: String(message._id),
  });

  return message;
};

/**
 * Streams attachment bytes after re-running conversation-membership
 * authorization — never trusts a cached/previous check.
 */
export const getMessageAttachmentForDownload = async (messageId, actor, requestMeta = {}) => {
  const message = await findMessageOrThrow(messageId);

  if (!message.attachment) {
    throw new AppError('This message has no attachment.', 404, {
      code: 'ATTACHMENT_NOT_FOUND',
    });
  }

  const conversation = await findConversationOrThrow(message.conversation);

  await assertIsConversationParticipant({
    actor,
    conversation,
    write: false,
    requestMeta,
  });

  const buffer = await getMessageAttachmentBuffer({
    cloudinaryPublicId: message.attachment.cloudinaryPublicId,
    cloudinaryResourceType: message.attachment.cloudinaryResourceType,
  });

  return {
    buffer,
    mimeType: message.attachment.mimeType,
    filename: message.attachment.originalFilename || 'attachment',
  };
};

export { pushSocketEvent, userRoom };
