import {
  MessageSquare,
  Mic,
  Megaphone,
  Video,
  VideoOff,
  PhoneCall,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  Pill,
  FileText,
  Receipt,
  Wallet,
  BellRing,
} from 'lucide-react';

/**
 * FET-12 (Patient Portal) — mirrors `NOTIFICATION_TYPES` exactly
 * (`server/src/modules/notifications/models/notification.model.js`,
 * BET-13/BET-14) so the bell/list never chokes on a type value it
 * doesn't recognize — includes the reserved-but-not-yet-emitted
 * types too (see that model's own docstring), since the UI must
 * still render *something* sensible the day a future module starts
 * emitting one, not just the two/three types live today.
 */
export const NOTIFICATION_TYPES = Object.freeze([
  'MESSAGE_RECEIVED',
  'VOICE_MESSAGE_RECEIVED',
  'SYSTEM_ANNOUNCEMENT',
  'VIDEO_CONSULTATION_READY',
  'VIDEO_CONSULTATION_STARTED',
  'VIDEO_CONSULTATION_ENDED',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_RESCHEDULED',
  'PRESCRIPTION_READY',
  'REPORT_READY',
  'INVOICE_GENERATED',
  'PAYMENT_RECEIVED',
  'FOLLOW_UP_REMINDER',
]);

const TYPE_LABELS = {
  MESSAGE_RECEIVED: 'New message',
  VOICE_MESSAGE_RECEIVED: 'Voice message',
  SYSTEM_ANNOUNCEMENT: 'Announcement',
  VIDEO_CONSULTATION_READY: 'Video consultation ready',
  VIDEO_CONSULTATION_STARTED: 'Video consultation started',
  VIDEO_CONSULTATION_ENDED: 'Video consultation ended',
  APPOINTMENT_BOOKED: 'Appointment booked',
  APPOINTMENT_CONFIRMED: 'Appointment confirmed',
  APPOINTMENT_REMINDER: 'Appointment reminder',
  APPOINTMENT_CANCELLED: 'Appointment cancelled',
  APPOINTMENT_RESCHEDULED: 'Appointment rescheduled',
  PRESCRIPTION_READY: 'Prescription ready',
  REPORT_READY: 'Report ready',
  INVOICE_GENERATED: 'Invoice issued',
  PAYMENT_RECEIVED: 'Payment received',
  FOLLOW_UP_REMINDER: 'Follow-up reminder',
};

/**
 * FET-14 — maps each `NOTIFICATION_TYPES` value to the key under the
 * new `notifications.types.*` locale namespace (`locales/{en,bn}/
 * translation.json`). Added because `TYPE_LABELS` above was plain,
 * un-translated English — the type badge shown on `NotificationsPage`
 * and `NotificationsBell` never changed when the user switched to
 * Bangla, even though every other piece of chrome around it did.
 * `notification.title`/`notification.message` themselves are still
 * generated server-side in English only (`notification.service.js`)
 * and are NOT covered by this — localizing those would mean the
 * backend choosing a template per-recipient locale, a materially
 * separate, larger change that's out of scope for this pass; flagged
 * here rather than implied as done. This map only localizes the
 * *category* badge/fallback-title, which is real, visible progress
 * without pretending to solve the backend piece.
 */
const TYPE_LABEL_KEYS = {
  MESSAGE_RECEIVED: 'messageReceived',
  VOICE_MESSAGE_RECEIVED: 'voiceMessageReceived',
  SYSTEM_ANNOUNCEMENT: 'systemAnnouncement',
  VIDEO_CONSULTATION_READY: 'videoConsultationReady',
  VIDEO_CONSULTATION_STARTED: 'videoConsultationStarted',
  VIDEO_CONSULTATION_ENDED: 'videoConsultationEnded',
  APPOINTMENT_BOOKED: 'appointmentBooked',
  APPOINTMENT_CONFIRMED: 'appointmentConfirmed',
  APPOINTMENT_REMINDER: 'appointmentReminder',
  APPOINTMENT_CANCELLED: 'appointmentCancelled',
  APPOINTMENT_RESCHEDULED: 'appointmentRescheduled',
  PRESCRIPTION_READY: 'prescriptionReady',
  REPORT_READY: 'reportReady',
  INVOICE_GENERATED: 'invoiceGenerated',
  PAYMENT_RECEIVED: 'paymentReceived',
  FOLLOW_UP_REMINDER: 'followUpReminder',
};

const TYPE_ICONS = {
  MESSAGE_RECEIVED: MessageSquare,
  VOICE_MESSAGE_RECEIVED: Mic,
  SYSTEM_ANNOUNCEMENT: Megaphone,
  VIDEO_CONSULTATION_READY: Video,
  VIDEO_CONSULTATION_STARTED: PhoneCall,
  VIDEO_CONSULTATION_ENDED: VideoOff,
  APPOINTMENT_BOOKED: CalendarClock,
  APPOINTMENT_CONFIRMED: CalendarCheck,
  APPOINTMENT_REMINDER: CalendarClock,
  APPOINTMENT_CANCELLED: CalendarX,
  APPOINTMENT_RESCHEDULED: CalendarClock,
  PRESCRIPTION_READY: Pill,
  REPORT_READY: FileText,
  INVOICE_GENERATED: Receipt,
  PAYMENT_RECEIVED: Wallet,
  FOLLOW_UP_REMINDER: BellRing,
};

/**
 * `t` is optional and backward-compatible — omitting it (or calling
 * this before `useTranslation()` is available) still returns the
 * plain English fallback exactly as before. Passing the real `t`
 * from `useTranslation()` resolves `notifications.types.<key>` in
 * the active language, falling back to the same English string if
 * that key is ever missing (matches the `t(key, defaultValue)`
 * pattern `deliveryChannelLabel` below already established).
 */
export const notificationTypeLabel = (type, t) => {
  const fallback = TYPE_LABELS[type] || type;
  const key = TYPE_LABEL_KEYS[type];
  if (typeof t !== 'function' || !key) return fallback;
  return t(`notifications.types.${key}`, fallback);
};
export const notificationTypeIcon = (type) => TYPE_ICONS[type] || BellRing;

/**
 * FET-13 — mirrors `NOTIFICATION_CHANNELS`
 * (`server/src/modules/notifications/models/notification.model.js`).
 * `inApp` is never rendered as a badge (every notification the user
 * can see is, by definition, delivered in-app) — only the three
 * outbound channels get a status chip, and only when the recipient
 * actually had that channel enabled at send time (an untouched
 * `{attempted:false}` sub-document means "not opted in", not "failed
 * to send", and isn't shown at all).
 */
export const DELIVERY_CHANNELS = Object.freeze(['email', 'sms', 'whatsapp']);

export const deliveryChannelLabel = (channel) =>
  ({ email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' })[channel] || channel;

/**
 * Returns 'delivered' | 'failed' | null (null = channel was never
 * attempted for this notification, so render nothing for it).
 */
export const deliveryChannelStatus = (delivery, channel) => {
  const entry = delivery?.[channel];
  if (!entry?.attempted) return null;
  return entry.delivered ? 'delivered' : 'failed';
};
