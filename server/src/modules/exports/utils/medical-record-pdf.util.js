/**
 * BET-19 checkpoint 2 — "Medical-record export" PDF rendering.
 *
 * Same `pdfkit` reuse discipline `pdf-table.util.js` documents.
 * Unlike that file (one flat table), this renders a multi-section
 * narrative document — patient demographics, medical history,
 * encounters, prescriptions, investigations, reports — the same
 * letterhead-plus-sections shape `prescription-pdf.service.js`
 * already established for a single-record clinical PDF, just with
 * several sections instead of one.
 */

import PDFDocument from 'pdfkit';

const MARGIN = 50;
const RULE_COLOR = '#cccccc';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const sectionTitle = (doc, text) => {
  if (doc.y > doc.page.height - MARGIN - 60) {
    doc.addPage();
  }
  doc.moveDown(0.75);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(text);
  doc.moveTo(MARGIN, doc.y + 2).lineTo(doc.page.width - MARGIN, doc.y + 2).strokeColor(RULE_COLOR).stroke();
  doc.moveDown(0.5);
};

const keyValueLine = (doc, label, value) => {
  doc.fontSize(9).font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(value || '—');
};

const emptyNote = (doc, text) => {
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#777777').text(text);
  doc.fillColor('#000000');
};

/**
 * @param {object} bundle - the shape `buildMedicalRecordBundle` returns
 * @returns {Promise<Buffer>}
 */
export const generateMedicalRecordPdfBuffer = (bundle) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Letterhead
    doc.fontSize(16).font('Helvetica-Bold').text('Ash-Shāfī', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Medical Record Package', { align: 'center' });
    doc
      .fontSize(8)
      .fillColor('#555555')
      .text(
        `Generated ${new Date(bundle.generatedAt).toLocaleString('en-GB')} — CONFIDENTIAL, patient clinical record`,
        { align: 'center' },
      );
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(RULE_COLOR).stroke();

    // Patient demographics
    sectionTitle(doc, 'Patient Information');
    const p = bundle.patient;
    keyValueLine(doc, 'Name', p.name);
    keyValueLine(doc, 'Patient ID', p.patientId);
    keyValueLine(doc, 'Gender / DOB', `${p.gender || '—'} / ${formatDate(p.dateOfBirth)}`);
    keyValueLine(doc, 'Blood Group', p.bloodGroup);
    keyValueLine(doc, 'Phone', p.phone);
    keyValueLine(doc, 'Email', p.email);
    keyValueLine(doc, 'Status', p.status);
    keyValueLine(doc, 'Registration Date', formatDate(p.registrationDate));
    keyValueLine(doc, 'Primary Care Provider', p.primaryCareProvider);

    // Medical history
    sectionTitle(doc, 'Medical History');
    if (bundle.medicalHistory.redacted) {
      emptyNote(doc, 'Not included — the requester does not hold medical-record read access.');
    } else {
      const mh = bundle.medicalHistory;

      doc.fontSize(9).font('Helvetica-Bold').text('Allergies');
      if (mh.allergies.length === 0) {
        emptyNote(doc, 'None recorded.');
      } else {
        mh.allergies.forEach((a) => {
          doc
            .font('Helvetica')
            .fontSize(9)
            .text(`• ${a.allergen} — ${a.severity}${a.reaction ? ` (${a.reaction})` : ''}${a.isActive ? '' : ' [inactive]'}`);
        });
      }

      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').text('Chronic Conditions');
      if (mh.chronicConditions.length === 0) {
        emptyNote(doc, 'None recorded.');
      } else {
        mh.chronicConditions.forEach((c) => {
          doc.font('Helvetica').fontSize(9).text(`• ${c.condition} — ${c.status} (diagnosed ${formatDate(c.diagnosedDate)})`);
        });
      }

      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').text('Medication History');
      if (mh.medicationHistory.length === 0) {
        emptyNote(doc, 'None recorded.');
      } else {
        mh.medicationHistory.forEach((m) => {
          doc.font('Helvetica').fontSize(9).text(`• ${m.medicationName} — ${m.status}`);
        });
      }

      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').text('Vaccination History');
      if (mh.vaccinationHistory.length === 0) {
        emptyNote(doc, 'None recorded.');
      } else {
        mh.vaccinationHistory.forEach((v) => {
          doc.font('Helvetica').fontSize(9).text(`• ${v.vaccineName} — ${formatDate(v.dateAdministered)}`);
        });
      }
    }

    // Encounters
    sectionTitle(doc, `Encounters (${bundle.encounters.length})`);
    if (bundle.encounters.length === 0) {
      emptyNote(doc, 'No encounters recorded.');
    } else {
      bundle.encounters.forEach((e) => {
        doc.fontSize(9).font('Helvetica-Bold').text(`${formatDate(e.date)} — ${e.status}${e.provider ? ` — Dr. ${e.provider}` : ''}`);
        if (e.chiefComplaint) doc.font('Helvetica').fontSize(8).text(`Chief complaint: ${e.chiefComplaint}`, { indent: 10 });
        if (e.assessment) doc.font('Helvetica').fontSize(8).text(`Assessment: ${e.assessment}`, { indent: 10 });
        if (e.treatmentPlan) doc.font('Helvetica').fontSize(8).text(`Plan: ${e.treatmentPlan}`, { indent: 10 });
        doc.moveDown(0.3);
      });
    }

    // Prescriptions
    sectionTitle(doc, `Prescriptions (${bundle.prescriptions.length})`);
    if (bundle.prescriptions.length === 0) {
      emptyNote(doc, 'No prescriptions recorded.');
    } else {
      bundle.prescriptions.forEach((rx) => {
        doc.fontSize(9).font('Helvetica-Bold').text(`${formatDate(rx.date)} — ${rx.status}${rx.provider ? ` — Dr. ${rx.provider}` : ''}`);
        if (rx.diagnosisSummary) doc.font('Helvetica').fontSize(8).text(`Diagnosis: ${rx.diagnosisSummary}`, { indent: 10 });
        if (rx.items.length > 0) doc.font('Helvetica').fontSize(8).text(`Items: ${rx.items.join('; ')}`, { indent: 10 });
        doc.moveDown(0.3);
      });
    }

    // Investigations
    sectionTitle(doc, `Investigations (${bundle.investigations.length})`);
    if (bundle.investigations.length === 0) {
      emptyNote(doc, 'No investigations recorded.');
    } else {
      bundle.investigations.forEach((inv) => {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`• ${inv.name} — ${inv.category} — ${inv.status} — ordered ${formatDate(inv.orderedDate)}${inv.orderedBy ? ` by Dr. ${inv.orderedBy}` : ''}`);
      });
    }

    // Reports
    sectionTitle(doc, `Reports (${bundle.reports.length})`);
    if (bundle.reports.length === 0) {
      emptyNote(doc, 'No reports recorded.');
    } else {
      bundle.reports.forEach((r) => {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`• ${r.title} — ${r.reportType} — ${r.status} — ${formatDate(r.reportDate)}${r.isSensitive ? ' [sensitive]' : ''}`);
      });
    }

    doc
      .fontSize(7)
      .fillColor('#888888')
      .text(
        `Patient ID: ${bundle.patient.patientId} — This is a system-generated medical record package.`,
        MARGIN,
        doc.page.height - 30,
        { width: doc.page.width - MARGIN * 2, align: 'center' },
      );

    doc.end();
  });
