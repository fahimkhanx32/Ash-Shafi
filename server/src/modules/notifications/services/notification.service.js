import { Notification, NOTIFICATION_TYPES } from '../models/notification.model.js';
import { User } from '../../../users/user.model.js';
import { sendMail } from '../../../integrations/email/mailer.js';
import { sendSms } from '../../../integrations/sms/sms.service.js';
import { sendWhatsAppMessage } from '../../../integrations/whatsapp/whatsapp.service.js';
import { getPatientProfileByUserId } from '../../patients/services/patient.service.js';
import { getStaffProfileByUserId } from '../../staff/services/staff.service.js';
import { getIo, userRoom } from '../../../socket/index.js';
import { ROLES, PERMISSIONS, hasPermission } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

/**
 * BET-13 — Notifications (master prompt §43/§85).
 *
 * `createNotification()` is the single fan-out point every other
 * module (today: `modules/messaging/services/message.service.js`)
 * calls to notify a user. It always creates the in-app `Notification`
 * document first (that alone must never fail the caller's request),
 * then best-effort attempts the outbound channels the recipient has
 * opted into (`User.notificationPreferences`), then best-effort
 * pushes a `notification:new` socket event. Every one of those three
 * side effects is independently wrapped so a failure in one (e.g.
 * SMS provider down) never blocks or rolls back another.
 *
 * Content passed in here is the caller's responsibility to keep
 * privacy-safe (master prompt §85) — this service does not, and
 * cannot, inspect `title`/`body` for clinical content; it only
 * forwards exactly what it was given to every channel.
 */

const ADMIN_TIER_ROLES = [ROLES.SOFTWARE_OWNER, ROLES.SUPER_ADMIN, ROLES.DIRECTOR];

const pushSocketNotification = (recipientId, notification) => {
  try {
    const io = getIo();
    if (io) {
      io.to(userRoom(recipientId)).emit('notification:new', {
        id: String(notification._id),
        type: notification.type,
        title: notification.title,
        body: notification.body,
        relatedResource: notification.relatedResource,
        createdAt: notification.createdAt,
      });
    }
  } catch (error) {
    logger.warn({ err: error, recipientId }, 'Failed to push real-time notification event.');
  }
};

/**
 * Best-effort phone-number resolution. `User` itself carries no phone
 * field (per the existing user model) — the phone lives on whichever
 * profile the account actually has (`PatientProfile` for a `PATIENT`,
 * `StaffProfile` for everyone else, including `DOCTOR`). Both
 * `getPatientProfileByUserId`/`getStaffProfileByUserId` throw a 404
 * `AppError` when no such profile exists (e.g. a `SOFTWARE_OWNER`
 * account has neither) — that is an expected, non-error outcome
 * here, not a failure worth logging.
 */
const resolveRecipientPhone = async (userId) => {
  try {
    const patientProfile = await getPatientProfileByUserId(userId);
    if (patientProfile?.phone) {
      return patientProfile.phone;
    }
  } catch {
    // No patient profile for this account — try staff next.
  }

  try {
    const staffProfile = await getStaffProfileByUserId(userId);
    if (staffProfile?.phone) {
      return staffProfile.phone;
    }
  } catch {
    // No staff profile either — no phone number available.
  }

  return null;
};

const dispatchEmail = async (notification, user) => {
  if (!user.notificationPreferences?.email || !user.email) {
    return;
  }

  notification.delivery.email.attempted = true;

  const result = await sendMail({
    to: user.email,
    subject: notification.title,
    text: notification.body,
    html: `<p>${notification.body}</p>`,
  });

  notification.delivery.email.delivered = Boolean(result?.sent);
  notification.delivery.email.deliveredAt = result?.sent ? new Date() : null;
  notification.delivery.email.error = result?.sent ? null : (result?.reason || 'SEND_FAILED');
};

const dispatchSms = async (notification, user) => {
  if (!user.notificationPreferences?.sms) {
    return;
  }

  const phone = await resolveRecipientPhone(user._id);
  notification.delivery.sms.attempted = true;

  if (!phone) {
    notification.delivery.sms.delivered = false;
    notification.delivery.sms.error = 'NO_PHONE_NUMBER_ON_FILE';
    return;
  }

  const result = await sendSms({ to: phone, message: `${notification.title}: ${notification.body}` });

  notification.delivery.sms.delivered = Boolean(result?.sent);
  notification.delivery.sms.deliveredAt = result?.sent ? new Date() : null;
  notification.delivery.sms.error = result?.sent ? null : (result?.reason || 'SEND_FAILED');
};

const dispatchWhatsApp = async (notification, user) => {
  if (!user.notificationPreferences?.whatsapp) {
    return;
  }

  const phone = await resolveRecipientPhone(user._id);
  notification.delivery.whatsapp.attempted = true;

  if (!phone) {
    notification.delivery.whatsapp.delivered = false;
    notification.delivery.whatsapp.error = 'NO_PHONE_NUMBER_ON_FILE';
    return;
  }

  const result = await sendWhatsAppMessage({ to: phone, message: `${notification.title}: ${notification.body}` });

  notification.delivery.whatsapp.delivered = Boolean(result?.sent);
  notification.delivery.whatsapp.deliveredAt = result?.sent ? new Date() : null;
  notification.delivery.whatsapp.error = result?.sent ? null : (result?.reason || 'SEND_FAILED');
};

/**
 * @param {object} params
 * @param {string} params.recipientId
 * @param {string} params.type one of NOTIFICATION_TYPES
 * @param {string} params.title short, generic — never clinical content
 * @param {string} params.body short, generic — never clinical content
 * @param {{type: string, id: string}} [params.relatedResource]
 * @param {string} [params.createdBy] set only for admin-initiated broadcasts
 */
export const createNotification = async ({
  recipientId,
  type,
  title,
  body,
  relatedResource = null,
  createdBy = null,
}) => {
  if (!recipientId || !type || !title || !body) {
    throw new AppError('recipientId, type, title and body are required.', 400, {
      code: 'VALIDATION_ERROR',
    });
  }

  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    throw new AppError('Unknown notification type.', 400, { code: 'VALIDATION_ERROR' });
  }

  const notification = await Notification.create({
    recipient: recipientId,
    type,
    title,
    body,
    relatedResource: relatedResource
      ? { type: relatedResource.type, id: relatedResource.id }
      : { type: null, id: null },
    createdBy,
  });

  pushSocketNotification(recipientId, notification);

  // Outbound channel dispatch is entirely best-effort — a delivery
  // failure on any channel must never surface as an error to the
  // caller that triggered this notification (e.g. a message send).
  try {
    const user = await User.findById(recipientId).select(
      'email notificationPreferences',
    );

    if (user) {
      await Promise.all([
        dispatchEmail(notification, user).catch((error) =>
          logger.warn({ err: error, recipientId }, 'Email notification dispatch failed.'),
        ),
        dispatchSms(notification, user).catch((error) =>
          logger.warn({ err: error, recipientId }, 'SMS notification dispatch failed.'),
        ),
        dispatchWhatsApp(notification, user).catch((error) =>
          logger.warn({ err: error, recipientId }, 'WhatsApp notification dispatch failed.'),
        ),
      ]);

      await notification.save();
    }
  } catch (error) {
    logger.warn({ err: error, recipientId }, 'Failed to resolve recipient for notification dispatch.');
  }

  return notification;
};

/**
 * `GET /notifications/me` — identity-resolved, no permission beyond
 * authentication, same `/me` shape as every other self-service list
 * in this project.
 */
export const listMyNotifications = async (actor, { unreadOnly = false, page = 1, limit = 20 } = {}) => {
  const filter = { recipient: actor._id };

  if (unreadOnly) {
    filter.readAt = null;
  }

  const skip = (page - 1) * limit;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: actor._id, readAt: null }),
  ]);

  return { items, page, limit, total, unreadCount };
};

const findOwnNotificationOrThrow = async (id, actor) => {
  const notification = await Notification.findById(id);

  // 404 (never 403) if the notification is not this actor's own —
  // same "don't reveal existence" convention used throughout
  // messaging/reports for another user's private resource.
  if (!notification || String(notification.recipient) !== String(actor._id)) {
    throw new AppError('Notification not found.', 404, { code: 'NOTIFICATION_NOT_FOUND' });
  }

  return notification;
};

export const markNotificationRead = async (id, actor) => {
  const notification = await findOwnNotificationOrThrow(id, actor);

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
};

export const markAllNotificationsRead = async (actor) => {
  const result = await Notification.updateMany(
    { recipient: actor._id, readAt: null },
    { $set: { readAt: new Date() } },
  );

  return { markedRead: result.modifiedCount ?? 0 };
};

/**
 * `PATCH /notifications/me/preferences` — self-service, merges only
 * the known `notificationPreferences` sub-fields, mirroring
 * `auth/auth.service.js#updateUserPreferences`'s merge-not-replace
 * pattern for `uiPreferences` so a partial update never wipes out
 * unrelated preference fields.
 */
export const updateMyNotificationPreferences = async (actor, updates) => {
  const user = await User.findById(actor._id);

  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  user.notificationPreferences = {
    ...(user.notificationPreferences ? user.notificationPreferences.toObject() : {}),
    ...updates,
  };

  await user.save();

  return user.notificationPreferences;
};

/**
 * `POST /notifications/broadcast` — `NOTIFICATIONS_MANAGE` only.
 * Deliberately requires an explicit target (`recipientIds` or
 * `role`) rather than an implicit "everyone" default — the same "no
 * blanket action without an explicit, auditable scope" decision
 * BET-07 made for sensitive-record listings. Only `ACTIVE` accounts
 * are targeted when broadcasting by role.
 */
export const createBroadcastNotification = async ({ recipientIds, role, title, body }, actor) => {
  if (!hasPermission(actor.role, PERMISSIONS.NOTIFICATIONS_MANAGE)) {
    throw new AppError('You do not have permission to perform this action.', 403, {
      code: 'FORBIDDEN',
    });
  }

  let targetIds = [];

  if (Array.isArray(recipientIds) && recipientIds.length > 0) {
    targetIds = recipientIds;
  } else if (role) {
    const users = await User.find({ role, status: 'ACTIVE' }).select('_id');
    targetIds = users.map((user) => String(user._id));
  } else {
    throw new AppError('Either recipientIds or role is required.', 400, {
      code: 'VALIDATION_ERROR',
    });
  }

  const notifications = await Promise.all(
    targetIds.map((recipientId) =>
      createNotification({
        recipientId,
        type: NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
        title,
        body,
        createdBy: actor._id,
      }).catch((error) => {
        logger.warn({ err: error, recipientId }, 'Failed to create broadcast notification for a recipient.');
        return null;
      }),
    ),
  );

  return { sent: notifications.filter(Boolean).length, targeted: targetIds.length };
};

export { ADMIN_TIER_ROLES };
