import crypto from 'node:crypto';
import path from 'node:path';

const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'video/mp4': ['.mp4'],

  // BET-12.4 — investigation/medical-report uploads additionally
  // accept legacy Office (OLE compound file) and Office Open XML
  // (zip-based) document/spreadsheet formats. Deliberately not added
  // to the general-purpose upload pipeline's original four categories
  // above (profile images / PDFs / voice / video) — only the reports
  // module opts into these via its own upload configuration.
  'application/msword': ['.doc'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],

  // BET-19 — CSV import (Data Interoperability). Plain text has no
  // fixed magic-byte signature the way every other type here does,
  // so `hasValidFileSignature` below special-cases this MIME type
  // with a content heuristic (`isLikelyTextCsv`) instead of a byte
  // match.
  'text/csv': ['.csv'],
});

const FILE_SIGNATURES = Object.freeze({
  'image/jpeg': [
    {
      offset: 0,
      bytes: [0xff, 0xd8, 0xff],
    },
  ],

  'image/png': [
    {
      offset: 0,
      bytes: [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ],
    },
  ],

  'image/webp': [
    {
      offset: 0,
      bytes: [0x52, 0x49, 0x46, 0x46],
    },
    {
      offset: 8,
      bytes: [0x57, 0x45, 0x42, 0x50],
    },
  ],

  'application/pdf': [
    {
      offset: 0,
      bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
    },
  ],

  'audio/mpeg': [
    {
      offset: 0,
      bytes: [0x49, 0x44, 0x33],
    },
    {
      offset: 0,
      bytes: [0xff, 0xfb],
    },
    {
      offset: 0,
      bytes: [0xff, 0xf3],
    },
    {
      offset: 0,
      bytes: [0xff, 0xf2],
    },
  ],

  'audio/wav': [
    {
      offset: 0,
      bytes: [0x52, 0x49, 0x46, 0x46],
    },
    {
      offset: 8,
      bytes: [0x57, 0x41, 0x56, 0x45],
    },
  ],

  'video/mp4': [
    {
      offset: 4,
      bytes: [0x66, 0x74, 0x79, 0x70],
    },
  ],

  // Legacy Office binary format (.doc / .xls) — both use the same OLE
  // Compound File Binary container signature. This confirms the file
  // is a genuine OLE container, not specifically a Word vs. Excel
  // document (the container doesn't distinguish that at the signature
  // level) — matched against whichever of the two MIME types multer
  // reported, same as every other entry here.
  'application/msword': [
    {
      offset: 0,
      bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    },
  ],
  'application/vnd.ms-excel': [
    {
      offset: 0,
      bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    },
  ],

  // Office Open XML (.docx / .xlsx) are both zip archives (PK local-
  // file-header signature). Like the OLE pair above, this confirms
  // "genuine zip container" rather than distinguishing Word vs. Excel
  // specifically — a real spoofed-extension attack (e.g. a renamed
  // arbitrary zip) is still caught, which is this check's purpose.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    {
      offset: 0,
      bytes: [0x50, 0x4b, 0x03, 0x04],
    },
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    {
      offset: 0,
      bytes: [0x50, 0x4b, 0x03, 0x04],
    },
  ],
});

/**
 * BET-19 — CSV has no magic-byte signature to check the way every
 * binary type above does, so a genuine-vs-spoofed CSV is judged by
 * content shape instead: no NUL bytes anywhere in the sample (the
 * single most reliable "this is not actually binary" signal — real
 * delimited text never contains one), and the buffer must decode as
 * valid UTF-8. Only the first 64 KB is sampled — enough to catch a
 * renamed binary (image, zip, executable) without reading an entire
 * multi-megabyte import file into memory twice.
 */
const isLikelyTextCsv = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;

  const sample = buffer.subarray(0, 64 * 1024);

  if (sample.includes(0x00)) return false;

  try {
    // `fatal: true` rejects any byte sequence that isn't valid UTF-8
    // (rather than TextDecoder's default of silently substituting
    // U+FFFD), so a spoofed binary file is still caught even if it
    // happens to contain no NUL bytes in the sampled window.
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
  } catch {
    return false;
  }

  return true;
};

export const isAllowedMimeType = (mimeType) => {
  return Object.hasOwn(MIME_EXTENSIONS, mimeType);
};

export const isAllowedExtension = (
  filename,
  mimeType,
) => {
  if (
    typeof filename !== 'string' ||
    typeof mimeType !== 'string'
  ) {
    return false;
  }

  const extension = path
    .extname(filename)
    .toLowerCase();

  const allowedExtensions =
    MIME_EXTENSIONS[mimeType];

  return (
    Array.isArray(allowedExtensions) &&
    allowedExtensions.includes(extension)
  );
};

const matchesSignature = (
  buffer,
  signature,
) => {
  if (!Buffer.isBuffer(buffer)) {
    return false;
  }

  const { offset, bytes } = signature;

  if (
    buffer.length <
    offset + bytes.length
  ) {
    return false;
  }

  return bytes.every(
    (byte, index) =>
      buffer[offset + index] === byte,
  );
};

export const hasValidFileSignature = (
  buffer,
  mimeType,
) => {
  if (
    !Buffer.isBuffer(buffer) ||
    typeof mimeType !== 'string'
  ) {
    return false;
  }

  if (mimeType === 'text/csv') {
    return isLikelyTextCsv(buffer);
  }

  const signatures =
    FILE_SIGNATURES[mimeType];

  if (!Array.isArray(signatures)) {
    return false;
  }

  /*
   * For formats such as JPEG, PNG, PDF, MP3,
   * and MP4, one signature is sufficient.
   *
   * WebP and WAV require multiple markers:
   * RIFF at offset 0 and the format identifier
   * at offset 8.
   */
  if (
    mimeType === 'image/webp' ||
    mimeType === 'audio/wav'
  ) {
    return signatures.every(
      (signature) =>
        matchesSignature(buffer, signature),
    );
  }

  return signatures.some((signature) =>
    matchesSignature(buffer, signature),
  );
};


const validateOfficeZipContainer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) return false;

  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return false;

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  if (centralOffset + centralSize > buffer.length) return false;

  const dangerous = /\.(?:exe|dll|com|bat|cmd|scr|ps1|vbs|js|jar|msi|sh)$/i;
  const maxUncompressed = 100 * 1024 * 1024;
  let offset = centralOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return false;

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const filename = buffer
      .subarray(offset + 46, offset + 46 + filenameLength)
      .toString('utf8');

    if (
      filename.includes('..') ||
      filename.includes('\\') ||
      filename.startsWith('/') ||
      dangerous.test(filename) ||
      /(?:^|\/)vbaProject\.bin$/i.test(filename)
    ) {
      return false;
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxUncompressed) return false;

    // Guard against extreme ZIP compression ratios that can become a
    // decompression bomb even when the uploaded compressed file is small.
    if (compressedSize === 0 && uncompressedSize > 0) return false;
    if (compressedSize > 0 && uncompressedSize / compressedSize > 200) return false;

    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return true;
};

export const hasSafeOfficeContainer = (buffer, mimeType) => {
  if (
    mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return true;
  }
  return validateOfficeZipContainer(buffer);
};

// Best-effort screen for active content in PDFs: embedded JavaScript,
// launch actions and embedded files have no place in a patient's lab report.
// (Content hidden inside compressed object streams is not visible to this
// scan; it is a screen, not a malware scanner.)
const PDF_ACTIVE_CONTENT = /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/;

export const hasSafePdfContent = (buffer, mimeType) => {
  if (mimeType !== 'application/pdf') return true;
  return !PDF_ACTIVE_CONTENT.test(buffer.toString('latin1'));
};

export const validateUploadedFile = ({
  filename,
  mimeType,
  size,
  maxSizeBytes,
  buffer,
}) => {
  if (!isAllowedMimeType(mimeType)) {
    throw new Error('Unsupported file type.');
  }

  if (!isAllowedExtension(filename, mimeType)) {
    throw new Error(
      'File extension does not match its MIME type.',
    );
  }

  if (
    !Number.isFinite(size) ||
    size <= 0
  ) {
    throw new Error('Invalid file size.');
  }

  if (
    Number.isFinite(maxSizeBytes) &&
    size > maxSizeBytes
  ) {
    throw new Error(
      'File exceeds the allowed size.',
    );
  }

  if (
    !hasValidFileSignature(
      buffer,
      mimeType,
    )
  ) {
    throw new Error(
      'File content does not match its MIME type.',
    );
  }

  if (!hasSafeOfficeContainer(buffer, mimeType)) {
    throw new Error('Office document container failed security validation.');
  }

  if (!hasSafePdfContent(buffer, mimeType)) {
    throw new Error('PDF contains active content and was rejected.');
  }

  return true;
};

export const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') {
    throw new TypeError(
      'Filename must be a string.',
    );
  }

  const basename = path.basename(filename);

  const sanitized = basename
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255);

  return sanitized || 'uploaded-file';
};

export const generateStorageFilename = (
  filename,
) => {
  if (typeof filename !== 'string') {
    throw new TypeError(
      'Filename must be a string.',
    );
  }

  const sanitizedFilename =
    sanitizeFilename(filename);

  const extension = path
    .extname(sanitizedFilename)
    .toLowerCase();

  return `${crypto.randomUUID()}${extension}`;
};
