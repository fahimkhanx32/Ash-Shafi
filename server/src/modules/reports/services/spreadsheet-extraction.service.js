import { inflateRawSync } from 'node:zlib';

/**
 * BET-12.33 — Minimal dependency-free XLSX extraction.
 *
 * XLSX is a ZIP container of XML parts. This reader intentionally handles
 * the common structured-laboratory case (shared strings + first worksheet)
 * without adding a large spreadsheet dependency to the medical backend.
 * The original spreadsheet is never modified. Unsupported legacy XLS files
 * remain available for manual entry rather than being guessed.
 */

// Exported (BET-12.32) so `office-metadata.service.js` can reuse the same
// dependency-free ZIP-central-directory reader for `docProps/core.xml` /
// `docProps/app.xml` instead of duplicating this parsing logic. The
// uploaded buffer has already passed `hasSafeOfficeContainer` (path
// traversal / dangerous-extension / decompression-bomb checks) by the time
// either caller sees it — this function does no safety filtering itself.
export const readZipEntries = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new Error('Invalid XLSX buffer.');
  }

  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('XLSX ZIP directory not found.');

  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const end = centralOffset + centralSize;
  const entries = new Map();

  let offset = centralOffset;
  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid XLSX central directory entry.');
    }

    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const filename = buffer
      .subarray(offset + 46, offset + 46 + filenameLength)
      .toString('utf8');

    if (compression !== 0 && compression !== 8) {
      offset += 46 + filenameLength + extraLength + commentLength;
      continue;
    }

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error('Invalid XLSX local file header.');
    }

    const localFilenameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localFilenameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = compression === 8 ? inflateRawSync(compressed) : compressed;

    entries.set(filename, data);
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return entries;
};

const xmlText = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].replace(/<[^>]+>/g, '') : '';
};

const decodeXml = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const columnNumber = (reference) => {
  const letters = String(reference).match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  let number = 0;
  for (const letter of letters) number = number * 26 + (letter.charCodeAt(0) - 64);
  return number - 1;
};

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)]
      .map((part) => decodeXml(part[1]))
      .join(''),
  );
};

const parseWorksheet = (xml, sharedStrings) => {
  const rows = [];

  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attributes = cellMatch[1];
      const cellXml = cellMatch[2];
      const ref = attributes.match(/r="([^"]+)"/i)?.[1] || '';
      const type = attributes.match(/t="([^"]+)"/i)?.[1] || '';
      const raw = xmlText(cellXml, 'v');
      const inline = xmlText(cellXml, 't');
      let value = inline || raw || '';

      if (type === 's' && raw !== '') {
        value = sharedStrings[Number(raw)] ?? raw;
      } else if (type === 'b') {
        value = raw === '1' ? 'TRUE' : 'FALSE';
      }

      cells[columnNumber(ref)] = decodeXml(String(value));
    }
    rows.push(cells.map((cell) => (cell ?? '').trim()));
  }

  return rows;
};

export const extractXlsx = (buffer) => {
  const entries = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml')?.toString('utf8') || '');

  const worksheetName =
    [...entries.keys()].find((name) => /^xl\/worksheets\/sheet1\.xml$/i.test(name)) ||
    [...entries.keys()].find((name) => /^xl\/worksheets\/[^/]+\.xml$/i.test(name));

  if (!worksheetName) {
    throw new Error('XLSX worksheet not found.');
  }

  const rows = parseWorksheet(entries.get(worksheetName).toString('utf8'), sharedStrings);

  const nonEmptyRows = rows.filter((row) => row.some((cell) => cell));
  const headers = nonEmptyRows[0] || [];

  return {
    source: 'SPREADSHEET',
    format: 'XLSX',
    rows: nonEmptyRows.slice(1),
    headers,
    rowCount: Math.max(0, nonEmptyRows.length - 1),
  };
};

export const extractSpreadsheet = ({ buffer, mimeType }) => {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return extractXlsx(buffer);
  }

  if (mimeType === 'application/vnd.ms-excel') {
    return {
      source: 'SPREADSHEET',
      format: 'XLS',
      supported: false,
      requiresManualReview: true,
      reason: 'Legacy XLS extraction is not available in the dependency-free backend; preserve the original and use manual entry.',
    };
  }

  return {
    source: 'SPREADSHEET',
    supported: false,
    requiresManualReview: true,
    reason: 'Unsupported spreadsheet type.',
  };
};

export const spreadsheetRowsToText = ({ headers = [], rows = [] }) => {
  const lines = [];
  if (headers.length) lines.push(headers.join(' | '));
  for (const row of rows) {
    lines.push(row.join(' '));
  }
  return lines.filter(Boolean).join('\n');
};
