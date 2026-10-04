/**
 * BET-19 checkpoint 1 — PDF export: dependency-free tabular PDF
 * renderer.
 *
 * `pdfkit` is already a dependency of this project (used by
 * `modules/prescriptions/services/prescription-pdf.service.js` and
 * `modules/payments/services/receipt-pdf.service.js`), so this
 * reuses it rather than adding a new PDF-generation dependency —
 * same "no new dependency where an existing one already covers the
 * need" discipline `xlsx-writer.util.js` documents for the ZIP
 * container it reuses from `zip-writer.util.js`.
 *
 * Deliberately landscape A4: bulk entity exports (patients,
 * encounters, prescriptions, investigations) commonly have 7-11
 * columns — see `entity-export.service.js`'s `ENTITY_EXPORT_COLUMNS`
 * — which a portrait page cannot fit without unreadably small text.
 * Column widths are distributed evenly across the printable width;
 * a cell's text wraps and the row grows to fit its tallest cell
 * (`pdfkit`'s own `doc.heightOfString`), so no cell content is ever
 * silently truncated or cut off mid-word.
 */

import PDFDocument from 'pdfkit';

const PAGE_MARGIN = 36;
const HEADER_FONT_SIZE = 8;
const BODY_FONT_SIZE = 7.5;
const ROW_PADDING = 4;
const HEADER_FILL = '#f0f0f0';
const BORDER_COLOR = '#cccccc';

const formatCell = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

/**
 * Renders `title` + a table of `headers`/`rows` as a landscape A4
 * PDF and resolves with the resulting `Buffer`.
 *
 * Buffered (not streamed straight to `res`) deliberately, so this
 * fits the same `{ buffer, filename, mimeType, recordCount }`
 * contract `tabular-export.service.js` already uses for its
 * CSV/XLSX branches — one uniform return shape for every format,
 * rather than PDF alone needing a different controller code path.
 *
 * @param {{ title: string, subtitle?: string, headers: string[], rows: Array<Array<string|number|Date|null>> }} args
 * @returns {Promise<Buffer>}
 */
export const generateTablePdfBuffer = ({ title, subtitle, headers, rows }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PAGE_MARGIN });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const columnWidth = pageWidth / Math.max(1, headers.length);

    doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'left' });
    if (subtitle) {
      doc.fontSize(8).font('Helvetica').fillColor('#555555').text(subtitle);
      doc.fillColor('#000000');
    }
    doc.moveDown(0.5);

    const drawHeaderRow = () => {
      const y = doc.y;
      const rowHeight =
        Math.max(
          ...headers.map((h) => doc.heightOfString(h, { width: columnWidth - ROW_PADDING * 2 })),
        ) +
        ROW_PADDING * 2;

      doc.rect(PAGE_MARGIN, y, pageWidth, rowHeight).fill(HEADER_FILL);
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE);

      headers.forEach((header, index) => {
        doc.text(header, PAGE_MARGIN + index * columnWidth + ROW_PADDING, y + ROW_PADDING, {
          width: columnWidth - ROW_PADDING * 2,
        });
      });

      doc
        .moveTo(PAGE_MARGIN, y + rowHeight)
        .lineTo(PAGE_MARGIN + pageWidth, y + rowHeight)
        .strokeColor(BORDER_COLOR)
        .stroke();

      doc.y = y + rowHeight;
    };

    const bottomLimit = doc.page.height - PAGE_MARGIN;

    drawHeaderRow();

    doc.font('Helvetica').fontSize(BODY_FONT_SIZE);

    rows.forEach((row) => {
      const cells = row.map(formatCell);
      const rowHeight =
        Math.max(
          ...cells.map((cell) =>
            doc.heightOfString(cell || ' ', { width: columnWidth - ROW_PADDING * 2 }),
          ),
        ) +
        ROW_PADDING * 2;

      if (doc.y + rowHeight > bottomLimit) {
        doc.addPage();
        doc.y = PAGE_MARGIN;
        drawHeaderRow();
        doc.font('Helvetica').fontSize(BODY_FONT_SIZE);
      }

      const y = doc.y;
      cells.forEach((cell, index) => {
        doc.text(cell, PAGE_MARGIN + index * columnWidth + ROW_PADDING, y + ROW_PADDING, {
          width: columnWidth - ROW_PADDING * 2,
        });
      });

      doc.y = y + rowHeight;
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + pageWidth, doc.y)
        .strokeColor(BORDER_COLOR)
        .stroke();
    });

    if (rows.length === 0) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777777').text('No records found.');
      doc.fillColor('#000000');
    }

    doc.end();
  });
