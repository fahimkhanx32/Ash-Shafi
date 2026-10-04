import multer from 'multer';

import env from '../../../config/env.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import {
  validateUploadedFile,
  sanitizeFilename,
  generateStorageFilename,
} from '../../../security/file-security.js';

/**
 * BET-13 — attachment/voice upload handling (master prompt §26/§29/
 * §31), mirroring `modules/reports/routes/report.routes.js`'s
 * `receiveReportFile` pattern: multer buffers to memory (never disk —
 * the file goes straight to Cloudinary), then
 * `security/file-security.js#validateUploadedFile` re-checks MIME/
 * extension/signature/size against the buffer's actual bytes, never
 * trusting the client-declared `mimetype` alone.
 *
 * Unlike report uploads (a single fixed allowed-type list), the
 * allowed MIME type here depends on the message's declared
 * `messageType` (IMAGE/DOCUMENT/VOICE), which arrives as a sibling
 * multipart text field. Multer only finishes populating `req.body`
 * once the *entire* multipart request has been parsed, so that
 * cross-check has to happen in this callback (after
 * `upload.single('file')` completes) rather than in `fileFilter`,
 * which fires mid-stream before the rest of the fields are
 * necessarily available.
 */

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const VOICE_MIME_TYPES = ['audio/mpeg', 'audio/wav'];

const ALL_ALLOWED_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
  ...VOICE_MIME_TYPES,
];

const maxAttachmentSizeBytes = Math.floor(
  (env.messaging.maxAttachmentSizeMb || 15) * 1024 * 1024,
);
const maxVoiceSizeBytes = Math.floor(
  (env.messaging.maxVoiceMessageSizeMb || 10) * 1024 * 1024,
);

// Multer's own hard ceiling has to be set before we know the
// message's type, so it uses whichever configured limit is larger;
// the type-specific (and usually stricter) limit is enforced again
// below, after `messageType` is known.
const multerHardCeilingBytes = Math.max(maxAttachmentSizeBytes, maxVoiceSizeBytes);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: multerHardCeilingBytes,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALL_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError('Unsupported message attachment file type.', 400, {
          code: 'UNSUPPORTED_FILE_TYPE',
        }),
      );
    }
    return cb(null, true);
  },
});

export const categoryFor = (mimeType) => {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return 'IMAGE';
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) return 'DOCUMENT';
  if (VOICE_MIME_TYPES.includes(mimeType)) return 'VOICE';
  return null;
};

export const receiveMessageAttachment = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError('Message attachment exceeds the configured size limit.', 413, {
            code: 'FILE_TOO_LARGE',
          }),
        );
      }
      if (error.name === 'MulterError') {
        return next(
          new AppError('Message attachment upload could not be processed.', 400, {
            code: 'UPLOAD_ERROR',
          }),
        );
      }
      return next(error);
    }

    // No file on this request is valid — a TEXT message has none.
    // `message.controller.js#assertContentMatchesType` (running
    // after this middleware) is what actually requires a file for
    // IMAGE/DOCUMENT/VOICE.
    if (!req.file) {
      return next();
    }

    try {
      const declaredType = req.body?.messageType;
      const actualCategory = categoryFor(req.file.mimetype);

      if (declaredType && actualCategory && declaredType !== actualCategory) {
        throw new Error(
          `The uploaded file's type does not match the declared messageType (${declaredType}).`,
        );
      }

      if (declaredType === 'TEXT') {
        throw new Error('A TEXT message cannot carry a file attachment.');
      }

      const maxSizeBytes =
        actualCategory === 'VOICE' ? maxVoiceSizeBytes : maxAttachmentSizeBytes;

      const storageFilename = generateStorageFilename(req.file.originalname);

      validateUploadedFile({
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        maxSizeBytes,
        buffer: req.file.buffer,
      });

      if (actualCategory === 'VOICE') {
        const durationSeconds = Number(req.body?.durationSeconds);
        const maxDuration = env.messaging.maxVoiceMessageDurationSeconds || 300;

        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          throw new Error('durationSeconds is required for a voice message.');
        }

        if (durationSeconds > maxDuration) {
          throw new Error('Voice message duration exceeds the configured limit.');
        }
      }

      req.file.storageFilename = storageFilename;
      req.file.sanitizedOriginalName = sanitizeFilename(req.file.originalname);

      return next();
    } catch (validationError) {
      return next(
        new AppError(validationError.message, 400, { code: 'INVALID_UPLOAD' }),
      );
    }
  });
};

export default receiveMessageAttachment;
