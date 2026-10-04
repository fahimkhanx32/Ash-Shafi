/**
 * BET-19 — Dependency-free RFC 4180 CSV reader/writer.
 *
 * Mirrors the dependency-free-binary/text-format convention this
 * project already established (`modules/backups/utils/zip-writer.util.js`
 * for ZIP, `modules/reports/services/spreadsheet-extraction.service.js`
 * for XLSX reading) — no `csv-parse`/`csv-stringify`/`papaparse`
 * dependency exists in this project, and CSV is simple enough that
 * hand-rolling a correct, quote-aware reader/writer is the same
 * "safety and simplicity over an extra dependency" trade-off already
 * made elsewhere.
 *
 * Writer always quotes a field that contains a comma, double-quote,
 * or newline, doubling any embedded double-quote — the standard
 * RFC 4180 escaping rule. Reader is quote-aware (handles embedded
 * commas/newlines inside quoted fields and doubled-quote escaping)
 * rather than a naive `split(',')`, which would silently corrupt
 * any patient address/notes field containing a comma.
 */

const needsQuoting = (value) => /[",\n\r]/.test(value);

const csvEscape = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  if (!needsQuoting(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * @param {string[]} headers
 * @param {Array<Array<string|number|null>>} rows - row values, same
 *   order as `headers`
 * @returns {Buffer} UTF-8 CSV, CRLF line endings (widest-compatible
 *   with Excel/Google Sheets), with a leading UTF-8 BOM so Excel
 *   reliably detects UTF-8 rather than guessing a legacy code page
 *   for non-ASCII patient names.
 */
export const rowsToCsvBuffer = (headers, rows) => {
  const lines = [headers.map(csvEscape).join(',')];

  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }

  const csv = lines.join('\r\n') + '\r\n';
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf8')]);
};

/**
 * Convenience wrapper: array-of-objects → CSV, given an ordered
 * column list of `{ key, label }`.
 */
export const objectsToCsvBuffer = (records, columns) => {
  const headers = columns.map((column) => column.label);
  const rows = records.map((record) =>
    columns.map((column) => {
      const value = column.get ? column.get(record) : record[column.key];
      return value === null || value === undefined ? '' : value;
    }),
  );
  return rowsToCsvBuffer(headers, rows);
};

/**
 * Parses a CSV buffer into `{ headers, rows }` — `rows` is an array
 * of string arrays, same shape `extractXlsx` already returns for
 * spreadsheets, so callers (`csv-import.service.js`,
 * `excel-import.service.js`) can share one row-mapping code path
 * regardless of which format the file arrived in.
 *
 * Strips a leading UTF-8 BOM if present (Excel always writes one;
 * this reader must accept files it also produced).
 */
export const csvBufferToRows = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('CSV input must be a Buffer.');
  }

  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\r') {
      // Swallow bare CR; the paired LF (if any) drives the row break.
    } else if (char === '\n') {
      pushRow();
    } else {
      field += char;
    }
  }

  // Trailing field/row without a final newline.
  if (field !== '' || row.length > 0) {
    pushRow();
  }

  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell !== ''));
  const headers = (nonEmptyRows[0] || []).map((h) => h.trim());

  return {
    headers,
    rows: nonEmptyRows.slice(1),
    rowCount: Math.max(0, nonEmptyRows.length - 1),
  };
};
