/**
 * BET-12.32 — Document metadata extraction for Office Open XML uploads
 * (.docx / .xlsx).
 *
 * Closes a gap left after the initial BET-12 pass: PDF page count was
 * already captured (via `pdf-parse` in `report.service.js`), but .docx and
 * .xlsx uploads only ever got filename/type/size/upload-date (all supplied
 * by the upload itself, not read from the file). This reads the small set
 * of *safe*, standard OOXML metadata parts every Word/Excel file already
 * carries:
 *
 *   docProps/core.xml  -> dc:title           (both docx and xlsx)
 *   docProps/app.xml   -> Pages              (docx only — Word's own
 *                                              self-reported page count)
 *
 * Deliberately narrow, per master prompt §27/§BET-12.32:
 *   - Never trusted as clinically authoritative — it's descriptive
 *     document metadata (what the author typed as a title, what Word
 *     thinks its own page count is), not extracted clinical content.
 *   - Never blocks or fails the upload/extraction pipeline. Any parsing
 *     problem here yields `{ title: null, pageCount: null }`, exactly like
 *     "we don't know" rather than an invented value, and is caught by the
 *     caller.
 *   - No new dependency — reuses the same dependency-free ZIP-central-
 *     directory reader `spreadsheet-extraction.service.js` already uses,
 *     which only runs on buffers that have already passed
 *     `security/file-security.js`'s `hasSafeOfficeContainer` checks
 *     (path traversal / dangerous extensions / decompression-bomb ratio)
 *     at upload time.
 *   - `pageCount` is intentionally left `null` for .xlsx — a spreadsheet
 *     has no equivalent for the reference count`docProps/app.xml` reports
 *     for print-layout page count, and guessing one from sheet count
 *     would be exactly the kind of invented value BET-12.12 forbids.
 */

import { readZipEntries } from './spreadsheet-extraction.service.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const decodeXml = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const xmlText = (xml, tagPattern) => {
  const match = xml.match(tagPattern);
  if (!match) return '';
  return decodeXml(match[1].replace(/<[^>]+>/g, '')).trim();
};

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {{ title: string|null, pageCount: number|null }}
 */
export const extractOfficeMetadata = (buffer, mimeType) => {
  if (mimeType !== DOCX_MIME && mimeType !== XLSX_MIME) {
    return { title: null, pageCount: null };
  }

  try {
    const entries = readZipEntries(buffer);

    const coreXml = entries.get('docProps/core.xml')?.toString('utf8') || '';
    // `dc:title` is Dublin Core, always namespaced `dc:` in this part.
    const rawTitle = coreXml
      ? xmlText(coreXml, /<dc:title(?:\s[^>]*)?>([\s\S]*?)<\/dc:title>/i)
      : '';
    const title = rawTitle && rawTitle.length <= 300 ? rawTitle : null;

    let pageCount = null;
    if (mimeType === DOCX_MIME) {
      const appXml = entries.get('docProps/app.xml')?.toString('utf8') || '';
      const rawPages = appXml ? xmlText(appXml, /<Pages(?:\s[^>]*)?>([\s\S]*?)<\/Pages>/i) : '';
      const parsed = Number.parseInt(rawPages, 10);
      // Sanity bound — this is a self-reported value from the document
      // itself, not verified; reject anything that couldn't plausibly be
      // a real page count rather than trusting it blindly.
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100000) {
        pageCount = parsed;
      }
    }

    return { title, pageCount };
  } catch {
    // Malformed/unexpected ZIP structure — the file already passed
    // `hasSafeOfficeContainer` at upload time, so this is a metadata-read
    // failure, not a security concern. Fail soft: "unknown", never a
    // guessed value, and never propagated as an upload/extraction error.
    return { title: null, pageCount: null };
  }
};
