import PDFDocument from 'pdfkit';

import env from '../../../config/env.js';

/**
 * BET-15.2 — Payment receipt PDF (master prompt §35 "receipt").
 *
 * Deliberately a pure rendering function, matching the exact shape
 * `modules/prescriptions/services/prescription-pdf.service.js`
 * established for BET-11: it takes an already-authorized, already
 * populated `Payment` document (plus its populated `invoice`) and
 * streams a PDF — it never queries the database, never checks
 * permissions, and never decides who is allowed to see the result.
 * `payment.controller.js`'s `getPaymentReceiptController` is the only
 * caller, and it runs the exact same
 * `paymentService.getPaymentById(id, actor)` ownership/permission
 * check used for the JSON detail endpoint before calling this — the
 * receipt route is not a second, weaker way to reach the same data
 * (master prompt §31/§52).
 *
 * A receipt is only ever generated for a `SUCCEEDED` (or
 * `PARTIALLY_REFUNDED`/`REFUNDED` — the receipt is a record of what
 * was actually paid, refunds are noted on it, not a reason to hide
 * it) payment; the controller rejects `PENDING`/`FAILED`/`CANCELLED`
 * payments before this is ever called, since there is nothing to
 * receipt yet.
 *
 * Clinic identity is the same fixed constant `prescription-pdf.service.js`
 * uses — see that file's docstring for why (no clinic-profile
 * settings record exists yet to read instead).
 */

const CLINIC = {
  name: env.app?.name || 'Ash-Shāfī',
  tagline: 'Gynecology & Obstetric Care',
};

const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPatientName = (profile) =>
  [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—';

const formatMoney = (amount, currency) => `${currency || 'BDT'} ${Number(amount ?? 0).toFixed(2)}`;

const METHOD_LABELS = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_FINANCIAL_SERVICE: 'Mobile Financial Service',
  BANK_TRANSFER: 'Bank Transfer',
  ONLINE_GATEWAY: 'Online Payment',
};

/**
 * Renders `payment` (a populated Payment document — `invoice` and
 * `patientProfile` populated, see caller) as an A4 receipt PDF and
 * pipes it directly to `res`. Caller is responsible for setting
 * response headers before invoking this.
 */
export const generateReceiptPdf = (payment, res) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.on('error', reject);
    doc.pipe(res);
    res.on('finish', resolve);

    const invoice = payment.invoice || {};
    const profile = payment.patientProfile || {};

    // Letterhead
    doc.fontSize(18).font('Helvetica-Bold').text(CLINIC.name, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(CLINIC.tagline, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1);

    // Receipt / patient metadata
    const infoTop = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').text('Receipt No.:', 50, infoTop);
    doc.font('Helvetica').text(payment.paymentReference || '—', 150, infoTop);

    doc.font('Helvetica-Bold').text('Date:', 320, infoTop);
    doc.font('Helvetica').text(formatDateTime(payment.verifiedAt || payment.createdAt), 400, infoTop);

    const row2 = infoTop + 18;
    doc.font('Helvetica-Bold').text('Patient:', 50, row2);
    doc.font('Helvetica').text(formatPatientName(profile), 150, row2);

    doc.font('Helvetica-Bold').text('Patient ID:', 320, row2);
    doc.font('Helvetica').text(profile.patientId || '—', 400, row2);

    const row3 = row2 + 18;
    doc.font('Helvetica-Bold').text('Invoice No.:', 50, row3);
    doc.font('Helvetica').text(invoice.invoiceNumber || '—', 150, row3);

    doc.font('Helvetica-Bold').text('Method:', 320, row3);
    doc.font('Helvetica').text(METHOD_LABELS[payment.method] || payment.method, 400, row3);

    doc.y = row3 + 30;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1);

    // Amount block
    doc.fontSize(11).font('Helvetica-Bold').text('Amount Paid', 50);
    doc.fontSize(20).font('Helvetica-Bold').text(formatMoney(payment.amount, payment.currency), 50, doc.y + 4);
    doc.moveDown(1.5);

    if (invoice.grandTotal !== undefined) {
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
      doc.text(`Invoice total: ${formatMoney(invoice.grandTotal, payment.currency)}`);
      if (invoice.balanceDue !== undefined) {
        doc.text(`Remaining balance: ${formatMoney(invoice.balanceDue, payment.currency)}`);
      }
      doc.fillColor('#000000');
      doc.moveDown(1);
    }

    if (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') {
      doc
        .fontSize(10)
        .font('Helvetica-BoldOblique')
        .fillColor('#8a1f1f')
        .text(
          payment.status === 'REFUNDED'
            ? 'This payment has since been fully refunded.'
            : 'This payment has since been partially refunded.',
        );
      doc.fillColor('#000000');
      doc.moveDown(1);
    }

    if (payment.providerTransactionId) {
      doc
        .fontSize(8)
        .fillColor('#555555')
        .text(`Provider reference: ${payment.providerTransactionId}`);
      doc.fillColor('#000000');
    }

    doc
      .fontSize(7)
      .fillColor('#888888')
      .text(
        `Payment ID: ${payment._id}  •  Generated: ${new Date().toLocaleString('en-GB')}`,
        50,
        800,
        { width: 495, align: 'center' },
      );

    doc.end();
  });
