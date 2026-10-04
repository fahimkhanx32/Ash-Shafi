/**
 * BET-19 — Dependency-free single-sheet XLSX writer.
 *
 * The read side of this already exists in this project
 * (`modules/reports/services/spreadsheet-extraction.service.js`'s
 * `extractXlsx`, built for BET-12.33) but there was no write side —
 * this is that counterpart, needed to produce a genuine `.xlsx` a
 * caller can open in Excel/Sheets, not a CSV wearing an `.xlsx`
 * extension. No `exceljs`/`xlsx`/`node-xlsx` dependency exists in
 * this project (see `package.json`) and this sandbox has no network
 * access to add one, so this reuses the same "hand-roll the OOXML
 * ZIP container" approach `zip-writer.util.js` (BET-18) already
 * established for backup archives, plus the ZIP archive it writes.
 *
 * Deliberately uses inline strings (`t="inlineStr"`) for every text
 * cell rather than a shared-strings table (`xl/sharedStrings.xml`).
 * A shared-strings table is an optimization for files with heavily
 * repeated string values; inline strings are simpler, fully valid
 * OOXML, and avoid a second file + index-matching logic for what is,
 * for this project's export sizes, no meaningful size difference.
 * `extractXlsx`'s reader already handles inline strings (its `t=""`
 * lookup checks `inline || raw`), so a file this writer produces is
 * round-trippable back through this project's own reader.
 */

import { createZipArchive } from '../../backups/utils/zip-writer.util.js';

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const columnLetter = (index) => {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

const cellXml = (rowIndex, colIndex, value) => {
  const ref = `${columnLetter(colIndex)}${rowIndex}`;

  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"/>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Stored as an ISO string rather than an Excel serial date —
    // avoids needing a numFmt/date-system entry in styles.xml for a
    // one-shot export, and is unambiguous across locales/timezones,
    // which a bare serial number is not.
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
      value.toISOString(),
    )}</t></is></c>`;
  }

  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
    value,
  )}</t></is></c>`;
};

const worksheetXml = (headers, rows) => {
  const allRows = [headers, ...rows];
  const rowsXml = allRows
    .map((row, rowIdx) => {
      const cells = row.map((value, colIdx) => cellXml(rowIdx + 1, colIdx, value)).join('');
      return `<row r="${rowIdx + 1}">${cells}</row>`;
    })
    .join('');

  const lastCol = columnLetter(Math.max(0, headers.length - 1));
  const dimension = `A1:${lastCol}${Math.max(1, allRows.length)}`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="${dimension}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<sheetData>${rowsXml}</sheetData>` +
    '</worksheet>'
  );
};

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '</Relationships>';

const workbookXml = (sheetName) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  `<sheets><sheet name="${xmlEscape(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>` +
  '</workbook>';

/**
 * @param {string[]} headers
 * @param {Array<Array<string|number|Date|null>>} rows
 * @param {string} [sheetName]
 * @returns {Buffer} a valid, minimal single-sheet `.xlsx` file
 */
export const rowsToXlsxBuffer = (headers, rows, sheetName = 'Sheet1') => {
  const entries = [
    { name: '[Content_Types].xml', buffer: Buffer.from(CONTENT_TYPES_XML, 'utf8') },
    { name: '_rels/.rels', buffer: Buffer.from(ROOT_RELS_XML, 'utf8') },
    { name: 'xl/workbook.xml', buffer: Buffer.from(workbookXml(sheetName), 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', buffer: Buffer.from(WORKBOOK_RELS_XML, 'utf8') },
    {
      name: 'xl/worksheets/sheet1.xml',
      buffer: Buffer.from(worksheetXml(headers, rows), 'utf8'),
    },
  ];

  return createZipArchive(entries);
};

/**
 * Convenience wrapper: array-of-objects → `.xlsx` Buffer, given an
 * ordered column list of `{ key, label, get? }` — same column shape
 * `objectsToCsvBuffer` (`csv.util.js`) accepts, so every export
 * service defines its columns once and feeds both writers.
 */
export const objectsToXlsxBuffer = (records, columns, sheetName) => {
  const headers = columns.map((column) => column.label);
  const rows = records.map((record) =>
    columns.map((column) => (column.get ? column.get(record) : record[column.key])),
  );
  return rowsToXlsxBuffer(headers, rows, sheetName);
};
