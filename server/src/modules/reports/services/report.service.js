import mongoose from 'mongoose';
// Import the package's internal lib directly, not the package root
// (`pdf-parse`). `pdf-parse@1.x`'s root `index.js` has a long-standing
// upstream bug: it gates a debug/self-test block on
// `isDebugMode = !module.parent`, which is meant to be `false` for any
// normal `require()`-based consumer. Under Node's ESM→CJS interop,
// `import`-ing a CJS package does not populate `module.parent` the same
// way `require()` does, so `isDebugMode` evaluates `true` here — the
// package then eagerly `readFileSync`s a fixture PDF that only exists
// inside its own test suite (`./test/data/05-versions-space.pdf`,
// resolved relative to `process.cwd()`, not the package directory) and
// throws `ENOENT` at import time. Because this import sits at the top of
// a file `app.js` pulls in through `report.routes.js`, the failure was
// fatal to the entire server's boot, not just PDF report extraction —
// discovered only once this sandbox first had npm-registry access to
// actually run `npm install` and boot a live server (see
// SESSION_HANDOFF.md's BET-15 section). Importing `pdf-parse/lib/pdf-parse.js`
// (the actual parser the root `index.js` just re-exports) skips that
// debug block entirely and is otherwise behavior-identical.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

import {
  MedicalReport,
  REPORT_STATUSES,
} from '../models/medical-report.model.js';
import { Investigation } from '../../investigations/models/investigation.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import {
  findPatientProfileOrThrow,
  markInvestigationCompletedFromReport,
} from '../../investigations/services/investigation.service.js';
import { enforceSensitiveRecordAccess } from '../../gynecology/services/sensitive-record-access.service.js';
import { enforceReportAccess, logReportAccess, isAdminTier } from './report-access.service.js';
import { runOcr } from './ocr.service.js';
import { parseLabStyleText, shouldAttemptLabParsing } from './extraction-parser.service.js';
import { extractSpreadsheet, spreadsheetRowsToText } from './spreadsheet-extraction.service.js';
import { extractOfficeMetadata } from './office-metadata.service.js';
import { uploadReportFile, getReportFileBuffer, computeFileHash, deleteReportFile } from './report-storage.service.js';
import { sanitizeFilename } from '../../../security/file-security.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { toPatientView } from './report-patient-view.js';
import { User } from '../../../users/user.model.js';
import { logger } from '../../../config/logger.js';
import sanitizeHtml from 'sanitize-html';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const stripMarkup = (value) =>
  typeof value === 'string'
    ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    : value;

const sanitizeStructuredValue = (value, depth = 0) => {
  if (depth > 6) return null;
  if (typeof value === 'string') return stripMarkup(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeStructuredValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [stripMarkup(key), sanitizeStructuredValue(item, depth + 1)]),
    );
  }
  return value;
};

const parseReferenceRange = (referenceRange) => {
  if (!referenceRange) return null;
  const match = String(referenceRange).trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)$/i);
  if (!match) return { valid: false };
  const low = Number(match[1]);
  const high = Number(match[2]);
  return { valid: Number.isFinite(low) && Number.isFinite(high) && low <= high, low, high };
};

const validateParameterInput = (parameter, { allowMissingValue = false } = {}) => {
  if (!parameter?.name || !String(parameter.name).trim()) {
    throw new AppError('Result parameter name is required.', 400, { code: 'VALIDATION_ERROR' });
  }

  const value = parameter.value;
  if (!allowMissingValue && (value === undefined || value === null || String(value).trim() === '')) {
    throw new AppError(`A value is required for "${parameter.name}".`, 400, { code: 'VALIDATION_ERROR' });
  }

  if (parameter.numericValue !== undefined && parameter.numericValue !== null && !Number.isFinite(Number(parameter.numericValue))) {
    throw new AppError(`Numeric value for "${parameter.name}" is invalid.`, 400, { code: 'VALIDATION_ERROR' });
  }

  if (parameter.referenceRange) {
    const parsed = parseReferenceRange(parameter.referenceRange);
    if (!parsed?.valid) {
      throw new AppError(`Reference range for "${parameter.name}" has an invalid structure.`, 400, {
        code: 'INVALID_REFERENCE_RANGE',
      });
    }
  }
};

const validateReportForFinalization = async (report) => {
  if (!report.patientProfile || !report.originalDocument?.cloudinaryPublicId) {
    throw new AppError('Report is missing its required patient or original document.', 409, {
      code: 'REPORT_INCOMPLETE',
    });
  }

  if (!report.title || !report.reportType) {
    throw new AppError('Report title and report type are required before finalization.', 409, {
      code: 'REPORT_INCOMPLETE',
    });
  }

  if (report.investigation) {
    const investigation = await Investigation.findById(report.investigation).select('patientProfile status').lean();
    if (!investigation || String(investigation.patientProfile) !== String(report.patientProfile._id ?? report.patientProfile)) {
      throw new AppError('Linked investigation is missing or does not belong to this patient.', 409, {
        code: 'INVALID_INVESTIGATION_LINK',
      });
    }
  }

  for (const parameter of report.parameters) {
    validateParameterInput(parameter);
    if (parameter.verification.status === 'PENDING') {
      throw new AppError('Every extracted/manual parameter must be reviewed before finalization.', 409, {
        code: 'PARAMETERS_PENDING_REVIEW',
      });
    }
  }
};

/**
 * Report types whose reproductive/sexual-health nature is implicit
 * in the type itself, for a *standalone* upload with no linked
 * `Investigation` (which would otherwise supply `isSensitive`
 * directly). Deliberately narrow and conservative — see
 * `orderInvestigation`'s equivalent `SENSITIVE_INVESTIGATION_CATEGORIES`
 * for the fuller, category-driven classification used whenever an
 * investigation link is available.
 */
export const SENSITIVE_STANDALONE_REPORT_TYPES = ['PAP_SMEAR', 'ULTRASOUND'];

const ALLOWED_REPORT_TRANSITIONS = Object.freeze({
  UPLOADED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['EXTRACTED', 'EXTRACTION_FAILED', 'CANCELLED'],
  EXTRACTED: ['NEEDS_REVIEW', 'CANCELLED'],
  NEEDS_REVIEW: ['VERIFIED', 'REJECTED', 'CANCELLED'],
  // REJECTED is reachable from a failed extraction so a doctor can turn
  // away an unreadable/irrelevant patient submission from the intake
  // inbox. Deliberately NOT reachable from UPLOADED/PROCESSING, where the
  // extraction pipeline may still be mid-write.
  EXTRACTION_FAILED: ['NEEDS_REVIEW', 'PROCESSING', 'REJECTED', 'CANCELLED'],
  VERIFIED: ['FINALIZED', 'CANCELLED'],
  FINALIZED: ['AMENDED'],
  AMENDED: [],
  REJECTED: [],
  CANCELLED: [],
});

const pushHistory = (report, { action, toStatus, actor, reason = '' }) => {
  report.history.push({
    action,
    fromStatus: report.status,
    toStatus,
    actor: actor?._id ?? null,
    reason,
  });
};

const transition = (report, toStatus, { action, reason }, actor) => {
  const allowed = ALLOWED_REPORT_TRANSITIONS[report.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new AppError(`Cannot move report from ${report.status} to ${toStatus}.`, 409, {
      code: 'INVALID_STATUS_TRANSITION',
    });
  }
  pushHistory(report, { action, toStatus, actor, reason });
  report.status = toStatus;
};

const generateReportReference = async () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const prefix = `RPT-${y}${m}${d}`;

  const latest = await MedicalReport.findOne({ reportReference: { $regex: `^${prefix}-` } })
    .sort({ reportReference: -1 })
    .select('reportReference')
    .lean();

  let nextSequence = 1;
  if (latest?.reportReference) {
    const match = latest.reportReference.match(/-(\d{4})$/);
    if (match) nextSequence = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
};

export const findReportOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid report id.', 400, { code: 'INVALID_ID' });
  }
  const report = await MedicalReport.findById(id).populate(
    'patientProfile',
    'user primaryCareProvider patientId firstName lastName',
  );
  if (!report) {
    throw new AppError('Report not found.', 404, { code: 'REPORT_NOT_FOUND' });
  }
  return report;
};

// ---------------------------------------------------------------
// BET-12.27 — Asynchronous extraction pipeline. Fire-and-forget from
// `uploadReport`/`retryExtraction`; never lets a failure escape
// uncaught (would otherwise be an unhandled promise rejection).
// There is no durable job queue in this project yet (no Bull/BullMQ
// dependency, per master prompt §BET-12.27 "do not introduce a
// complex queue system unnecessarily if the current application is
// not ready for it") — this is deliberately a same-process async
// function, not a persisted job. A report stuck mid-`PROCESSING` from
// a server restart is a known limitation; `retryExtraction` lets an
// authorized user re-trigger it manually.
// ---------------------------------------------------------------
export const runExtractionPipeline = async (reportId, { language } = {}) => {
  let report;
  try {
    // Atomically claim the job. This prevents duplicate extraction workers
    // from processing the same report concurrently after retries, double
    // uploads, or repeated HTTP requests.
    const now = new Date();
    report = await MedicalReport.findOneAndUpdate(
      {
        _id: reportId,
        status: { $in: ['UPLOADED', 'EXTRACTION_FAILED'] },
        'extraction.attempts': { $lt: 5 },
      },
      {
        $set: {
          status: 'PROCESSING',
          'extraction.status': 'RUNNING',
          'extraction.startedAt': now,
          'extraction.completedAt': null,
          'extraction.error': null,
        },
        $inc: { 'extraction.attempts': 1 },
        $push: {
          history: {
            action: 'OCR_STARTED',
            fromStatus: 'UPLOADED',
            toStatus: 'PROCESSING',
            actor: null,
            reason: '',
            at: now,
          },
        },
      },
      { new: true },
    );

    if (!report) return;

    // Correct the history's fromStatus when this was a retry.
    const lastHistory = report.history[report.history.length - 1];
    if (lastHistory?.action === 'OCR_STARTED' && lastHistory.fromStatus === 'UPLOADED' && report.extraction.attempts > 1) {
      lastHistory.fromStatus = 'EXTRACTION_FAILED';
      await report.save();
    }

    const buffer = await getReportFileBuffer({
      cloudinaryPublicId: report.originalDocument.cloudinaryPublicId,
      cloudinaryResourceType: report.originalDocument.cloudinaryResourceType,
    });

    const mimeType = report.originalDocument.mimeType;
    let extractionResult;

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      try {
        const spreadsheet = extractSpreadsheet({ buffer, mimeType });
        if (spreadsheet.supported === false) {
          extractionResult = {
            status: 'UNSUPPORTED',
            error: spreadsheet.reason || 'Spreadsheet extraction requires manual entry.',
            provider: 'spreadsheet-parser',
            providerVersion: '1',
            language: language || null,
          };
        } else {
          const text = spreadsheetRowsToText(spreadsheet);
          extractionResult = {
            status: 'COMPLETED',
            text,
            confidence: null,
            provider: 'spreadsheet-parser',
            providerVersion: '1',
            language: language || null,
            spreadsheet,
          };
        }
      } catch (spreadsheetError) {
        logger.warn({ err: spreadsheetError, reportId }, 'Spreadsheet extraction failed; manual review required.');
        extractionResult = {
          status: 'FAILED',
          error: 'Spreadsheet extraction failed; use manual entry.',
          provider: 'spreadsheet-parser',
          providerVersion: '1',
          language: language || null,
        };
      }
    } else if (mimeType === 'application/pdf') {
      // Fast path: most lab/imaging PDFs already have a real text
      // layer — no need to rasterize + OCR a digital document.
      try {
        const parsed = await pdfParse(buffer);
        report.originalDocument.pageCount = parsed.numpages ?? report.originalDocument.pageCount;
        if (parsed.text && parsed.text.trim().length > 20) {
          extractionResult = {
            status: 'COMPLETED',
            text: parsed.text,
            confidence: 0.99,
            provider: 'pdf-text-layer',
            providerVersion: null,
            language: language || null,
          };
        }
      } catch (pdfError) {
        logger.warn({ err: pdfError, reportId }, 'pdf-parse failed; falling back to OCR.');
      }

      if (!extractionResult) {
        extractionResult = await runOcr({ buffer, mimeType, language });
      }
    } else {
      extractionResult = await runOcr({ buffer, mimeType, language });
    }

    if (extractionResult.status !== 'COMPLETED') {
      report.extraction.status = 'FAILED';
      report.extraction.error = extractionResult.error || 'Extraction did not complete.';
      report.extraction.completedAt = new Date();
      transition(report, 'EXTRACTION_FAILED', { action: 'OCR_FAILED', reason: report.extraction.error }, null);
      await report.save();
      await logReportAccess({
        report,
        patientProfile: report.patientProfile,
        action: 'OCR_FAILED',
        outcome: 'ALLOWED',
      });
      return;
    }

    report.extraction.status = 'COMPLETED';
    report.extraction.provider = extractionResult.provider === 'pdf-text-layer' ? 'pdf-text-layer' : extractionResult.provider;
    report.extraction.providerVersion = extractionResult.providerVersion || null;
    report.extraction.language = extractionResult.language || null;
    report.extraction.extractedText = extractionResult.text || '';
    report.extraction.confidence = extractionResult.confidence ?? null;
    report.extraction.completedAt = new Date();

    if (extractionResult.spreadsheet) {
      report.structuredSections = {
        ...report.structuredSections,
        spreadsheet: {
          format: extractionResult.spreadsheet.format,
          headers: sanitizeStructuredValue(extractionResult.spreadsheet.headers),
          rows: sanitizeStructuredValue(extractionResult.spreadsheet.rows),
          rowCount: extractionResult.spreadsheet.rowCount,
        },
      };
    }

    if (shouldAttemptLabParsing(report.reportType)) {
      const { parameters, unparsedLines } = parseLabStyleText(extractionResult.text || '', {
        source: extractionResult.provider === 'spreadsheet-parser'
          ? 'SPREADSHEET'
          : extractionResult.provider === 'pdf-text-layer'
            ? 'PDF_TEXT_LAYER'
            : 'OCR',
        defaultConfidence: extractionResult.confidence !== null && extractionResult.confidence >= 0.9 ? 'HIGH' : null,
      });
      report.parameters = parameters.map((p) => ({
        ...p,
        verification: { status: 'PENDING', verifiedBy: null, verifiedAt: null, correctionReason: '' },
      }));
      report.extraction.unparsedLines = unparsedLines.slice(0, 200); // sane cap
    } else {
      report.structuredSections = { ...report.structuredSections, rawText: extractionResult.text || '' };
    }

    transition(report, 'EXTRACTED', { action: 'OCR_COMPLETED' }, null);
    transition(report, 'NEEDS_REVIEW', { action: 'READY_FOR_REVIEW' }, null);
    await report.save();

    await logReportAccess({
      report,
      patientProfile: report.patientProfile,
      action: 'OCR_COMPLETED',
      outcome: 'ALLOWED',
    });
  } catch (error) {
    logger.error({ err: error, reportId }, 'Unexpected error in extraction pipeline.');
    try {
      if (report) {
        report.extraction.status = 'FAILED';
        report.extraction.error = 'Unexpected extraction error.';
        report.extraction.completedAt = new Date();
        if ((ALLOWED_REPORT_TRANSITIONS[report.status] || []).includes('EXTRACTION_FAILED')) {
          transition(report, 'EXTRACTION_FAILED', { action: 'OCR_FAILED', reason: 'Unexpected error.' }, null);
        }
        await report.save();
      }
    } catch (saveError) {
      logger.error({ err: saveError, reportId }, 'Failed to persist extraction failure state.');
    }
  }
};

// ---------------------------------------------------------------
// Upload
// ---------------------------------------------------------------
/**
 * @param {object} [options]
 * @param {object} [options.submission] Present only for the intake flow
 *   (`report-intake.service.js`): `{ source, targetDoctor, routedTo,
 *   patientNote }`. When set, the report is created as an unverified
 *   submission awaiting doctor intake review, and the sensitive-record
 *   WRITE check is skipped (see below).
 */
export const uploadReport = async (
  { patientProfileId, investigationId, orderingDoctorId, reportType, documentSubType, title, clinicalIndication, reportDate, performingFacility, ocrLanguage },
  file,
  actor,
  requestMeta = {},
  { submission = null } = {},
) => {
  const patientProfile = await findPatientProfileOrThrow(patientProfileId);

  let investigation = null;
  if (investigationId) {
    if (!isValidObjectId(investigationId)) {
      throw new AppError('Invalid investigation id.', 400, { code: 'INVALID_ID' });
    }
    investigation = await Investigation.findById(investigationId);
    if (!investigation) {
      throw new AppError('Investigation not found.', 404, { code: 'INVESTIGATION_NOT_FOUND' });
    }
    if (String(investigation.patientProfile) !== String(patientProfile._id)) {
      throw new AppError('Investigation does not belong to this patient.', 400, {
        code: 'INVESTIGATION_PATIENT_MISMATCH',
      });
    }
  }

  // Optional ordering doctor (staff-supplied, when there is no linked
  // investigation). Deliberately separate from submission.targetDoctor.
  let orderingDoctor = null;
  if (orderingDoctorId && !investigation) {
    if (!isValidObjectId(orderingDoctorId)) {
      throw new AppError('Invalid ordering doctor id.', 400, { code: 'INVALID_ID' });
    }
    orderingDoctor = await User.findOne({ _id: orderingDoctorId, role: ROLES.DOCTOR }).select('_id');
    if (!orderingDoctor) {
      throw new AppError('Ordering doctor not found.', 404, { code: 'DOCTOR_NOT_FOUND' });
    }
  }

  const isSensitive = investigation
    ? investigation.isSensitive
    : SENSITIVE_STANDALONE_REPORT_TYPES.includes(reportType);

  // Intake submissions are a write-only drop box: a patient (or a
  // nurse/receptionist with no sensitive-record grant) can hand a
  // document over, but gains no read access to it. The report is still
  // flagged `isSensitive`, so every READ of it — including the doctor's
  // intake review — still goes through `enforceReportAccess` and the
  // BET-07 assigned-provider check. Ordinary staff uploads keep the
  // original write check unchanged.
  if (isSensitive && !submission) {
    await enforceSensitiveRecordAccess({
      actor,
      patientProfile,
      write: true,
      action: 'CREATE',
      resource: 'medical_report',
      requestMeta,
    });
  }

  const fileHash = computeFileHash(file.buffer);

  const possibleDuplicates = await MedicalReport.find({
    patientProfile: patientProfile._id,
    'originalDocument.fileHash': fileHash,
  })
    .select('_id')
    .lean();

  const { cloudinaryPublicId, cloudinaryResourceType } = await uploadReportFile({
    buffer: file.buffer,
    storageFilename: file.storageFilename,
    mimeType: file.mimetype,
    patientProfileId: String(patientProfile._id),
  });

  const reportReference = await generateReportReference();

  // BET-12.32 — read embedded document metadata (title / page count) for
  // .docx/.xlsx uploads at upload time, same as PDF page count is read
  // during extraction. Never blocks or fails the upload: any parsing
  // problem yields `{ title: null, pageCount: null }` (see
  // office-metadata.service.js).
  const officeMetadata = extractOfficeMetadata(file.buffer, file.mimetype);

  const report = new MedicalReport({
    reportReference,
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    investigation: investigation?._id || null,
    orderingDoctor: investigation?.orderedBy || orderingDoctor?._id || null,
    performingFacility: stripMarkup(performingFacility || ''),
    reportType,
    documentSubType: documentSubType || null,
    title: stripMarkup(title),
    clinicalIndication: stripMarkup(clinicalIndication || ''),
    isSensitive,
    reportDate: reportDate ? new Date(reportDate) : null,
    status: 'UPLOADED',
    originalDocument: {
      storageFilename: file.storageFilename,
      originalFilename: sanitizeFilename(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      fileHash,
      cloudinaryPublicId,
      cloudinaryResourceType,
      pageCount: officeMetadata.pageCount,
      embeddedTitle: officeMetadata.title,
    },
    possibleDuplicateOf: possibleDuplicates.map((d) => d._id),
    submission: submission
      ? {
          source: submission.source,
          uploadedByRole: actor.role,
          patientNote: stripMarkup(submission.patientNote || ''),
          targetDoctor: submission.targetDoctor || null,
          routedTo: submission.routedTo || [],
          // Only items routed to a doctor enter an inbox for review.
          intakeStatus: (submission.routedTo || []).length > 0 ? 'PENDING_REVIEW' : null,
        }
      : undefined,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  pushHistory(report, {
    action: submission ? 'SUBMITTED' : 'UPLOADED',
    toStatus: 'UPLOADED',
    actor,
  });

  try {
    await report.save();
  } catch (error) {
    await deleteReportFile({ cloudinaryPublicId, cloudinaryResourceType });
    throw error;
  }

  await logReportAccess({
    actor,
    report,
    patientProfile,
    action: 'UPLOAD',
    outcome: 'ALLOWED',
    ...requestMeta,
  });

  logger.info(
    { reportId: report._id, patientProfileId, reportType, isSensitive, possibleDuplicates: possibleDuplicates.length },
    'Medical report uploaded.',
  );

  // Fire-and-forget: the upload request returns immediately (master
  // prompt §BET-12.27 — "do not make a normal API request wait
  // indefinitely for OCR"); the report starts life as UPLOADED and
  // moves through PROCESSING asynchronously.
  runExtractionPipeline(report._id, { language: ocrLanguage }).catch((error) => {
    logger.error({ err: error, reportId: report._id }, 'Extraction pipeline threw unexpectedly.');
  });

  return report;
};

// ---------------------------------------------------------------
// Read
// ---------------------------------------------------------------
// A patient sees their own report once it is finalized/amended — and,
// regardless of status, the documents that came in through the intake
// flow (their own submission, or one staff attached on their behalf) so
// they can see what was received. Those are shown as unverified by the
// client; nothing here marks them verified.
const INTAKE_SOURCES = ['PATIENT_SUBMITTED', 'STAFF_ON_BEHALF'];

const isVisibleToOwningPatient = (report) =>
  ['FINALIZED', 'AMENDED'].includes(report.status) ||
  (INTAKE_SOURCES.includes(report.submission?.source) && report.status !== 'CANCELLED');

export const getReportById = async (id, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: false, action: 'VIEW', requestMeta });

  if (actor.role === ROLES.PATIENT && !isVisibleToOwningPatient(report)) {
    throw new AppError('This medical report is not yet available in the patient portal.', 404, {
      code: 'REPORT_NOT_AVAILABLE',
    });
  }

  return actor.role === ROLES.PATIENT ? toPatientView(report) : report;
};

export const getMyReports = async (actor, { page = 1, limit = 20, investigationId } = {}) => {
  const filter = {
    patient: actor._id,
    $or: [
      { status: { $in: ['FINALIZED', 'AMENDED'] } },
      { 'submission.source': { $in: INTAKE_SOURCES }, status: { $ne: 'CANCELLED' } },
    ],
  };

  if (investigationId) {
    if (!isValidObjectId(investigationId)) {
      throw new AppError('Invalid investigation id.', 400, { code: 'INVALID_ID' });
    }
    filter.investigation = investigationId;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MedicalReport.find(filter).sort({ uploadDate: -1 }).skip(skip).limit(limit),
    MedicalReport.countDocuments(filter),
  ]);

  return { items: items.map(toPatientView), page, limit, total };
};

export const listReports = async (
  {
    patientProfileId,
    investigationId,
    orderingDoctorId,
    reportType,
    status,
    verificationStatus,
    search,
    dateFrom,
    dateTo,
    page = 1,
    limit = 20,
  },
  actor,
) => {
  const filter = {};

  if (patientProfileId) {
    if (!isValidObjectId(patientProfileId)) {
      throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
    }
    filter.patientProfile = patientProfileId;
  }

  if (investigationId) {
    if (!isValidObjectId(investigationId)) {
      throw new AppError('Invalid investigation id.', 400, { code: 'INVALID_ID' });
    }
    filter.investigation = investigationId;
  }

  if (orderingDoctorId) {
    if (!isValidObjectId(orderingDoctorId)) {
      throw new AppError('Invalid ordering doctor id.', 400, { code: 'INVALID_ID' });
    }
    filter.orderingDoctor = orderingDoctorId;
  }

  if (reportType) filter.reportType = reportType;
  if (status) filter.status = status;
  if (verificationStatus) filter['verification.status'] = verificationStatus;

  // BET-12.29 date-range filter. `reportDate` (the date printed on the
  // report) is what a user filtering "reports from March" actually means,
  // but it's optional on the model — many reports only ever get
  // `uploadDate` set. Rather than silently excluding every report that has
  // no `reportDate`, match on `reportDate` when it's present and fall back
  // to `uploadDate` for documents where it isn't, so the filter behaves the
  // way a clinical user expects instead of quietly under-reporting results.
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    if (dateTo) range.$lte = new Date(dateTo);

    const dateClause = {
      $or: [{ reportDate: range }, { reportDate: null, uploadDate: range }],
    };

    if (filter.$and) {
      filter.$and.push(dateClause);
    } else {
      filter.$and = [dateClause];
    }
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { reportReference: { $regex: escaped, $options: 'i' } },
      { title: { $regex: escaped, $options: 'i' } },
      { 'originalDocument.originalFilename': { $regex: escaped, $options: 'i' } },
      { performingFacility: { $regex: escaped, $options: 'i' } },
    ];
  }

  const isAdmin = isAdminTier(actor);
  const isDoctor = actor.role === ROLES.DOCTOR;

  if (!isAdmin && !isDoctor) {
    filter.isSensitive = { $ne: true };
  } else if (isDoctor) {
    // Any doctor may list every patient's reports, sensitive types
    // included (product decision 2026-10). Reads stay audited by
    // `enforceReportAccess`; writes keep the assigned-provider rule.
    const accessClause = {
      $or: [{ isSensitive: { $ne: true } }, { isSensitive: true }],
    };

    // Fold the doctor-ownership clause into `filter.$and` alongside any
    // date-range clause already placed there above, instead of
    // reassigning `filter.$and` outright — a plain reassignment here would
    // silently discard the BET-12.29 date-range clause whenever both a
    // date range and a search term/sensitive-record ownership check were
    // active at once.
    if (filter.$or) {
      const searchClause = { $or: filter.$or };
      delete filter.$or;
      filter.$and = filter.$and ? [...filter.$and, searchClause, accessClause] : [searchClause, accessClause];
    } else if (filter.$and) {
      filter.$and.push(accessClause);
    } else {
      Object.assign(filter, accessClause);
    }
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MedicalReport.find(filter)
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(limit),
    MedicalReport.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

// ---------------------------------------------------------------
// Extraction retry / manual entry
// ---------------------------------------------------------------
export const retryExtraction = async (id, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'OCR_INITIATED', requestMeta });

  if (report.status !== 'EXTRACTION_FAILED') {
    throw new AppError('Only a report with a failed extraction can be retried.', 409, {
      code: 'INVALID_STATUS_TRANSITION',
    });
  }
  if (report.extraction.attempts >= 5) {
    throw new AppError('Maximum extraction retry attempts reached; use manual entry instead.', 409, {
      code: 'MAX_RETRIES_REACHED',
    });
  }

  runExtractionPipeline(report._id, { language: report.extraction.language || undefined }).catch((error) => {
    logger.error({ err: error, reportId: report._id }, 'Extraction retry failed unexpectedly.');
  });

  return findReportOrThrow(id);
};

export const manualEntry = async (id, { parameters = [], structuredSections, interpretation, reportDate }, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'MANUAL_ENTRY', requestMeta });

  if (!['EXTRACTION_FAILED', 'NEEDS_REVIEW', 'EXTRACTED', 'UPLOADED'].includes(report.status)) {
    throw new AppError('Manual entry is not allowed once a report has been verified or finalized.', 409, {
      code: 'INVALID_STATUS_FOR_MANUAL_ENTRY',
    });
  }

  const manualParameters = parameters.map((p) => {
    validateParameterInput(p);
    return {
      name: stripMarkup(p.name),
      value: stripMarkup(String(p.value)),
      numericValue: p.numericValue ?? null,
      unit: stripMarkup(p.unit ?? ''),
      referenceRange: stripMarkup(p.referenceRange ?? ''),
      abnormalFlag: p.abnormalFlag ?? 'UNKNOWN',
      specimenType: stripMarkup(p.specimenType ?? ''),
      source: 'MANUAL',
      confidence: 'HIGH',
      extraction: { rawValue: null, rawUnit: null, rawReferenceRange: null, confidence: null, sourceLine: null },
      verification: { status: 'PENDING', verifiedBy: null, verifiedAt: null, correctionReason: '' },
    };
  });

  if (report.status === 'EXTRACTION_FAILED' || report.status === 'UPLOADED') {
    report.parameters = manualParameters;
  } else {
    report.parameters.push(...manualParameters);
  }

  if (structuredSections && typeof structuredSections === 'object') {
    report.structuredSections = { ...report.structuredSections, ...sanitizeStructuredValue(structuredSections) };
  }
  if (typeof interpretation === 'string') {
    report.interpretation = stripMarkup(interpretation);
  }
  if (reportDate) {
    report.reportDate = new Date(reportDate);
  }

  if (['UPLOADED', 'EXTRACTED', 'EXTRACTION_FAILED'].includes(report.status)) {
    transition(report, 'NEEDS_REVIEW', { action: 'MANUAL_ENTRY' }, actor);
  }

  report.updatedBy = actor._id;
  await report.save();
  return report;
};

// ---------------------------------------------------------------
// Doctor verification workflow (BET-12.14/12.15/12.16)
// ---------------------------------------------------------------
export const reviewParameter = async (
  id,
  parameterId,
  { action, correctedValue, unit, referenceRange, abnormalFlag, reason },
  actor,
  requestMeta = {},
) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'PARAMETER_REVIEWED', requestMeta });

  if (!['NEEDS_REVIEW', 'EXTRACTED', 'EXTRACTION_FAILED'].includes(report.status)) {
    throw new AppError('Parameters can only be reviewed before a report is verified.', 409, {
      code: 'INVALID_STATUS_FOR_REVIEW',
    });
  }

  const parameter = report.parameters.id(parameterId);
  if (!parameter) {
    throw new AppError('Parameter not found on this report.', 404, { code: 'PARAMETER_NOT_FOUND' });
  }

  if (action === 'CONFIRM') {
    validateParameterInput(parameter, { allowMissingValue: true });
    parameter.verification = {
      status: 'CONFIRMED',
      verifiedBy: actor._id,
      verifiedAt: new Date(),
      correctionReason: '',
    };
  } else if (action === 'CORRECT') {
    if (correctedValue === undefined || correctedValue === null || correctedValue === '') {
      throw new AppError('A corrected value is required.', 400, { code: 'VALIDATION_ERROR' });
    }
    const candidate = {
      name: parameter.name,
      value: correctedValue,
      numericValue: Number.isFinite(Number(correctedValue)) ? Number(correctedValue) : null,
      referenceRange: referenceRange ?? parameter.referenceRange,
    };
    validateParameterInput(candidate);
    // The original OCR value is never touched — only `extraction`
    // (immutable) already holds it (master prompt §BET-12.15).
    parameter.value = stripMarkup(String(correctedValue));
    parameter.numericValue = Number.isFinite(Number(correctedValue)) ? Number(correctedValue) : null;
    if (unit !== undefined) parameter.unit = stripMarkup(unit);
    if (referenceRange !== undefined) parameter.referenceRange = stripMarkup(referenceRange);
    parameter.abnormalFlag = abnormalFlag ?? parameter.abnormalFlag;
    parameter.source = parameter.source === 'MANUAL' ? 'MANUAL' : 'OCR'; // unchanged — still traces back to how it originated
    parameter.confidence = 'HIGH'; // doctor-confirmed value
    parameter.verification = {
      status: 'CORRECTED',
      verifiedBy: actor._id,
      verifiedAt: new Date(),
      correctionReason: stripMarkup(reason || ''),
    };
  } else if (action === 'REJECT') {
    parameter.verification = {
      status: 'REJECTED',
      verifiedBy: actor._id,
      verifiedAt: new Date(),
      correctionReason: stripMarkup(reason || ''),
    };
  } else {
    throw new AppError('Unknown review action.', 400, { code: 'VALIDATION_ERROR' });
  }

  report.updatedBy = actor._id;
  await report.save();
  return report;
};

export const setInterpretation = async (id, interpretation, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'MANUAL_ENTRY', requestMeta });

  if (!['UPLOADED', 'EXTRACTED', 'NEEDS_REVIEW'].includes(report.status)) {
    throw new AppError('Interpretation can only be changed before verification/finalization; use amendment for a finalized report.', 409, {
      code: 'INVALID_STATUS',
    });
  }

  report.interpretation = stripMarkup(interpretation);
  report.updatedBy = actor._id;
  await report.save();
  return report;
};

export const verifyReport = async (id, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'RESULT_VERIFIED', requestMeta });

  if (!['NEEDS_REVIEW', 'EXTRACTED'].includes(report.status)) {
    throw new AppError(`Cannot verify a report in status ${report.status}.`, 409, {
      code: 'INVALID_STATUS_TRANSITION',
    });
  }

  const stillPending = report.parameters.some((p) => p.verification.status === 'PENDING');
  if (stillPending) {
    throw new AppError('Every extracted/manual parameter must be confirmed, corrected, or rejected first.', 409, {
      code: 'PARAMETERS_PENDING_REVIEW',
    });
  }

  transition(report, 'VERIFIED', { action: 'RESULT_VERIFIED' }, actor);
  report.verification = { status: 'VERIFIED', verifiedBy: actor._id, verifiedAt: new Date() };
  report.updatedBy = actor._id;
  await report.save();
  return report;
};

export const finalizeReport = async (id, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'RESULT_FINALIZED', requestMeta });

  await validateReportForFinalization(report);
  if (report.verification.status !== 'VERIFIED') {
    throw new AppError('Report must be clinically verified before finalization.', 409, {
      code: 'REPORT_NOT_VERIFIED',
    });
  }

  transition(report, 'FINALIZED', { action: 'RESULT_FINALIZED' }, actor);
  report.finalizedBy = actor._id;
  report.finalizedAt = new Date();
  report.updatedBy = actor._id;
  await report.save();

  if (report.investigation) {
    await markInvestigationCompletedFromReport(report.investigation, report, actor);
  }

  return report;
};

// ---------------------------------------------------------------
// BET-12.16 — Amendment of an already-finalized report. Never
// overwrites silently: snapshots the pre-change state first.
// ---------------------------------------------------------------
export const amendFinalizedReport = async (id, { parameters, interpretation, reason }, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'RESULT_AMENDED', requestMeta });

  if (report.status !== 'FINALIZED') {
    throw new AppError('Only a finalized report can be amended.', 409, { code: 'INVALID_STATUS_TRANSITION' });
  }
  if (!reason || !reason.trim()) {
    throw new AppError('An amendment reason is required.', 400, { code: 'VALIDATION_ERROR' });
  }

  report.amendments.push({
    amendedBy: actor._id,
    reason: stripMarkup(reason.trim()),
    previousParameters: JSON.parse(JSON.stringify(report.parameters)),
    previousInterpretation: report.interpretation,
  });

  if (Array.isArray(parameters)) {
    report.parameters = parameters.map((p) => ({
      ...p,
      source: p.source || 'MANUAL',
      confidence: 'HIGH',
      verification: { status: 'CONFIRMED', verifiedBy: actor._id, verifiedAt: new Date(), correctionReason: reason },
    }));
  }
  if (typeof interpretation === 'string') {
    report.interpretation = stripMarkup(interpretation);
  }

  transition(report, 'AMENDED', { action: 'RESULT_AMENDED', reason }, actor);
  report.updatedBy = actor._id;
  await report.save();
  return report;
};

export const cancelReport = async (id, { reason }, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'REPORT_CANCELLED', requestMeta });

  transition(report, 'CANCELLED', { action: 'CANCEL', reason }, actor);
  report.cancellationReason = reason || '';
  report.updatedBy = actor._id;
  await report.save();
  return report;
};

export const rejectReport = async (id, { reason }, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'REPORT_REJECTED', requestMeta });

  transition(report, 'REJECTED', { action: 'REJECT', reason }, actor);
  report.rejectionReason = reason || '';
  report.updatedBy = actor._id;
  await report.save();
  return report;
};

export const acknowledgeDuplicate = async (id, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: true, action: 'DUPLICATE_REVIEWED', requestMeta });

  report.duplicateReviewed = true;
  report.updatedBy = actor._id;
  await report.save();
  return report;
};

// ---------------------------------------------------------------
// BET-12.5/12.31 — Secure download. Streams bytes obtained via a
// freshly-minted, short-lived signed storage URL; the client never
// sees that URL, and every download re-runs full authorization.
// ---------------------------------------------------------------
export const downloadReport = async (id, actor, requestMeta = {}) => {
  const report = await findReportOrThrow(id);
  await enforceReportAccess({ actor, report, write: false, action: 'DOWNLOAD', requestMeta });

  if (actor.role === ROLES.PATIENT && !isVisibleToOwningPatient(report)) {
    throw new AppError('This medical report is not yet available for patient download.', 404, {
      code: 'REPORT_NOT_AVAILABLE',
    });
  }

  const buffer = await getReportFileBuffer({
    cloudinaryPublicId: report.originalDocument.cloudinaryPublicId,
    cloudinaryResourceType: report.originalDocument.cloudinaryResourceType,
  });

  return {
    buffer,
    filename: report.originalDocument.originalFilename,
    mimeType: report.originalDocument.mimeType,
  };
};

export { REPORT_STATUSES };

// Shared with the intake service so accept/reject use the same state
// machine and history trail as every other status change.
export { transition as transitionReport };
