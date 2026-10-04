import { forwardRef } from 'react';
import { Stethoscope, Plus, Edit2, Trash2 } from 'lucide-react';
import { generateBarcodeSvg, generateQrSvg } from '../../lib/barcodeQr.js';
import { formatDate } from '../../lib/dateFormat.js';

const formatDisplayDate = (date) => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${days[d.getDay()]}`;
  } catch {
    return String(date);
  }
};

/**
 * Renders clinical notes content with bullets, or the clickable placeholder when empty
 */
function renderClinicalContent(text, placeholder, editable) {
  if (!text || !String(text).trim()) {
    if (editable) {
      return (
        <p className="text-slate-400 text-[9.5px] font-normal leading-tight select-none italic hover:text-indigo-600 transition-colors inline-flex items-center gap-1">
          <span>{placeholder}</span>
        </p>
      );
    }
    return null;
  }

  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="mt-0.5 text-slate-800 space-y-0.5 pl-0.5">
      {lines.map((line, idx) => {
        const isBullet = /^[•\-\*]\s+/.test(line);
        const isNumbered = /^\d+\.\s+/.test(line);
        const clean = line.replace(/^[•\-\*]\s+/, '');

        return (
          <p key={idx} className="text-[9px] leading-tight text-slate-800">
            {isBullet ? '• ' : isNumbered ? '' : '• '}
            {clean}
          </p>
        );
      })}
    </div>
  );
}

/**
 * LegalPrescriptionDocument — Exact Legal 8.5" × 14" prescription canvas matching reference UI.
 * Used for interactive on-page prescription editing, preview, and print.
 */
export const LegalPrescriptionDocument = forwardRef(function LegalPrescriptionDocument(
  {
    prescription,
    className = '',
    scale = 1,
    editable = false,
    onEdit,
    onAddItem,
    onOpenSection,
    onOpenPatientEdit,
    onEditItem,
    onRemoveItem,
  },
  ref,
) {
  if (!prescription) return null;

  const docSnapshot = prescription.doctorSnapshot || {};
  const patSnapshot = prescription.patientSnapshot || {};
  const vitals = prescription.vitals || {};
  const items = prescription.items || [];
  const diagnoses = prescription.diagnoses || [];
  const investigations = prescription.investigations?.length ? prescription.investigations : prescription.labTests || [];
  const followUp = prescription.nextFollowUp || {};

  const prescriptionId = prescription.prescriptionId || prescription.id || 'RX-2026-000001';
  const verificationToken = prescription.verificationToken || prescriptionId;

  const qrSvg = generateQrSvg(
    `https://ashshafi.health/verify/${verificationToken}?rx=${prescriptionId}`,
    { size: 70 },
  );
  const barcodeSvg = generateBarcodeSvg(prescriptionId, { width: 140, height: 32, showText: true });

  const bpRecordedDate = vitals.bloodPressure?.recordedAt ? ` (${formatDisplayDate(vitals.bloodPressure.recordedAt)})` : '';
  const pulseRecordedDate = vitals.pulse?.recordedAt ? ` (${formatDisplayDate(vitals.pulse.recordedAt)})` : '';
  const weightRecordedDate = vitals.weight?.recordedAt ? ` (${formatDisplayDate(vitals.weight.recordedAt)})` : '';
  const heightRecordedDate = vitals.height?.recordedAt ? ` (${formatDisplayDate(vitals.height.recordedAt)})` : '';
  const tempRecordedDate = vitals.temperature?.recordedAt ? ` (${formatDisplayDate(vitals.temperature.recordedAt)})` : '';
  const spo2RecordedDate = vitals.spo2?.recordedAt ? ` (${formatDisplayDate(vitals.spo2.recordedAt)})` : '';

  const adviceList = Array.isArray(prescription.advice)
    ? prescription.advice.map((a) => (typeof a === 'string' ? a : a.text)).filter(Boolean)
    : typeof prescription.advice === 'string' && prescription.advice.trim()
    ? [prescription.advice]
    : [];

  const baseWidthPx = 816; // 8.5 inches * 96 DPI
  const baseHeightPx = 1344; // 14 inches * 96 DPI
  const scaledWidth = scale !== 1 ? `${Math.round(baseWidthPx * scale)}px` : '8.5in';
  const scaledHeight = scale !== 1 ? `${Math.round(baseHeightPx * scale)}px` : '14in';

  // Helper to wrap clickable section container
  const sectionClass = editable
    ? 'group cursor-pointer -mx-1 px-1.5 py-0.5 rounded-lg transition-all duration-150 hover:bg-indigo-50/50 hover:ring-1 hover:ring-indigo-200/70 print:hover:bg-transparent print:hover:ring-0 relative'
    : '';

  return (
    <div
      className="prescription-preview-wrapper relative flex justify-center items-start transition-all duration-150 select-text"
      style={{
        width: scaledWidth,
        height: scaledHeight,
        maxWidth: '100%',
      }}
    >
      <div
        ref={ref}
        id="printable-prescription-document"
        className={`legal-prescription-paper bg-white text-slate-900 font-sans shadow-2xl relative select-text transition-transform duration-150 origin-top shrink-0 ${className}`}
        style={{
          width: '8.5in',
          minHeight: '14in',
          maxHeight: '14in',
          height: '14in',
          padding: '0.45in 0.5in',
          boxSizing: 'border-box',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center',
          pageBreakAfter: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        {/* Prescription Paper Container with flex column */}
        <div className="h-full flex flex-col justify-between text-[11px] leading-snug">
          <div>
            {/* 1. DOCTOR BILINGUAL HEADER (Exact Reference UI) */}
            <div className="grid grid-cols-2 gap-4 pb-1.5">
              {/* Left Header: Bengali Doctor Profile */}
              <div className="text-left space-y-0.5">
                <h1 className="text-[15px] font-bold text-slate-950 tracking-tight font-sans">
                  {docSnapshot.nameBangla || 'প্রফেসর ডা. রেজওয়ানুর রহমান'}
                </h1>
                <p className="text-[10px] text-slate-800 font-medium">
                  {docSnapshot.degreesBangla || 'এমবিবিএস, এমডি (নেফ্রোলজি), এফআরসিপি (এডিন)'}
                </p>
                <p className="text-[9.5px] text-slate-700">
                  {docSnapshot.designationBangla || 'অধ্যাপক ও বিভাগীয় প্রধান'}
                </p>
                <p className="text-[9.5px] text-slate-700">
                  {docSnapshot.departmentBangla || 'কিডনী রোগ ও ডায়ালাইসিস বিভাগ'}
                </p>
                <p className="text-[9.5px] text-slate-700">
                  {docSnapshot.hospitalBangla || 'বাংলাদেশ মেডিকেল কলেজ হাসপাতাল, ঢাকা'}
                </p>
                <p className="text-[10px] font-bold text-[#1e6b52]">
                  {docSnapshot.specialtyBangla || 'কিডনী রোগ ও কিডনি প্রতিস্থাপন বিশেষজ্ঞ'}
                </p>
              </div>

              {/* Right Header: English Doctor Profile */}
              <div className="text-right space-y-0.5">
                <h1 className="text-[15px] font-bold text-slate-950 tracking-tight">
                  {docSnapshot.name || 'Dr. Miran'}
                </h1>
                <p className="text-[10px] text-slate-800 font-medium">
                  {docSnapshot.degreesEnglish || 'MBBS, MD (Nephrology), FRCP (Edin)'}
                </p>
                <p className="text-[9.5px] text-slate-700">
                  {docSnapshot.designationEnglish || 'Professor & Head'}
                </p>
                <p className="text-[9.5px] text-slate-700">
                  {docSnapshot.departmentEnglish || 'Department of Nephrology'}
                </p>
                <p className="text-[9.5px] text-slate-700">
                  {docSnapshot.hospitalEnglish || 'Bangladesh Medical College Hospital, Dhaka'}
                </p>
                <p className="text-[10px] font-bold text-[#1e6b52]">
                  {docSnapshot.specialtyEnglish || 'Kidney Disease and Transplant Specialist'}
                </p>
              </div>
            </div>

            {/* 2. PATIENT DEMOGRAPHIC STRIP (Exact Reference UI) */}
            <div className="border-t border-b border-slate-400 py-1.5 my-1 text-[9.5px]">
              {/* Row 1: Date | Last visit | Visit Number | Next visit */}
              <div className="grid grid-cols-4 gap-2 mb-1">
                <div>
                  <span className="font-bold">Date : </span>
                  <span>{formatDisplayDate(prescription.prescriptionDate || new Date())}</span>
                </div>
                <div>
                  <span className="font-bold">Last visit : </span>
                  <span>{patSnapshot.lastVisitDate ? formatDisplayDate(patSnapshot.lastVisitDate) : '—'}</span>
                </div>
                <div>
                  <span className="font-bold">Visit Number : </span>
                  <span>{patSnapshot.visitNumber || 1}</span>
                </div>
                <div
                  className={editable ? 'cursor-pointer hover:text-blue-700 transition-colors' : ''}
                  onClick={editable ? () => onOpenSection?.('nextVisit') : undefined}
                >
                  <span className="font-bold">Next visit : </span>
                  <span>
                    {followUp.date
                      ? formatDisplayDate(followUp.date)
                      : prescription.followUpDate
                      ? formatDisplayDate(prescription.followUpDate)
                      : '—'}
                  </span>
                  {editable ? (
                    <span className="text-[#8899a6] ml-2 text-[9px] hover:underline">
                      {followUp.date || prescription.followUpDate
                        ? followUp.instruction
                          ? ` (${followUp.instruction})`
                          : ''
                        : 'Click to add next visit'}
                    </span>
                  ) : followUp.instruction ? (
                    <span className="text-slate-600 italic"> ({followUp.instruction})</span>
                  ) : null}
                </div>
              </div>

              {/* Row 2: Name | ID | Age | Blood Group | Phone (All Editable on click) */}
              <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-200">
                <div
                  className={`col-span-1 truncate ${
                    editable ? 'cursor-pointer hover:bg-indigo-50/60 hover:ring-1 hover:ring-indigo-200/70 rounded-md px-1.5 -mx-1.5 transition-all group' : ''
                  }`}
                  onClick={editable ? () => onOpenPatientEdit?.('name') : undefined}
                  title={editable ? 'Click to edit patient name' : undefined}
                >
                  <span className="font-bold">Name : </span>
                  <span className="font-medium text-slate-900">{patSnapshot.name || 'fahim khan'}</span>
                  {editable && <Edit2 size={9} className="inline ml-1 opacity-0 group-hover:opacity-100 text-indigo-600 print:hidden" />}
                </div>

                <div>
                  <span className="font-bold">ID : </span>
                  <span className="font-mono">{patSnapshot.patientId || 'PAT-202609-0001'}</span>
                </div>

                <div
                  className={
                    editable ? 'cursor-pointer hover:bg-indigo-50/60 hover:ring-1 hover:ring-indigo-200/70 rounded-md px-1.5 -mx-1.5 transition-all group' : ''
                  }
                  onClick={editable ? () => onOpenPatientEdit?.('age') : undefined}
                  title={editable ? 'Click to edit age' : undefined}
                >
                  <span className="font-bold">Age : </span>
                  <span>{patSnapshot.ageFormatted || `${patSnapshot.age || '28'} Y`}</span>
                  {editable && <Edit2 size={9} className="inline ml-1 opacity-0 group-hover:opacity-100 text-indigo-600 print:hidden" />}
                </div>

                <div
                  className={
                    editable ? 'cursor-pointer hover:bg-rose-50/70 hover:ring-1 hover:ring-rose-200/80 rounded-md px-1.5 -mx-1.5 transition-all group' : ''
                  }
                  onClick={editable ? () => onOpenPatientEdit?.('bloodGroup') : undefined}
                  title={editable ? 'Click to change blood group' : undefined}
                >
                  <span className="font-bold">Blood Group : </span>
                  <span className="font-bold text-rose-600 bg-rose-50/80 px-1.5 py-0.5 rounded border border-rose-200/60">{patSnapshot.bloodGroup || 'B+'}</span>
                  {editable && <Edit2 size={9} className="inline ml-1 opacity-0 group-hover:opacity-100 text-rose-600 print:hidden" />}
                </div>

                <div
                  className={
                    editable ? 'cursor-pointer hover:bg-indigo-50/60 hover:ring-1 hover:ring-indigo-200/70 rounded-md px-1.5 -mx-1.5 transition-all group' : ''
                  }
                  onClick={editable ? () => onOpenPatientEdit?.('phone') : undefined}
                  title={editable ? 'Click to edit phone number' : undefined}
                >
                  <span className="font-bold">Phone : </span>
                  <span>{patSnapshot.phone || '01753563877'}</span>
                  {editable && <Edit2 size={9} className="inline ml-1 opacity-0 group-hover:opacity-100 text-indigo-600 print:hidden" />}
                </div>
              </div>
            </div>

            {/* 3. TWO-COLUMN MEDICAL CONTENT WITH VERTICAL DIVIDER */}
            <div className="grid grid-cols-[2.45in_1fr] gap-4 pt-1" style={{ minHeight: '8.8in' }}>
              {/* LEFT COLUMN: All 10 Clinical History & Examination Sections */}
              <div className="border-r border-slate-300 pr-3 space-y-2.5 text-[9px] leading-tight">
                {/* 1. Chief Complaint */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('chiefComplaint') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Chief Complaint :</h4>
                  {renderClinicalContent(prescription.chiefComplaint, 'Click to add complaints ...', editable)}
                </div>

                {/* 2. Co - Morbidities */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('coMorbidities') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Co - Morbidities :</h4>
                  {renderClinicalContent(prescription.coMorbidities, 'Click to add co - morbidities ...', editable)}
                </div>

                {/* 3. Past History */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('pastHistory') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Past History :</h4>
                  {renderClinicalContent(prescription.pastHistory, 'Click to past History ...', editable)}
                </div>

                {/* 4. Personal History */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('personalHistory') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Personal History :</h4>
                  {renderClinicalContent(prescription.personalHistory, 'Click to Personal History ...', editable)}
                </div>

                {/* 5. On examination : (Vitals & Physical Exam) */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('onExamination') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">On examination :</h4>
                  {prescription.onExamination ? (
                    renderClinicalContent(prescription.onExamination, '', editable)
                  ) : vitals.bloodPressure?.systolic ||
                  vitals.pulse?.value ||
                  vitals.weight?.value ||
                  vitals.height?.value ||
                  vitals.temperature?.value ||
                  vitals.spo2?.value ? (
                    <div className="mt-0.5 space-y-0.5 pl-0.5 text-slate-800">
                      {vitals.bloodPressure?.systolic || vitals.bloodPressure?.diastolic ? (
                        <p>
                          <span className="font-medium">BP : </span>
                          {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic} {vitals.bloodPressure.unit || 'mm of Hg'}
                          <span className="text-[8px] text-slate-500">{bpRecordedDate}</span>
                        </p>
                      ) : null}
                      {vitals.pulse?.value ? (
                        <p>
                          <span className="font-medium">Pulse: </span>
                          {vitals.pulse.value} {vitals.pulse.unit || 'b/min'}
                          <span className="text-[8px] text-slate-500">{pulseRecordedDate}</span>
                        </p>
                      ) : null}
                      {vitals.weight?.value ? (
                        <p>
                          <span className="font-medium">Weight: </span>
                          {vitals.weight.value} {vitals.weight.unit || 'kg'}
                          <span className="text-[8px] text-slate-500">{weightRecordedDate}</span>
                        </p>
                      ) : null}
                      {vitals.height?.value ? (
                        <p>
                          <span className="font-medium">Height: </span>
                          {vitals.height.value} {vitals.height.unit || 'cm'}
                          <span className="text-[8px] text-slate-500">{heightRecordedDate}</span>
                        </p>
                      ) : null}
                      {vitals.temperature?.value ? (
                        <p>
                          <span className="font-medium">Temp: </span>
                          {vitals.temperature.value} {vitals.temperature.unit || '°F'}
                          <span className="text-[8px] text-slate-500">{tempRecordedDate}</span>
                        </p>
                      ) : null}
                      {vitals.spo2?.value ? (
                        <p>
                          <span className="font-medium">SpO2: </span>
                          {vitals.spo2.value} {vitals.spo2.unit || '%'}
                          <span className="text-[8px] text-slate-500">{spo2RecordedDate}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : editable ? (
                    <p className="text-[#8899a6] text-[9.5px] font-normal italic select-none hover:text-blue-600 transition-colors">
                      Click to add vitals .........
                    </p>
                  ) : null}
                </div>

                {/* 6. Smoking History */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('smokingHistory') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Smoking History :</h4>
                  {renderClinicalContent(prescription.smokingHistory, 'Click to add Smoking History', editable)}
                </div>

                {/* 7. Drug History */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('drugHistory') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Drug History :</h4>
                  {renderClinicalContent(prescription.drugHistory, 'Click to add Drug History', editable)}
                </div>

                {/* 8. Menstrual History */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('menstrualHistory') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Menstrual History :</h4>
                  {renderClinicalContent(prescription.menstrualHistory, 'Click to add Menstrual History ...', editable)}
                </div>

                {/* 9. Pathology & imaging */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('pathologyAndImaging') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Pathology & imaging :</h4>
                  {renderClinicalContent(prescription.pathologyAndImaging, 'Click to add pathology & imaging ...', editable)}
                </div>

                {/* 10. Investigation / Test */}
                <div
                  className={sectionClass}
                  onClick={editable ? () => onOpenSection?.('investigation') : undefined}
                >
                  <h4 className="font-bold text-slate-950 text-[9.5px]">Investigation / Test :</h4>
                  {prescription.investigation ? (
                    renderClinicalContent(prescription.investigation, '', editable)
                  ) : investigations.length > 0 ? (
                    <div className="mt-0.5 text-slate-800 pl-0.5 space-y-0.5">
                      {investigations.map((inv, idx) => (
                        <p key={inv.id || inv._id || idx}>
                          • {inv.testName || inv.name}
                          {inv.notes ? <span className="text-slate-600 italic"> ({inv.notes})</span> : ''}
                        </p>
                      ))}
                    </div>
                  ) : editable ? (
                    <p className="text-[#8899a6] text-[9.5px] font-normal italic select-none hover:text-blue-600 transition-colors">
                      Click to add investigation / Test ...
                    </p>
                  ) : null}
                </div>
              </div>

              {/* RIGHT COLUMN: Diagnosis, Rx Symbol, Medicines, Advice */}
              <div className="pl-1 flex flex-col justify-between">
                <div>
                  {/* Diagnosis Header + Rx Symbol */}
                  <div className="flex items-start justify-between border-b border-slate-200 pb-1 mb-2">
                    <div
                      className={`flex-1 pr-4 ${sectionClass}`}
                      onClick={editable ? () => onOpenSection?.('diagnoses') : undefined}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-950">
                        {/* Stethoscope Icon in Cyan/Teal */}
                        <div className="inline-flex items-center justify-center text-cyan-600">
                          <Stethoscope size={15} strokeWidth={2.2} />
                        </div>
                        <span>Diagnosis :</span>
                        {(!diagnoses.length && !prescription.diagnosisSummary && editable) && (
                          <span className="text-slate-400 font-normal text-[10px] ml-1.5 italic hover:text-indigo-600 transition-colors">
                            Click to add diagnosis
                          </span>
                        )}
                      </div>

                      {/* Display Diagnoses */}
                      {(diagnoses.length > 0 || prescription.diagnosisSummary) && (
                        <div className="text-[10px] font-medium text-slate-800 mt-1 pl-5 space-y-0.5">
                          {diagnoses.length > 0
                            ? diagnoses.map((d, i) => (
                                <div key={d.id || d._id || i}>
                                  • {d.name || d.description || ''}
                                </div>
                              ))
                            : prescription.diagnosisSummary.split('\n').map((line, i) => (
                                <div key={i}>• {line.trim()}</div>
                              ))}
                        </div>
                      )}
                    </div>

                    {/* Rx Symbol (Italic Serif Font) */}
                    <div className="font-serif italic font-bold text-[24px] text-slate-900 leading-none pl-2 select-none">
                      Rx
                    </div>
                  </div>

                  {/* + Add medicine line Button with pill graphic */}
                  {editable ? (
                    <div className="my-2.5">
                      <button
                        type="button"
                        onClick={() => onAddItem?.()}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-400 bg-white hover:bg-indigo-50/40 text-[10.5px] font-semibold text-slate-800 hover:text-indigo-700 hover:border-indigo-400 shadow-2xs transition-all cursor-pointer group"
                        title="Add New Medicine Line"
                      >
                        <span>+ Add medicine line</span>
                        {/* Pill capsule graphic: cyan left, coral/red right */}
                        <span className="inline-flex items-center w-5 h-2.5 rounded-full border border-slate-600 overflow-hidden shadow-2xs">
                          <span className="w-1/2 h-full bg-cyan-400"></span>
                          <span className="w-1/2 h-full bg-rose-400"></span>
                        </span>
                      </button>
                    </div>
                  ) : null}

                  {/* Medicines List */}
                  <div className="space-y-2 mb-4">
                    {items.map((item, index) => {
                      const serial = item.serialNumber || index + 1;
                      const type = item.medicineType ? `${item.medicineType.slice(0, 3)}. ` : '';
                      const brand = item.brandName || item.medicineName || item.genericName;
                      const genericBracket = item.genericName && (item.brandName || item.medicineName) ? `(${item.genericName})` : '';
                      const strengthDisplay = item.strength ? `${item.strength}${item.strengthUnit ? ` ${item.strengthUnit}` : ''}` : '';
                      const durationDisplay = item.durationValue ? `${item.durationValue}${item.durationUnit ? ` ${item.durationUnit}` : ''}` : '';
                      const itemKey = item.id || item._id || index;

                      return (
                        <div
                          key={itemKey}
                          className={`text-[10px] leading-tight group relative ${
                            editable ? 'p-1 -mx-1 rounded-md hover:bg-indigo-50/40 transition-colors' : ''
                          }`}
                        >
                          {/* Line 1: 1. Tab. Lino 5 mg (Linagliptin) */}
                          <div className="font-bold text-slate-950 flex items-center justify-between">
                            <div>
                              <span>{serial}. {type}{brand}</span>
                              {strengthDisplay ? <span> {strengthDisplay}</span> : null}
                              {genericBracket ? (
                                <span className="font-normal text-slate-600 italic ml-1.5">{genericBracket}</span>
                              ) : null}
                            </div>

                            {/* Quick action buttons on hover when editable */}
                            {editable ? (
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity print:hidden">
                                <button
                                  type="button"
                                  onClick={() => onEditItem?.(item, index)}
                                  className="p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                  title="Edit Medicine"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemoveItem?.(index)}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  title="Remove Medicine"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ) : null}
                          </div>

                          {/* Line 2: 1 + 0 + 0     খাবার পরে     ডায়াবেটিস এর ঔষধ     চলবে */}
                          <div className="flex flex-wrap items-center gap-x-5 text-[9.5px] text-slate-800 pl-3.5 mt-0.5">
                            <span className="font-semibold text-slate-900">{item.dosage || item.frequency || '1 + 0 + 0'}</span>
                            {item.foodInstruction ? <span>{item.foodInstruction}</span> : null}
                            {item.specialInstruction ? (
                              <span className="text-slate-700 italic">{item.specialInstruction}</span>
                            ) : null}
                            {durationDisplay ? <span className="font-medium">{durationDisplay}</span> : null}
                            {item.continuation ? (
                              <span className="font-medium text-emerald-800">{item.continuation}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Advice ( উপদেশ ) */}
                  <div
                    className={sectionClass}
                    onClick={editable ? () => onOpenSection?.('advice') : undefined}
                  >
                    <h4 className="font-bold text-slate-950 text-[10px]">Advice ( উপদেশ ) :</h4>
                    {adviceList.length > 0 || prescription.generalInstructions ? (
                      <div className="mt-0.5 pl-2 space-y-0.5 text-slate-800 text-[9.5px]">
                        {adviceList.map((adv, i) => (
                          <p key={i}>
                            {i + 1}. {adv}
                          </p>
                        ))}
                        {prescription.generalInstructions ? (
                          <p>• {prescription.generalInstructions}</p>
                        ) : null}
                      </div>
                    ) : editable ? (
                      <p className="text-[#8899a6] text-[9.5px] font-normal italic select-none hover:text-blue-600 transition-colors">
                        Click to add advice ...
                      </p>
                    ) : null}
                  </div>

                  {/* Investigation advice */}
                  <div
                    className={sectionClass}
                    onClick={editable ? () => onOpenSection?.('investigationAdvice') : undefined}
                  >
                    <h4 className="font-bold text-slate-950 text-[10px] mt-2">Investigation advice :</h4>
                    {renderClinicalContent(prescription.investigationAdvice, 'Click to add investigation advice ...', editable)}
                  </div>

                  {/* Test advice */}
                  <div
                    className={sectionClass}
                    onClick={editable ? () => onOpenSection?.('testAdvices') : undefined}
                  >
                    <h4 className="font-bold text-slate-950 text-[10px] mt-2">Test advice :</h4>
                    {renderClinicalContent(prescription.testAdvices, 'Click to add Test advice ...', editable)}
                  </div>
                </div>

                {/* Bottom Row inside Right Column: QR & Barcode (left) and Doctor Signature (right) */}
                <div className="pt-4 mt-auto flex items-end justify-between border-t border-slate-200">
                  {/* QR Code & Barcode */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="border border-slate-300 p-0.5 rounded bg-white shadow-xs"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                      <div>
                        <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
                        <p className="text-[7.5px] text-slate-500 font-mono mt-0.5">
                          Verify: {verificationToken.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Signature & Seal */}
                  <div className="text-center w-48">
                    <div className="border-t border-slate-900 pt-1">
                      <p className="font-bold text-[10.5px] text-slate-950">
                        {docSnapshot.name || 'Dr. Miran'}
                      </p>
                      <p className="text-[8px] text-slate-600">
                        {docSnapshot.specialtyEnglish || 'Kidney Disease and Transplant Specialist'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. CHAMBER FOOTER */}
          <div className="border-t border-slate-400 pt-1.5 mt-2 text-center text-[8px] text-slate-700 leading-snug">
            <p>
              {docSnapshot.chamberInfo ||
                'চেম্বার : পপুলার কনসালটেশন সেন্টার (ভবন-৬), রুম নং-৩০৬ (লেভেল-৩), বাড়ী-২, রোড-২, ধানমন্ডি, ঢাকা | রোগী দেখার সময় : শনি থেকে বৃহস্পতিবার বিকাল ৪টা থেকে রাত ১০টা, শুক্রবার বন্ধ E-mail : kidneydial@gmail.com'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LegalPrescriptionDocument;
