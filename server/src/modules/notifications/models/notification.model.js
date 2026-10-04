import mongoose from 'mongoose';

/**
 * BET-13 — Notifications (master prompt §43/§85).
 *
 * `NOTIFICATION_TYPES` intentionally includes a few forward-looking
 * event categories (`APPOINTMENT_*`, `PRESCRIPTION_READY`, etc.) that
 * this task does not emit yet — the same "present but unpopulated
 * until its owning module ships" decision `encounter.model.js` made
 * for `relatedInvestigations`/`relatedPrescriptions` (BET-09). Wiring
 * `modules/appointments`/`modules/prescriptions`/`modules/billing` to
 * actually call `createNotification()` for their own events is each
 * of those modules' own concern, not BET-13's (master prompt §98 —
 * don't implement roadmap items outside the current task); this only
 * needs the type to exist so a future call site has something valid
 * to use. The two types this task genuinely emits are
 * `MESSAGE_RECEIVED`/`VOICE_MESSAGE_RECEIVED`
 * (`modules/messaging/services/message.service.js`), plus
 * `SYSTEM_ANNOUNCEMENT` for the admin broadcast endpoint this task
 * does build (`NOTIFICATIONS_MANAGE`).
 *
 * BET-14 adds the three `VIDEO_CONSULTATION_*` types below, which
 * *are* genuinely emitted by `modules/video-calls/services/
 * video-session.service.js` (master prompt BET-14.7 "Notification
 * Integration") — unlike the still-reserved `APPOINTMENT_*`/etc.
 * types, these are wired up as part of this task, not left for a
 * future module. Content stays deliberately generic per §85 ("Your
 * video consultation is ready" — never "Your STI follow-up video
 * consultation is ready").
 */
export const NOTIFICATION_TYPES = Object.freeze({
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  VOICE_MESSAGE_RECEIVED: 'VOICE_MESSAGE_RECEIVED',
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',

  // BET-14 — genuinely emitted, see docstring above.
  VIDEO_CONSULTATION_READY: 'VIDEO_CONSULTATION_READY',
  VIDEO_CONSULTATION_STARTED: 'VIDEO_CONSULTATION_STARTED',
  VIDEO_CONSULTATION_ENDED: 'VIDEO_CONSULTATION_ENDED',

  // Reserved — not yet emitted by any module. See docstring above.
  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  APPOINTMENT_CONFIRMED: 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_REMINDER: 'APPOINTMENT_REMINDER',
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED',
  APPOINTMENT_RESCHEDULED: 'APPOINTMENT_RESCHEDULED',
  PRESCRIPTION_READY: 'PRESCRIPTION_READY',
  REPORT_READY: 'REPORT_READY',
  // Report intake — genuinely emitted by
  // `modules/reports/services/report-intake.service.js`. Titles/bodies
  // stay generic (no patient name, no report content) per the privacy
  // rule above; the named notice lives inside the secure conversation.
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
  REPORT_INTAKE_REVIEWED: 'REPORT_INTAKE_REVIEWED',
  INVOICE_GENERATED: 'INVOICE_GENERATED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  FOLLOW_UP_REMINDER: 'FOLLOW_UP_REMINDER',
});

export const NOTIFICATION_CHANNELS = Object.freeze(['inApp', 'email', 'sms', 'whatsapp']);

const channelDeliverySchema = new mongoose.Schema(
  {
    attempted: { type: Boolean, default: false },
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
);

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },

    // Deliberately generic — never clinical/private content (master
    // prompt §85: "Your appointment has been updated." not "Your STI
    // diagnosis consultation has been scheduled."). Callers are
    // responsible for keeping these safe; this schema does not (and
    // cannot) enforce content, only the delivery/preference plumbing.
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 500 },

    // Generic forward-link so the client can deep-link on tap
    // (e.g. open the conversation a MESSAGE_RECEIVED notice is
    // about) without this schema needing a ref per possible resource
    // type.
    relatedResource: {
      type: { type: String, default: null },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
    },

    delivery: {
      inApp: { type: channelDeliverySchema, default: () => ({ attempted: true, delivered: true, deliveredAt: new Date() }) },
      email: { type: channelDeliverySchema, default: () => ({}) },
      sms: { type: channelDeliverySchema, default: () => ({}) },
      whatsapp: { type: channelDeliverySchema, default: () => ({}) },
    },

    readAt: { type: Date, default: null },

    // Set only for admin-initiated broadcasts (NOTIFICATIONS_MANAGE);
    // null for system-generated notifications (e.g. a new message).
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, readAt: 1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema);
