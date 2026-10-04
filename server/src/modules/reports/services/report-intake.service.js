import { MedicalReport } from '../models/medical-report.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { findPatientProfileOrThrow } from '../../investigations/services/investigation.service.js';
import { User } from '../../../users/user.model.js';
import { Message } from '../../messaging/models/message.model.js';
import { Conversation } from '../../messaging/models/conversation.model.js';
import { ensureConversationForPair, assertActiveDoctor } from '../../messaging/services/conversation.service.js';
import { getIo, conversationRoom } from '../../../socket/index.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import { NOTIFICATION_TYPES } from '../../notifications/models/notification.model.js';
import {
  uploadReport,
  findReportOrThrow,
  transitionReport,
  SENSITIVE_STANDALONE_REPORT_TYPES,
} from './report.service.js';
import { enforceReportAccess, logReportAccess, isAdminTier } from './report-access.service.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

/**
 * Report intake — patient self-submission and staff upload on a
 * patient's behalf.
 *
 * Trust model (the point of this module):
 *  - A submission is DATA, not verified clinical information. It is
 *    created through the same `uploadReport` path as any report (same
 *    storage, hashing, duplicate detection, async OCR), flagged
 *    `submission.intakeStatus = PENDING_REVIEW`, and stays out of the
 *    verified workflow until a doctor acts on it.
 *  - ACCEPT only means "a doctor has looked at this and it belongs in
 *    the chart". It never verifies or finalizes anything — that stays
 *    on the existing per-parameter review + `REPORTS_VERIFY` flow.
 *  - The patient a PATIENT caller submits for is ALWAYS resolved from
 *    their own identity; a client-supplied `patientProfileId` is
 *    ignored for them.
 *  - Sensitive report types keep their BET-07 read protection: the
 *    submission is accepted as a write-only drop box, but only the
 *    patient's assigned provider (or admin tier) can see or review it.
 */

// Patients are the least-trusted uploaders; restrict them to plain
// scans/photos/PDFs. (Office documents remain available to staff via
// the ordinary upload route.)
export const PATIENT_INTAKE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const REPORT_TYPE_LABELS = Object.freeze({
  LABORATORY: 'lab test report',
  IMAGING: 'imaging / X-ray report',
  ULTRASOUND: 'ultrasound report',
  PATHOLOGY: 'pathology report',
  PAP_SMEAR: 'Pap smear report',
  GENERAL_DOCUMENT: 'document',
});

const ROLE_LABELS = Object.freeze({
  DOCTOR: 'Doctor',
  STAFF: 'Staff member',
  RECEPTIONIST: 'Receptionist',
  ADMIN: 'Admin',
  DIRECTOR: 'Director',
  SUPER_ADMIN: 'Admin',
  SOFTWARE_OWNER: 'Admin',
});

const idOf = (value) => String(value?._id ?? value);

/**
 * Which doctors' inboxes a submission lands in. Non-sensitive: the
 * picked doctor plus the patient's assigned provider (deduplicated).
 * Sensitive: only the assigned provider, because no other doctor could
 * open it anyway (BET-07) and listing it for them would just be a
 * dead entry.
 */
export const resolveRoutedDoctorIds = ({ targetDoctorId, primaryCareProvider, isSensitive }) => {
  const provider = primaryCareProvider ? idOf(primaryCareProvider) : null;
  const target = targetDoctorId ? idOf(targetDoctorId) : null;
  // Any doctor may now open any report (product decision 2026-10), so a
  // sensitive report routes to the picked doctor as well as the provider.
  const ids = [target, provider];
  return [...new Set(ids.filter(Boolean))];
};

/**
 * Text of the notice dropped into the doctor's secure conversation.
 * Names the patient (the doctor is a party to that conversation) but
 * never includes any extracted result content. For a sensitive report
 * shown to a doctor who cannot open it, the notice is deliberately
 * generic: no type, no title.
 */
export const buildReportNoticeText = ({
  patientName,
  uploaderName,
  uploaderRole,
  isSelfSubmitted,
  title,
  reportType,
  restricted = false,
}) => {
  if (restricted) {
    return `${patientName} has shared a restricted document. Only the patient's assigned doctor can review it.`;
  }
  const label = REPORT_TYPE_LABELS[reportType] || 'report';
  if (isSelfSubmitted) {
    return `${patientName} has uploaded a new ${label}: ${title}.`;
  }
  const who = `${uploaderName || 'A staff member'} (${ROLE_LABELS[uploaderRole] || 'Staff'})`;
  return `${who} uploaded a new ${label} for ${patientName}: ${title}.`;
};

const patientDisplayName = (profile) =>
  [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'A patient';

const pushSocket = (room, event, payload) => {
  try {
    const io = getIo();
    if (io) io.to(room).emit(event, payload);
  } catch (error) {
    logger.warn({ err: error, event }, 'Failed to push report-notice socket event.');
  }
};

/**
 * Drops a REPORT_NOTICE into the doctor's conversation with the patient
 * and raises a generic in-app notification. Entirely best-effort per
 * doctor — a failure here must never fail (or roll back) the upload.
 */
const notifyDoctor = async ({ doctorId, report, patientProfile, actor, text }) => {
  try {
    const conversation = await ensureConversationForPair({
      patientProfile,
      doctorId,
      createdBy: actor._id,
    });

    const message = await Message.create({
      conversation: conversation._id,
      sender: actor._id,
      recipient: doctorId,
      messageType: 'REPORT_NOTICE',
      content: text,
      relatedReport: report._id,
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: { lastMessageAt: new Date(), lastMessageSender: actor._id },
        $inc: { 'unreadCount.doctor': 1 },
      },
    );

    pushSocket(conversationRoom(conversation._id), 'message:new', {
      conversationId: String(conversation._id),
      message: {
        id: String(message._id),
        sender: String(actor._id),
        recipient: String(doctorId),
        messageType: message.messageType,
        content: message.content,
        relatedReport: String(report._id),
        createdAt: message.createdAt,
      },
    });

    await createNotification({
      recipientId: doctorId,
      type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
      title: 'New report submitted',
      body: 'A new patient report is waiting for your review.',
      relatedResource: { type: 'MEDICAL_REPORT', id: report._id },
    });

    return true;
  } catch (error) {
    logger.warn({ err: error, reportId: report._id, doctorId }, 'Failed to notify doctor of submitted report.');
    return false;
  }
};

// ---------------------------------------------------------------
// Submit
// ---------------------------------------------------------------
export const submitReport = async (body, file, actor, requestMeta = {}) => {
  const isPatient = actor.role === ROLES.PATIENT;

  let patientProfile;
  if (isPatient) {
    if (!PATIENT_INTAKE_MIME_TYPES.includes(file.mimetype)) {
      throw new AppError('Please upload a photo (JPG, PNG, WebP) or a PDF of your report.', 400, {
        code: 'UNSUPPORTED_FILE_TYPE',
      });
    }
    patientProfile = await PatientProfile.findOne({ user: actor._id });
    if (!patientProfile) {
      throw new AppError('Patient profile not found.', 404, { code: 'PATIENT_PROFILE_NOT_FOUND' });
    }
  } else {
    if (!body.patientProfileId) {
      throw new AppError('patientProfileId is required.', 400, { code: 'VALIDATION_ERROR' });
    }
    patientProfile = await findPatientProfileOrThrow(body.patientProfileId);
  }

  const targetDoctorId = body.targetDoctorId || null;
  if (targetDoctorId) {
    await assertActiveDoctor(targetDoctorId);
  }

  const isSensitive = SENSITIVE_STANDALONE_REPORT_TYPES.includes(body.reportType);
  const providerId = patientProfile.primaryCareProvider || null;

  const routedTo = resolveRoutedDoctorIds({
    targetDoctorId,
    primaryCareProvider: providerId,
    isSensitive,
  });

  // A patient must choose who receives their report. Staff uploading on a
  // patient's behalf may leave the doctor blank: the document is still
  // filed on the patient's record (readable by doctors from the patient's
  // timeline) but sits in no doctor's inbox and sends no notice.
  if (routedTo.length === 0 && isPatient) {
    throw new AppError('Choose a doctor to send this report to.', 400, { code: 'NO_DOCTOR_SELECTED' });
  }

  const source = isPatient ? 'PATIENT_SUBMITTED' : 'STAFF_ON_BEHALF';

  const report = await uploadReport(
    {
      patientProfileId: String(patientProfile._id),
      reportType: body.reportType,
      documentSubType: body.documentSubType,
      // Ordering doctor is staff-supplied metadata; a patient cannot set it.
      orderingDoctorId: isPatient ? undefined : body.orderingDoctorId || undefined,
      title: body.title,
      reportDate: body.reportDate,
      performingFacility: body.performingFacility,
      ocrLanguage: body.ocrLanguage,
    },
    file,
    actor,
    requestMeta,
    {
      submission: {
        source,
        targetDoctor: targetDoctorId,
        routedTo,
        patientNote: body.patientNote,
      },
    },
  );

  const patientName = patientDisplayName(patientProfile);
  const uploaderName = isPatient ? patientName : (await User.findById(actor._id).select('name'))?.name;

  // Everyone who should hear about it: the routed doctors, plus a
  // picked-but-restricted target so they aren't left wondering (they
  // get the generic restricted notice, not the details).
  const recipients = new Set(routedTo);
  if (targetDoctorId) recipients.add(idOf(targetDoctorId));

  const delivered = [];
  for (const doctorId of recipients) {
    const restricted = false;
    const ok = await notifyDoctor({
      doctorId,
      report,
      patientProfile,
      actor,
      text: buildReportNoticeText({
        patientName,
        uploaderName,
        uploaderRole: actor.role,
        isSelfSubmitted: isPatient,
        title: report.title,
        reportType: report.reportType,
        restricted,
      }),
    });
    if (ok) delivered.push(doctorId);
  }

  return {
    report,
    routing: {
      routedTo,
      notified: delivered,
      unrouted: routedTo.length === 0,
      isSensitive,
      // True when the patient picked a doctor who is not the assigned
      // provider and the report is restricted: that doctor was told a
      // restricted document exists but cannot open it.
      targetRestricted: false,
    },
  };
};

// ---------------------------------------------------------------
// Doctor inbox
// ---------------------------------------------------------------
const inboxScopeFor = async (actor, { doctorId } = {}) => {
  if (isAdminTier(actor)) {
    return doctorId ? { 'submission.routedTo': doctorId } : {};
  }
  if (actor.role !== ROLES.DOCTOR) {
    throw new AppError('You do not have permission to perform this action.', 403, { code: 'FORBIDDEN' });
  }

  // Inbox = items routed to this doctor (any report type).
  return { 'submission.routedTo': actor._id };
};

// Inbox row: NEW until a doctor has accepted/rejected it, then REVIEWED.
// `verificationStatus` is reported separately — accepted is not verified.
const toInboxItem = (report) => {
  const r = typeof report.toObject === 'function' ? report.toObject() : report;
  return {
    ...r,
    inboxState: r.submission?.intakeStatus === 'PENDING_REVIEW' ? 'NEW' : 'REVIEWED',
    verificationStatus: ['VERIFIED', 'FINALIZED', 'AMENDED'].includes(r.status) ? 'VERIFIED' : 'UNVERIFIED',
    uploadedBy: r.createdBy ? { name: r.createdBy.name ?? null, role: r.createdBy.role ?? r.submission?.uploadedByRole ?? null } : null,
  };
};

export const listIntake = async (
  { intakeStatus = 'PENDING_REVIEW', doctorId, patientProfileId, page = 1, limit = 20 },
  actor,
) => {
  const filter = {
    ...(await inboxScopeFor(actor, { doctorId })),
    // ALL = new + reviewed together (the inbox view); unrouted staff
    // uploads carry no intake status and never appear.
    'submission.intakeStatus': intakeStatus === 'ALL' ? { $in: ['PENDING_REVIEW', 'ACCEPTED', 'REJECTED'] } : intakeStatus,
  };
  if (patientProfileId) filter.patientProfile = patientProfileId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MedicalReport.find(filter)
      // Keep the list light and free of extracted result content; the
      // full report is opened through the normal access-checked route.
      .select(
        'reportReference patientProfile patient reportType title status isSensitive uploadDate reportDate submission originalDocument.originalFilename originalDocument.mimeType possibleDuplicateOf createdBy',
      )
      .populate('patientProfile', 'patientId firstName lastName')
      .populate('submission.targetDoctor', 'name')
      .populate('createdBy', 'name role')
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(limit),
    MedicalReport.countDocuments(filter),
  ]);

  return { items: items.map(toInboxItem), page, limit, total };
};

export const getIntakeSummary = async (actor, { doctorId } = {}) => {
  const scope = await inboxScopeFor(actor, { doctorId });
  const pending = await MedicalReport.countDocuments({
    ...scope,
    'submission.intakeStatus': 'PENDING_REVIEW',
  });
  return { pending };
};

// ---------------------------------------------------------------
// Review
// ---------------------------------------------------------------
export const reviewIntake = async (id, { decision, note = '' }, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);

  const notFound = () => new AppError('Submission not found.', 404, { code: 'SUBMISSION_NOT_FOUND' });

  if (!report.submission?.intakeStatus) throw notFound();

  const isRouted = (report.submission.routedTo || []).some((d) => String(d) === String(actor._id));
  if (!isAdminTier(actor) && !isRouted) throw notFound();

  // Runs the sensitive-record (assigned-provider) check for sensitive
  // reports and writes the access-log entry.
  await enforceReportAccess({ actor, report, write: true, action: 'INTAKE_REVIEW', requestMeta });

  if (report.submission.intakeStatus !== 'PENDING_REVIEW') {
    throw new AppError('This submission has already been reviewed.', 409, { code: 'ALREADY_REVIEWED' });
  }

  const now = new Date();

  if (decision === 'ACCEPT') {
    if (['REJECTED', 'CANCELLED'].includes(report.status)) {
      throw new AppError(`A ${report.status.toLowerCase()} report cannot be accepted.`, 409, {
        code: 'INVALID_STATUS_TRANSITION',
      });
    }
    report.history.push({
      action: 'INTAKE_ACCEPTED',
      fromStatus: report.status,
      toStatus: report.status,
      actor: actor._id,
      reason: note,
    });
    report.submission.intakeStatus = 'ACCEPTED';
  } else {
    if (['UPLOADED', 'PROCESSING'].includes(report.status)) {
      throw new AppError('Text extraction is still running. Try again in a moment.', 409, {
        code: 'EXTRACTION_IN_PROGRESS',
      });
    }
    transitionReport(report, 'REJECTED', { action: 'INTAKE_REJECTED', reason: note }, actor);
    report.rejectionReason = note;
    report.submission.intakeStatus = 'REJECTED';
  }

  report.submission.reviewedBy = actor._id;
  report.submission.reviewedAt = now;
  report.submission.reviewNote = note;
  report.updatedBy = actor._id;
  await report.save();

  // Generic on purpose: the reason for a rejection is communicated
  // in the secure conversation, not in a notification body. "Received"
  // deliberately does not say "verified".
  try {
    await createNotification({
      recipientId: report.patient,
      type: NOTIFICATION_TYPES.REPORT_INTAKE_REVIEWED,
      title: 'Report reviewed',
      body:
        decision === 'ACCEPT'
          ? 'A doctor has received the report you submitted.'
          : 'A doctor could not use the report you submitted. Please check your messages.',
      relatedResource: { type: 'MEDICAL_REPORT', id: report._id },
    });
  } catch (error) {
    logger.warn({ err: error, reportId: report._id }, 'Failed to notify patient of intake review.');
  }

  return report;
};

// ---------------------------------------------------------------
// Share report with another doctor
// ---------------------------------------------------------------
export const shareReport = async (id, { targetDoctorId, note = '' }, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);

  if (actor.role === ROLES.PATIENT) {
    if (String(report.patient) !== String(actor._id)) {
      throw new AppError('You can only share your own reports.', 403, { code: 'FORBIDDEN' });
    }
    await logReportAccess({
      actor,
      report,
      patientProfile: report.patientProfile,
      action: 'REPORT_SHARE',
      outcome: 'ALLOWED',
      ...requestMeta,
    });
  } else {
    await enforceReportAccess({ actor, report, write: true, action: 'REPORT_SHARE', requestMeta });
  }

  await assertActiveDoctor(targetDoctorId);

  const patientProfile = await PatientProfile.findById(report.patientProfile);
  if (!patientProfile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PATIENT_PROFILE_NOT_FOUND' });
  }

  const isSensitive = report.isSensitive || SENSITIVE_STANDALONE_REPORT_TYPES.includes(report.reportType);
  const providerId = patientProfile.primaryCareProvider || null;

  if (!report.submission) {
    report.submission = {
      source: actor.role === ROLES.PATIENT ? 'PATIENT_SUBMITTED' : 'STAFF_ON_BEHALF',
      routedTo: [],
      intakeStatus: 'PENDING_REVIEW',
    };
  }

  const targetDocStr = String(targetDoctorId);
  const currentRouted = (report.submission.routedTo || []).map((d) => String(d));
  if (!currentRouted.includes(targetDocStr)) {
    report.submission.routedTo.push(targetDoctorId);
  }

  report.submission.targetDoctor = targetDoctorId;
  if (!report.submission.intakeStatus) {
    report.submission.intakeStatus = 'PENDING_REVIEW';
  }
  if (note) {
    report.submission.patientNote = note;
  }

  report.history.push({
    action: 'REPORT_SHARED',
    fromStatus: report.status,
    toStatus: report.status,
    actor: actor._id,
    reason: note || `Shared with doctor ${targetDoctorId}`,
  });

  await report.save();

  const patientName = patientDisplayName(patientProfile);
  const uploaderName = actor.role === ROLES.PATIENT ? patientName : (await User.findById(actor._id).select('name'))?.name;

  await notifyDoctor({
    doctorId: targetDoctorId,
    report,
    patientProfile,
    actor,
    text: buildReportNoticeText({
      patientName,
      uploaderName,
      uploaderRole: actor.role,
      isSelfSubmitted: actor.role === ROLES.PATIENT,
      title: report.title,
      reportType: report.reportType,
      restricted: false,
    }),
  });

  return {
    report,
    routing: {
      routedTo: report.submission.routedTo,
      notified: [targetDoctorId],
      isSensitive,
    },
  };
};
