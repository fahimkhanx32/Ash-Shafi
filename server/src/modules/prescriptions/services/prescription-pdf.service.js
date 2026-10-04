import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontRegularPath = path.resolve(__dirname, '../../../assets/fonts/NotoSansBengali-Regular.ttf');
const fontBoldPath = path.resolve(__dirname, '../../../assets/fonts/NotoSansBengali-Bold.ttf');

/**
 * Generates a Legal-sized (8.5 × 14 inches) PDF matching the PDF source of truth.
 *
 * Page Specification:
 * - Width: 8.5 inches (612 pt)
 * - Height: 14 inches (1008 pt)
 * - Paper: LEGAL
 * - Margins: 0.5 inches (36 pt) Top, Bottom, Left, Right
 */

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${days[d.getDay()]}`;
};

export const generatePrescriptionPdf = (prescription, res) =>
  new Promise((resolve, reject) => {
    // Legal page: [612, 1008] points, 36 pt margin (0.5 in) with 15pt bottom margin to fit footer on page 1
    const doc = new PDFDocument({
      size: [612, 1008],
      margins: { top: 36, bottom: 15, left: 36, right: 36 },
      autoFirstPage: true,
      bufferPages: true,
    });

    let regFont = 'Helvetica';
    let boldFont = 'Helvetica-Bold';

    if (fs.existsSync(fontRegularPath)) {
      try {
        doc.registerFont('NotoBengali', fontRegularPath);
        regFont = 'NotoBengali';
      } catch {
        // fallback
      }
    }
    if (fs.existsSync(fontBoldPath)) {
      try {
        doc.registerFont('NotoBengali-Bold', fontBoldPath);
        boldFont = 'NotoBengali-Bold';
      } catch {
        // fallback
      }
    }

    doc.on('error', reject);
    doc.pipe(res);
    res.on('finish', resolve);

    const docSnapshot = prescription.doctorSnapshot || {};
    const patSnapshot = prescription.patientSnapshot || {};
    const profile = prescription.patientProfile || {};
    const provider = prescription.provider || {};

    const leftMargin = 36;
    const rightMargin = 576; // 612 - 36
    const pageWidth = 540;

    // --- 1. HEADER (Bilingual Doctor Information) ---
    const headerTop = 36;

    // Left Header (Doctor in Bengali / Primary title)
    doc.fontSize(11).font(boldFont).fillColor('#000000');
    doc.text(docSnapshot.nameBangla || docSnapshot.name || 'প্রফেসর ডা. রেজওয়ানুর রহমান', leftMargin, headerTop, { width: 260 });
    doc.fontSize(8.5).font(regFont);
    doc.text(docSnapshot.degreesBangla || docSnapshot.degreesEnglish || 'এমবিবিএস, এমডি (নেফ্রোলজি), এফআরসিপি (এডিন)', leftMargin, doc.y + 1, { width: 260 });
    doc.text(docSnapshot.designationBangla || docSnapshot.designationEnglish || 'অধ্যাপক ও বিভাগীয় প্রধান', leftMargin, doc.y + 1, { width: 260 });
    doc.text(docSnapshot.departmentBangla || docSnapshot.departmentEnglish || 'কিডনী রোগ ও ডায়ালাইসিস বিভাগ', leftMargin, doc.y + 1, { width: 260 });
    doc.text(docSnapshot.hospitalBangla || docSnapshot.hospitalEnglish || 'বাংলাদেশ মেডিকেল কলেজ হাসপাতাল, ঢাকা', leftMargin, doc.y + 1, { width: 260 });
    doc.text(docSnapshot.specialtyBangla || docSnapshot.specialtyEnglish || 'কিডনী রোগ ও কিডনি প্রতিস্থাপন বিশেষজ্ঞ', leftMargin, doc.y + 1, { width: 260 });

    // Right Header (Doctor in English)
    doc.fontSize(11).font(boldFont).fillColor('#000000');
    doc.text(docSnapshot.name || 'Prof. Dr. Rezwanur Rahman', 315, headerTop, { width: 260, align: 'right' });
    doc.fontSize(8.5).font(regFont);
    doc.text(docSnapshot.degreesEnglish || 'MBBS, MD (Nephrology), FRCP (Edin)', 315, headerTop + 14, { width: 260, align: 'right' });
    doc.text(docSnapshot.designationEnglish || 'Professor & Head', 315, headerTop + 26, { width: 260, align: 'right' });
    doc.text(docSnapshot.departmentEnglish || 'Department of Nephrology', 315, headerTop + 38, { width: 260, align: 'right' });
    doc.text(docSnapshot.hospitalEnglish || 'Bangladesh Medical College Hospital, Dhaka', 315, headerTop + 50, { width: 260, align: 'right' });
    doc.text(docSnapshot.specialtyEnglish || 'Kidney Disease and Transplant Specialist', 315, headerTop + 62, { width: 260, align: 'right' });
    if (docSnapshot.email) {
      doc.text(`E-mail : ${docSnapshot.email}`, 315, headerTop + 74, { width: 260, align: 'right' });
    }

    const afterHeaderY = Math.max(doc.y, headerTop + 88);

    // --- 2. PATIENT METADATA BAR ---
    doc.moveTo(leftMargin, afterHeaderY).lineTo(rightMargin, afterHeaderY).strokeColor('#888888').lineWidth(0.75).stroke();

    const metaRow1Y = afterHeaderY + 5;
    doc.fontSize(8.5).font(boldFont).text('Date :', leftMargin, metaRow1Y);
    doc.font(regFont).text(formatDate(prescription.prescriptionDate), leftMargin + 30, metaRow1Y);

    doc.font(boldFont).text('Last visit :', 170, metaRow1Y);
    doc.font(regFont).text(patSnapshot.lastVisitDate ? formatDate(patSnapshot.lastVisitDate) : '—', 218, metaRow1Y);

    doc.font(boldFont).text('Visit Number :', 315, metaRow1Y);
    doc.font(regFont).text(String(patSnapshot.visitNumber || 1), 378, metaRow1Y);

    doc.font(boldFont).text('Next visit :', 418, metaRow1Y);
    doc.font(regFont).text(
      prescription.nextFollowUp?.date
        ? formatDate(prescription.nextFollowUp.date)
        : prescription.followUpDate
        ? formatDate(prescription.followUpDate)
        : '—',
      468,
      metaRow1Y,
      { width: rightMargin - 468 },
    );

    const metaRow2Y = metaRow1Y + 14;
    doc.font(boldFont).text('Name :', leftMargin, metaRow2Y);
    doc.font(regFont).text(patSnapshot.name || profile.fullName || '—', leftMargin + 35, metaRow2Y, { width: 120 });

    doc.font(boldFont).text('ID :', 190, metaRow2Y);
    doc.font(regFont).text(patSnapshot.patientId || profile.patientId || '—', 208, metaRow2Y);

    doc.font(boldFont).text('Age :', 310, metaRow2Y);
    doc.font(regFont).text(patSnapshot.ageFormatted || `${patSnapshot.age || profile.age || '—'} Y`, 336, metaRow2Y);

    doc.font(boldFont).text('Blood Group :', 385, metaRow2Y);
    doc.font(regFont).text(patSnapshot.bloodGroup || profile.bloodGroup || '—', 450, metaRow2Y);

    doc.font(boldFont).text('Phone :', 480, metaRow2Y);
    doc.font(regFont).text(patSnapshot.phone || profile.phone || '—', 518, metaRow2Y, { width: 58 });

    const afterMetaY = metaRow2Y + 16;
    doc.moveTo(leftMargin, afterMetaY).lineTo(rightMargin, afterMetaY).strokeColor('#888888').lineWidth(0.75).stroke();

    // --- 3. TWO-COLUMN LAYOUT ---
    const colSplitX = 205; // Vertical dividing line position
    const leftColWidth = 160;
    const rightColX = 215;
    const rightColWidth = 361;
    const contentTopY = afterMetaY + 8;
    const footerTopY = 938; // Footer boundary

    // Vertical Divider Line
    doc.moveTo(colSplitX, contentTopY).lineTo(colSplitX, footerTopY).strokeColor('#999999').lineWidth(0.5).stroke();

    // --- LEFT COLUMN: Clinical Information ---
    let leftY = contentTopY;

    const renderLeftSection = (title, content) => {
      if (!content || !String(content).trim()) return;
      doc.fontSize(8.5).font(boldFont).fillColor('#000000').text(title, leftMargin, leftY, { width: leftColWidth, underline: true });
      leftY = doc.y + 2;

      const lines = String(content).split('\n').filter((l) => l.trim());
      lines.forEach((line) => {
        doc.fontSize(8).font(regFont).fillColor('#222222');
        doc.text(line.startsWith('•') ? line : `• ${line}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      });
      leftY += 6;
    };

    renderLeftSection('Chief complaint :', prescription.chiefComplaint);
    renderLeftSection('Co-Morbidities :', prescription.coMorbidities);
    renderLeftSection('Past History :', prescription.pastHistory);
    renderLeftSection('Personal History :', prescription.personalHistory);
    renderLeftSection('Smoking History :', prescription.smokingHistory);
    renderLeftSection('Menstrual History :', prescription.menstrualHistory);
    renderLeftSection('Drug History :', prescription.drugHistory);

    // Vitals / On Examinations
    const vitals = prescription.vitals || {};
    const hasBp = vitals.bloodPressure?.systolic || vitals.bloodPressure?.diastolic;
    const hasPulse = vitals.pulse?.value;
    const hasWeight = vitals.weight?.value;
    const hasHeight = vitals.height?.value;

    if (hasBp || hasPulse || hasWeight || hasHeight || vitals.temperature?.value || vitals.spo2?.value) {
      doc.fontSize(8.5).font(boldFont).fillColor('#000000').text('On Examinations :', leftMargin, leftY, { width: leftColWidth, underline: true });
      leftY = doc.y + 2;

      if (hasBp) {
        const bpDate = vitals.bloodPressure.recordedAt ? ` (${formatDate(vitals.bloodPressure.recordedAt)})` : '';
        doc.fontSize(8).font(regFont).text(`BP : ${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic} ${vitals.bloodPressure.unit || 'mm of Hg'}${bpDate}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      }
      if (hasPulse) {
        const pulseDate = vitals.pulse.recordedAt ? ` (${formatDate(vitals.pulse.recordedAt)})` : '';
        doc.fontSize(8).font(regFont).text(`Pulse: ${vitals.pulse.value} ${vitals.pulse.unit || 'b/min'}${pulseDate}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      }
      if (hasWeight) {
        const weightDate = vitals.weight.recordedAt ? ` (${formatDate(vitals.weight.recordedAt)})` : '';
        doc.fontSize(8).font(regFont).text(`Weight: ${vitals.weight.value} ${vitals.weight.unit || 'kg'}${weightDate}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      }
      if (hasHeight) {
        const heightDate = vitals.height.recordedAt ? ` (${formatDate(vitals.height.recordedAt)})` : '';
        doc.fontSize(8).font(regFont).text(`Height: ${vitals.height.value} ${vitals.height.unit || 'cm'}${heightDate}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      }
      if (vitals.bmi?.value) {
        doc.fontSize(8).font(regFont).text(`BMI: ${vitals.bmi.value} kg/m²${vitals.bmi.category ? ` (${vitals.bmi.category})` : ''}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      }
      if (vitals.temperature?.value) {
        doc.fontSize(8).font(regFont).text(`Temp: ${vitals.temperature.value} ${vitals.temperature.unit || '°F'}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      }
      if (vitals.spo2?.value) {
        doc.fontSize(8).font(regFont).text(`SpO2: ${vitals.spo2.value} ${vitals.spo2.unit || '%'}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      }
      leftY += 6;
    }

    renderLeftSection('Pathology & Imaging :', prescription.pathologyAndImaging);

    // Left Column Investigations list
    const investigations = prescription.investigations?.length
      ? prescription.investigations
      : prescription.labTests || [];
    if (investigations.length > 0) {
      doc.fontSize(8.5).font(boldFont).fillColor('#000000').text('Investigation :', leftMargin, leftY, { width: leftColWidth, underline: true });
      leftY = doc.y + 2;
      investigations.forEach((inv) => {
        doc.fontSize(8).font(regFont).text(`• ${inv.testName || inv.name}${inv.notes ? ` (${inv.notes})` : ''}`, leftMargin, leftY, { width: leftColWidth });
        leftY = doc.y + 1;
      });
      leftY += 6;
    }

    // --- RIGHT COLUMN: Diagnosis, Rx Medicines, Advice, Signature ---
    let rightY = contentTopY;

    // Diagnoses block and Rx Symbol
    const diagnosisList = (prescription.diagnoses || [])
      .map((d) => (typeof d === 'string' ? d : d.name || d.description))
      .filter(Boolean);

    // Render Rx Symbol top-right of the right column
    doc.fontSize(16).font(boldFont).fillColor('#000000').text('Rx', rightMargin - 28, rightY - 2, { align: 'right' });

    // Render Diagnosis label on its own line
    doc.fontSize(9).font(boldFont).fillColor('#000000').text('Diagnosis :', rightColX, rightY, { width: rightColWidth - 35 });
    rightY = doc.y + 1.5;

    // Render each diagnosis on its own line below 'Diagnosis :'
    if (diagnosisList.length > 0) {
      diagnosisList.forEach((diag, idx) => {
        const isLast = idx === diagnosisList.length - 1;
        const lineText = isLast ? diag : `${diag},`;
        doc.fontSize(8.5).font(regFont).fillColor('#111827').text(lineText, rightColX, rightY, { width: rightColWidth - 35 });
        rightY = doc.y + 1;
      });
    } else if (prescription.diagnosisSummary && String(prescription.diagnosisSummary).trim()) {
      const sumLines = String(prescription.diagnosisSummary).split('\n').map((l) => l.trim()).filter(Boolean);
      sumLines.forEach((diag, idx) => {
        const isLast = idx === sumLines.length - 1;
        const lineText = isLast || diag.endsWith(',') ? diag : `${diag},`;
        doc.fontSize(8.5).font(regFont).fillColor('#111827').text(lineText, rightColX, rightY, { width: rightColWidth - 35 });
        rightY = doc.y + 1;
      });
    } else {
      doc.fontSize(8.5).font(regFont).fillColor('#111827').text('—', rightColX, rightY, { width: rightColWidth - 35 });
      rightY = doc.y + 1;
    }

    rightY += 4;
    doc.moveTo(rightColX, rightY).lineTo(rightMargin, rightY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    rightY += 6;

    // Medicines List
    const items = prescription.items || [];
    items.forEach((item, index) => {
      const serial = item.serialNumber || index + 1;
      const type = item.medicineType ? `${item.medicineType.slice(0, 3)}. ` : '';
      const brand = item.brandName || item.medicineName || item.genericName;
      const genericBracket = item.genericName && (item.brandName || item.medicineName) ? ` (${item.genericName})` : '';
      const strength = item.strength ? ` ${item.strength}${item.strengthUnit ? ` ${item.strengthUnit}` : ''}` : '';

      // Medicine Line 1: 1. Tab. Lino 5 mg (Linagliptin)
      doc.fontSize(9.5).font(boldFont).fillColor('#000000');
      doc.text(`${serial}. ${type}${brand}${strength}`, rightColX, rightY, { continued: Boolean(genericBracket) });
      if (genericBracket) {
        doc.font(regFont).fillColor('#333333').text(genericBracket);
      }
      rightY = doc.y + 2;

      // Medicine Line 2: 1 + 0 + 0     খাবার পরে / ডায়াবেটিস এর ঔষধ     চলবে / ১৫ দিন
      const dosage = item.dosage || item.frequency || '1 + 0 + 0';
      const food = item.foodInstruction || item.timing || '';
      const duration = item.durationValue ? `${item.durationValue} ${item.durationUnit || 'Days'}` : '';
      const continuation = item.continuation || '';
      const special = item.specialInstruction || item.instructions || '';

      const detailParts = [dosage, food, special, duration || continuation].filter(Boolean);
      const detailLine = detailParts.join('       ');

      doc.fontSize(8.5).font(regFont).fillColor('#111827');
      doc.text(detailLine, rightColX + 15, rightY, { width: rightColWidth - 15 });
      rightY = doc.y + 6;
    });

    rightY += 6;

    // Advice (উপদেশ)
    const adviceList = Array.isArray(prescription.advice)
      ? prescription.advice.map((a) => (typeof a === 'string' ? a : a.text)).filter(Boolean)
      : typeof prescription.advice === 'string' && prescription.advice.trim()
      ? [prescription.advice]
      : [];
    if (adviceList.length > 0 || prescription.generalInstructions) {
      doc.fontSize(9).font(boldFont).fillColor('#000000').text('Advice ( উপদেশ ) :', rightColX, rightY);
      rightY = doc.y + 2;

      adviceList.forEach((adv, i) => {
        doc.fontSize(8.5).font(regFont).fillColor('#222222').text(`${i + 1}. ${adv}`, rightColX + 10, rightY, { width: rightColWidth - 10 });
        rightY = doc.y + 1;
      });
      if (prescription.generalInstructions) {
        doc.fontSize(8.5).font(regFont).fillColor('#222222').text(`• ${prescription.generalInstructions}`, rightColX + 10, rightY, { width: rightColWidth - 10 });
        rightY = doc.y + 1;
      }
      rightY += 6;
    }

    // Investigation advice
    if (prescription.investigationAdvice && String(prescription.investigationAdvice).trim()) {
      doc.fontSize(9).font(boldFont).fillColor('#000000').text('Investigation advice :', rightColX, rightY);
      rightY = doc.y + 2;
      const invLines = String(prescription.investigationAdvice).split('\n').filter((l) => l.trim());
      invLines.forEach((line) => {
        doc.fontSize(8.5).font(regFont).fillColor('#222222').text(line.startsWith('•') ? line : `• ${line}`, rightColX + 10, rightY, { width: rightColWidth - 10 });
        rightY = doc.y + 1;
      });
      rightY += 6;
    }

    // Next Follow Up (পরবর্তী সাক্ষাতের সময়)
    const followUp = prescription.nextFollowUp || {};
    if (followUp.date || prescription.followUpDate || followUp.instruction) {
      doc.fontSize(9).font(boldFont).fillColor('#000000').text('Next Follow Up ( পরবর্তী সাক্ষাতের সময় ) :', rightColX, rightY);
      rightY = doc.y + 2;
      const fDate = followUp.date || prescription.followUpDate ? formatDate(followUp.date || prescription.followUpDate) : '';
      const fInst = followUp.instruction ? ` (${followUp.instruction})` : '';
      doc.fontSize(8.5).font(regFont).text(`• ${fDate}${fInst}`, rightColX + 10, rightY, { width: rightColWidth - 10 });
      rightY = doc.y + 6;
    }

    // Test Advices
    if (prescription.testAdvices && String(prescription.testAdvices).trim()) {
      doc.fontSize(9).font(boldFont).fillColor('#000000').text('Test Advices:', rightColX, rightY);
      rightY = doc.y + 2;
      doc.fontSize(8.5).font(regFont).text(prescription.testAdvices, rightColX + 10, rightY, { width: rightColWidth - 10 });
      rightY = doc.y + 6;
    }

    // Doctor Signature Line (Bottom Right)
    const sigY = 885;
    doc.moveTo(390, sigY).lineTo(rightMargin, sigY).strokeColor('#000000').lineWidth(0.75).stroke();
    doc.fontSize(9.5).font(boldFont).fillColor('#000000').text(docSnapshot.name || `Dr. ${provider.name || 'Rezwanur Rahman'}`, 390, sigY + 4, {
      width: rightMargin - 390,
      align: 'center',
    });
    doc.fontSize(8).font(regFont).fillColor('#555555').text(docSnapshot.specialtyEnglish || 'Kidney Disease and Transplant Specialist', 390, sigY + 16, {
      width: rightMargin - 390,
      align: 'center',
    });

    // Barcode & Prescription ID (Bottom Left)
    doc.fontSize(7.5).font(boldFont).fillColor('#333333');
    doc.text(`Prescription ID: ${prescription.prescriptionId || prescription._id}`, leftMargin, sigY);
    if (prescription.verificationToken) {
      doc.fontSize(6.5).font(regFont).fillColor('#666666');
      doc.text(`Verify Token: ${prescription.verificationToken}`, leftMargin, sigY + 12);
      doc.text(`Scan QR to verify authentic medical record`, leftMargin, sigY + 22);
    }

    // --- 4. CHAMBER FOOTER ---
    const footerY = 945;
    doc.moveTo(leftMargin, footerY).lineTo(rightMargin, footerY).strokeColor('#888888').lineWidth(0.75).stroke();

    doc.fontSize(7.5).font(regFont).fillColor('#333333');
    const chamberLine =
      docSnapshot.chamberInfo ||
      'চেম্বার : পপুলার কনসালটেশন সেন্টার (ভবন-৬), রুম নং-৩০৬ (লেভেল-৩), বাড়ী-২, রোড-২, ধানমন্ডি, ঢাকা | রোগী দেখার সময় : শনি থেকে বৃহস্পতিবার বিকাল ৪টা থেকে রাত ১০টা, শুক্রবার বন্ধ E-mail : kidneydial@gmail.com';

    doc.text(chamberLine, leftMargin, footerY + 5, {
      width: pageWidth,
      align: 'center',
      lineGap: 2,
    });

    doc.end();
  });

