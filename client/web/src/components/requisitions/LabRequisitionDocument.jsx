import { forwardRef } from 'react';
import { generateBarcodeSvg, generateQrSvg } from '../../lib/barcodeQr.js';
import { DEFAULT_TEST_CATALOG } from '../../constants/testCatalog.js';

const TEST_BY_CODE = new Map(DEFAULT_TEST_CATALOG.map((t) => [t.code, t]));

const formatDisplayDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  } catch {
    return String(date);
  }
};

// Same safe contentEditable pattern as LegalPrescriptionDocument.jsx —
// duplicated locally (rather than shared) since the two documents are
// otherwise independent and this is the only editable text region on
// this particular form.
const escapeForEditable = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');

function EditableText({ value, placeholder = '', onCommit, editable, className = '', fieldKey }) {
  if (!editable) {
    return <span className={className}>{value || ''}</span>;
  }
  return (
    <span
      key={fieldKey}
      className={`${className} rx-editable inline-block min-w-[3ch] rounded-sm cursor-text hover:outline hover:outline-1 hover:outline-dashed hover:outline-slate-400 focus:outline focus:outline-1 focus:outline-dashed focus:outline-blue-500 focus:bg-blue-50/50 print:outline-none print:bg-transparent`}
      contentEditable
      suppressContentEditableWarning
      onFocus={(e) => {
        if (!value && placeholder) e.currentTarget.innerText = '';
      }}
      dangerouslySetInnerHTML={{ __html: escapeForEditable(value) || `<span class="text-slate-400 italic">${placeholder}</span>` }}
      onBlur={(e) => {
        const text = e.currentTarget.innerText.replace(/\u00A0/g, ' ').trim();
        if (text !== (value || '').trim()) onCommit(text);
      }}
    />
  );
}

/**
 * Bangladesh Medical College Hospital Requisition Form.
 * Dimensions: Exact A4 Page (8.27in × 11.69in / 210mm × 297mm).
 * Margin: Exactly 0.3in in all directions.
 *
 * `editable` turns this into a direct writing surface (same principle
 * as LegalPrescriptionDocument.jsx): Clinical Diagnosis becomes a
 * click-to-type field, every checkbox on the printed checklist becomes
 * clickable to tick/untick that test, and the admission-logistics
 * blanks (Cabin/Semi Cabin, OPD/Ward #, Bed No, Paying/Non Paying —
 * fields with no other home anywhere in the UI) become typable too.
 * `editableIdentity` separately governs Patient's Name/Age/Sex: those
 * are only ever safe to type here for a WALK-IN patient (no linked
 * PatientProfile yet) — for a linked patient, the server always
 * recomputes the snapshot from that real record and ignores anything
 * sent for these fields, so making them "editable" there would look
 * like it works while silently discarding every keystroke. Regn No
 * and the referring doctor's name stay fixed in every case for the
 * same reason (see prescription's own "Fixed header/patient/doctor"
 * requirement — this document follows the same principle).
 * Checked state, layout, and every other region are pixel-identical
 * whether `editable`/`editableIdentity` is true or false, so print/PDF
 * output never changes.
 */
export const LabRequisitionDocument = forwardRef(function LabRequisitionDocument(
  { requisition, scale = 1, className = '', editable = false, editableIdentity = false, onToggleTest, onFieldChange },
  ref,
) {
  if (!requisition) return null;

  const docSnapshot = requisition.doctorSnapshot || {};
  const patSnapshot = requisition.patientSnapshot || {};
  const admissionDetails = requisition.admissionDetails || {};
  const tests = requisition.tests || [];
  const selectedCodeSet = new Set(tests.map((t) => t.code));

  const handleToggle = (code, fallbackLabel) => {
    if (!onToggleTest) return;
    const catalogEntry = TEST_BY_CODE.get(code);
    onToggleTest({
      code,
      name: catalogEntry?.name || fallbackLabel || code,
      category: catalogEntry?.category || 'OTHER',
      costBDT: catalogEntry?.costBDT || 0,
    });
  };

  // Thin wrapper so every one of the ~150 `Row` call sites below
  // doesn't need its own `editable`/`onToggle` prop — see Row() itself
  // further down for the click behaviour.
  const RowBound = (props) => <Row {...props} editable={editable} onToggle={handleToggle} />;

  // A4 Standard Dimensions at 96 DPI: 8.27in (794px) × 11.69in (1122px)
  const baseWidthPx = 794;
  const baseHeightPx = 1122;

  const scaledWidth = Math.round(baseWidthPx * scale);
  const scaledHeight = Math.round(baseHeightPx * scale);

  return (
    <div
      className={`requisition-preview-wrapper flex justify-center items-start overflow-hidden ${className}`}
      style={{
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
        margin: '0 auto',
        position: 'relative',
      }}
    >
      <div
        ref={ref}
        id="printable-requisition-document"
        className="requisition-paper bg-white text-black shadow-2xl relative select-text"
        style={{
          width: '8.27in',
          height: '11.69in',
          maxHeight: '11.69in',
          padding: '0.3in',
          margin: '0',
          boxSizing: 'border-box',
          fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          lineHeight: 1.15,
          color: '#000000',
        }}
      >
        {/* 1. HOSPITAL HEADER */}
        <div className="text-center pb-1">
          <h1 className="text-[15.5px] font-bold uppercase tracking-wide text-black leading-tight">
            BANGLADESH MEDICAL COLLEGE HOSPITAL
          </h1>
          <p className="text-[8.5px] text-black font-normal mt-0.5">
            House # 33-35, Road # 14/A (New), Dhanmondi R/A, Dhaka-1209, Bangladesh
          </p>
          <h2 className="text-[11.5px] font-bold tracking-widest uppercase mt-1">
            REQUISITION FORM
          </h2>
        </div>

        {/* 2. PATIENT DEMOGRAPHIC STRIP (Exact paper format with dot-leaders) */}
        <div className="text-[8.5px] leading-tight border-b border-black pb-1 mb-1">
          <div className="flex justify-between items-baseline">
            <div className="flex-1 flex items-baseline">
              <span className="whitespace-nowrap font-normal">Patient's Name</span>
              <span className="font-semibold px-1.5 text-black">
                <EditableText
                  editable={editableIdentity}
                  value={patSnapshot.name}
                  placeholder="patient name…"
                  fieldKey="patientName"
                  onCommit={(text) => {
                    const [firstName, ...rest] = text.split(' ');
                    onFieldChange?.('walkIn.firstName', firstName || '');
                    onFieldChange?.('walkIn.lastName', rest.join(' '));
                  }}
                />
              </span>
              <span className="flex-1 border-b border-dotted border-black min-w-[30px]" />
            </div>
            <div className="w-[18%] flex items-baseline ml-3">
              <span className="whitespace-nowrap font-normal">Age</span>
              <span className="font-semibold px-1 text-black">
                <EditableText
                  editable={editableIdentity}
                  value={patSnapshot.age}
                  placeholder="age"
                  fieldKey="patientAge"
                  onCommit={(text) => onFieldChange?.('walkIn.age', text)}
                />
              </span>
              <span className="flex-1 border-b border-dotted border-black min-w-[20px]" />
            </div>
          </div>

          <div className="flex justify-between items-baseline mt-1">
            <div className="w-[18%] flex items-baseline">
              <span className="whitespace-nowrap font-normal">Sex : M/F</span>
              <span className="font-semibold px-1 text-black">
                {editableIdentity ? (
                  <EditableText
                    editable
                    value={patSnapshot.sex ? patSnapshot.sex[0].toUpperCase() : ''}
                    placeholder="M/F"
                    fieldKey="patientSex"
                    onCommit={(text) => {
                      const c = text.trim()[0]?.toUpperCase();
                      onFieldChange?.('walkIn.sex', c === 'F' ? 'Female' : c === 'M' ? 'Male' : 'Other');
                    }}
                  />
                ) : (
                  patSnapshot.sex ? patSnapshot.sex[0].toUpperCase() : ''
                )}
              </span>
              <span className="flex-1 border-b border-dotted border-black" />
            </div>
            <div className="w-[24%] flex items-baseline ml-2">
              <span className="whitespace-nowrap font-normal">Regn. No</span>
              <span className="font-mono font-semibold px-1 text-black">
                {patSnapshot.patientId || ''}
              </span>
              <span className="flex-1 border-b border-dotted border-black" />
            </div>
            <div className="w-[28%] flex items-baseline ml-2">
              <span className="whitespace-nowrap font-normal">Cabin/Semi Cabin</span>
              <span className="font-medium px-1 text-black">
                <EditableText
                  editable={editable}
                  value={admissionDetails.cabinSemiCabin}
                  placeholder="cabin…"
                  fieldKey="cabinSemiCabin"
                  onCommit={(text) => onFieldChange?.('admissionDetails.cabinSemiCabin', text)}
                />
              </span>
              <span className="flex-1 border-b border-dotted border-black" />
            </div>
            <div className="w-[24%] flex items-baseline ml-2">
              <span className="whitespace-nowrap font-normal">OPD/Ward #</span>
              <span className="font-medium px-1 text-black">
                <EditableText
                  editable={editable}
                  value={admissionDetails.opdWardNo}
                  placeholder="ward #…"
                  fieldKey="opdWardNo"
                  onCommit={(text) => onFieldChange?.('admissionDetails.opdWardNo', text)}
                />
              </span>
              <span className="flex-1 border-b border-dotted border-black" />
            </div>
          </div>

          <div className="flex justify-between items-baseline mt-1">
            <div className="flex-1 flex items-baseline">
              <span className="whitespace-nowrap font-normal">Refd. by Dr./Prof.</span>
              <span className="font-medium px-1 text-black">
                {docSnapshot.name || 'Prof. Dr. Rezwanur Rahman'}
              </span>
              <span className="flex-1 border-b border-dotted border-black min-w-[40px]" />
            </div>
            <div className="w-[24%] flex items-baseline ml-3">
              <span className="whitespace-nowrap font-normal">Bed No</span>
              <span className="font-medium px-1 text-black">
                <EditableText
                  editable={editable}
                  value={admissionDetails.bedNo}
                  placeholder="bed no…"
                  fieldKey="bedNo"
                  onCommit={(text) => onFieldChange?.('admissionDetails.bedNo', text)}
                />
              </span>
              <span className="flex-1 border-b border-dotted border-black" />
            </div>
          </div>

          <div className="flex justify-between items-baseline mt-1">
            <div className="flex-1 flex items-baseline">
              <span className="whitespace-nowrap font-normal">Clinical Diagnosis</span>
              <span className="font-medium px-1 text-black italic">
                <EditableText
                  editable={editable}
                  value={requisition.clinicalDiagnosis}
                  placeholder="type diagnosis…"
                  fieldKey="clinicalDiagnosis"
                  onCommit={(text) => onFieldChange?.('clinicalDiagnosis', text)}
                />
              </span>
              <span className="flex-1 border-b border-dotted border-black min-w-[40px]" />
            </div>
            <div className="w-[24%] flex items-baseline ml-3">
              <span className="whitespace-nowrap font-normal">Paing/Non Paying</span>
              <span className="font-medium px-1 text-black">
                <EditableText
                  editable={editable}
                  value={admissionDetails.payingStatus}
                  placeholder="paying / non-paying"
                  fieldKey="payingStatus"
                  onCommit={(text) => onFieldChange?.('admissionDetails.payingStatus', text)}
                />
              </span>
              <span className="flex-1 border-b border-dotted border-black" />
            </div>
          </div>
        </div>

        {/* 3. PLEASE TICK TITLE */}
        <div className="text-[8px] font-bold tracking-wider uppercase mb-0.5 text-black">
          PLEASE TICK
        </div>

        {/* 4. THREE-COLUMN TEST CHECKLIST (Exact layout from the paper form) */}
        <div className="grid grid-cols-3 gap-2.5 text-[7.5px] leading-[1.12]">
          {/* ═══════════ COLUMN 1 ═══════════ */}
          <div className="space-y-1">
            {/* HAEMATOLOGY */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                HAEMATOLOGY
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="CBC_ESR" label="CBC (Including ESR)" selected={selectedCodeSet} />
                <RowBound code="TC_DC_HB_ESR" label="TC. DC. Hb, ESR" selected={selectedCodeSet} />
                <RowBound code="BLOOD_FILM" label="Blood Film" selected={selectedCodeSet} />
                <RowBound code="MP" label="MP" selected={selectedCodeSet} />
                <RowBound code="HCT_MCV_MCHC" label="HCT, MCV, MCHC, MCH" selected={selectedCodeSet} />
                <RowBound code="RETIC_COUNT" label="Reticulocyte count" selected={selectedCodeSet} />
                <RowBound code="TCE" label="TCE" selected={selectedCodeSet} />
                <RowBound code="PLATELET" label="Platelet Count" selected={selectedCodeSet} />
                <RowBound code="BT_CT" label="BT. CT." selected={selectedCodeSet} />
                <RowBound code="PROTHROMBIN" label="Prothrombin TIme" selected={selectedCodeSet} />
                <RowBound code="APTT" label="APTT" selected={selectedCodeSet} />
                <RowBound code="D_DIMER" label="D-Dimer" selected={selectedCodeSet} />
                <RowBound code="FDP" label="FDP" selected={selectedCodeSet} />
              </div>
            </div>

            {/* BIOCHEMISTRY */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                BIOCHEMISTRY
              </div>
              <div className="space-y-[1.5px]">
                <RowBound
                  code="GLUCOSE_CATEGORY"
                  label="GLUCOSE"
                  selected={selectedCodeSet}
                  subRows={[
                    { code: 'GLUCOSE_F', label: 'a) Fasting' },
                    { code: 'GLUCOSE_R', label: 'b) Random/Before Lunch/Dinner' },
                    { code: 'GLUCOSE_2ABF', label: 'c) 2 hrs. ABF./Lunch/Dinner' },
                    { code: 'GLUCOSE_75G', label: 'd) 2 hrs. after 75 gm glucose' },
                    { code: 'GTT', label: 'e) GTT' },
                    { code: 'HBA1C', label: 'f) Hb A1C' },
                  ]}
                />
                <RowBound
                  code="LIPID_CATEGORY"
                  label="LIPID PROFILE"
                  selected={selectedCodeSet}
                  subRows={[
                    { code: 'CHOLESTEROL', label: 'a) Cholesterol' },
                    { code: 'HDL', label: 'b) HDL' },
                    { code: 'LDL', label: 'c) LDL' },
                    { code: 'TRIGLYCERIDE', label: 'd) Triglyceride' },
                  ]}
                />
                <RowBound code="UREA_BUN" label="Urea/BUN" selected={selectedCodeSet} />
                <RowBound code="CREATININE" label="Creatinine" selected={selectedCodeSet} />
                <RowBound code="CCR" label="Creatinine Clearance Rate (CCR)" selected={selectedCodeSet} />
                <RowBound
                  code="BILIRUBIN"
                  label="Bilirubin"
                  subText="Total/Direct/Indirect"
                  selected={selectedCodeSet}
                />
                <RowBound code="AST_SGOT" label="AST (SGOT)" selected={selectedCodeSet} />
                <RowBound code="ALT_SGPT" label="ALT (SGPT)" selected={selectedCodeSet} />
                <RowBound code="ALP" label="Alkaline Phosphatase" selected={selectedCodeSet} />
                <RowBound code="CK" label="CK" selected={selectedCodeSet} />
                <RowBound code="CK_MB" label="CK-MB" selected={selectedCodeSet} />
                <RowBound code="LDH" label="LDH" selected={selectedCodeSet} />
                <RowBound code="AMYLASE" label="Amylase" selected={selectedCodeSet} />
                <RowBound code="LIPASE" label="Lipase" selected={selectedCodeSet} />
                <RowBound code="PROS_ACID_P" label="Prostatic Acid Phosphatase" selected={selectedCodeSet} />
                <RowBound code="TOTAL_PROT" label="S. Total Protein" selected={selectedCodeSet} />
                <RowBound code="ALBUMIN" label="S. Albumin" selected={selectedCodeSet} />
                <RowBound code="AG_RATIO" label="A/G Ratio" selected={selectedCodeSet} />
                <RowBound code="URIC_ACID" label="Uric Acid" selected={selectedCodeSet} />
                <RowBound code="ABG" label="Arterial Blood Gas" selected={selectedCodeSet} />
                <RowBound code="ACR" label="ACR" selected={selectedCodeSet} />
                <RowBound
                  code="ELECTROLYTES"
                  label="S. Electrolytes"
                  subText="a) Na+ (b) K+ (c) Cl- (d) CO2"
                  selected={selectedCodeSet}
                />
              </div>
            </div>
          </div>

          {/* ═══════════ COLUMN 2 ═══════════ */}
          <div className="space-y-1">
            {/* BIOCHEMISTRY CONT. */}
            <div className="space-y-[1.5px]">
              <RowBound code="S_CALCIUM" label="S. Calcium" selected={selectedCodeSet} />
              <RowBound code="TROPONIN_I" label="Troponin I" selected={selectedCodeSet} />
              <RowBound code="V_GF" label="v-GT" selected={selectedCodeSet} />
              <RowBound code="AMMONIA" label="Ammonia" selected={selectedCodeSet} />
              <RowBound code="S_IRON" label="S. Iron" selected={selectedCodeSet} />
              <RowBound code="TIBC" label="TIBC" selected={selectedCodeSet} />
              <RowBound code="FERRITIN" label="S. Ferritin" selected={selectedCodeSet} />
              <RowBound code="MAGNESIUM" label="Magnesium" selected={selectedCodeSet} />
              <RowBound code="INORG_PHOS" label="Inorganic phosphate" selected={selectedCodeSet} />
              <RowBound code="VIT_D3" label="Vitamin D3" selected={selectedCodeSet} />
              <RowBound code="PRO_BNP" label="S.Pro BNP" selected={selectedCodeSet} />
            </div>

            {/* STOOL */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                STOOL
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="STOOL_RE" label="R/E" selected={selectedCodeSet} />
                <RowBound code="STOOL_REDUCE" label="Reducing substance" selected={selectedCodeSet} />
                <RowBound code="OCCULT_BLOOD" label="Occult Blood Test" selected={selectedCodeSet} />
                <RowBound code="FECAL_FAT" label="Fecal For Estimation" selected={selectedCodeSet} />
              </div>
            </div>

            {/* URINE */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                URINE
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="URINE_RE_ME" label="R/E, M/E" selected={selectedCodeSet} />
                <RowBound code="UROBILINOGEN" label="Urobilinogen" selected={selectedCodeSet} />
                <RowBound code="URINE_24H" label="Total Protein in 24 hours" selected={selectedCodeSet} />
                <RowBound code="URINE_KETONES" label="Ketones" selected={selectedCodeSet} />
                <RowBound code="PHASE_CONT" label="Phase Contrast Microscopy" selected={selectedCodeSet} />
              </div>
            </div>

            {/* SKIN / NAIL */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                SKIN / NAIL
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="SKIN_ME" label="a) M/E" selected={selectedCodeSet} />
                <RowBound code="SKIN_FUNGI" label="b) C/S for fungi" selected={selectedCodeSet} />
              </div>
            </div>

            {/* SEMEN ANALYSIS */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                SEMEN ANALYSIS
              </div>
            </div>

            {/* FLUID */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                FLUID
              </div>
              <div className="space-y-[1.5px]">
                <RowBound
                  code="FLUID_NATURE_CATEGORY"
                  label="Nature"
                  selected={selectedCodeSet}
                  subRows={[
                    { code: 'FLUID_CSF', label: 'a) CSF' },
                    { code: 'FLUID_PLEURAL', label: 'b) Pleural fluid' },
                    { code: 'FLUID_PERIT', label: 'c) Peritoneal fluid' },
                    { code: 'FLUID_JOINT', label: 'd) Joint fluid' },
                  ]}
                />
                <RowBound
                  code="FLUID_EXAM_CATEGORY"
                  label="Examination"
                  selected={selectedCodeSet}
                  subRows={[
                    { code: 'FLUID_ME', label: 'a) M/E' },
                    { code: 'FLUID_GRAM', label: 'b) Gram Staining' },
                    { code: 'FLUID_AFB', label: 'c) AFB Staining' },
                    { code: 'FLUID_SUGAR', label: 'd) Sugar' },
                    { code: 'FLUID_PROT', label: 'e) Protein' },
                    { code: 'FLUID_ADA', label: 'f) ADA' },
                    { code: 'FLUID_LDH', label: 'g) LDH' },
                    { code: 'FLUID_POLAR', label: 'h) Polarizing Microscopy' },
                  ]}
                />
              </div>
            </div>

            {/* MICROBIOLOGY */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                MICROBIOLOGY
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="THROAT_CS" label="Throat swab C/S" selected={selectedCodeSet} />
                <RowBound code="THROAT_KLB" label="Throat swab for KLB" selected={selectedCodeSet} />
                <RowBound code="EAR_NOSE_CS" label="Ear, Nose, Eye swab C/S" selected={selectedCodeSet} />
                <RowBound code="ETT_CS" label="ETT Tube C/S" selected={selectedCodeSet} />
                <RowBound code="WOUND_CS" label="Wound Swab C/S" selected={selectedCodeSet} />
                <RowBound code="DRAIN_CS" label="Drain Tube C/S" selected={selectedCodeSet} />
                <RowBound code="NIPPLE_CS" label="Nipple Discharge C/S" selected={selectedCodeSet} />
                <RowBound code="UMBILICAL_CS" label="Umbilical Swab C/S" selected={selectedCodeSet} />
                <RowBound code="TRACHEAL_CS" label="Tracheal asporation C/S" selected={selectedCodeSet} />
                <RowBound code="PUS_CS" label="Pus C/S" selected={selectedCodeSet} />
                <RowBound code="URINE_CS" label="Urine C/S" selected={selectedCodeSet} />
                <RowBound code="BLOOD_CS" label="Blood C/S" selected={selectedCodeSet} />
                <RowBound code="HVS_CS" label="HVS C/S" selected={selectedCodeSet} />
              </div>
            </div>
          </div>

          {/* ═══════════ COLUMN 3 ═══════════ */}
          <div className="space-y-1">
            {/* MICROBIOLOGY CONT. */}
            <div className="space-y-[1.5px]">
              <RowBound
                code="PROSTATIC_CS"
                label="Prostatic smear/"
                subText="a) Gram staining  b) C/S"
                selected={selectedCodeSet}
              />
              <RowBound
                code="SPUTUM_CATEGORY"
                label="Sputum"
                selected={selectedCodeSet}
                subRows={[
                  { code: 'SPUTUM_GRAM', label: 'a) Gram staining' },
                  { code: 'SPUTUM_AFB', label: 'b) AFB Staining' },
                  { code: 'SPUTUM_CS', label: 'c) C/S' },
                ]}
              />
            </div>

            {/* SEROLOGY */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                SEROLOGY
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="PREG_TEST" label="Pregnancy test" selected={selectedCodeSet} />
                <RowBound code="ASO" label="ASO titre" selected={selectedCodeSet} />
                <RowBound code="VDRL" label="VDRL" selected={selectedCodeSet} />
                <RowBound code="WIDAL" label="Widal" selected={selectedCodeSet} />
                <RowBound code="RA_TEST" label="RA test" selected={selectedCodeSet} />
                <RowBound code="HBS_AG_ICT" label="HB s Ag (ICT Method)" selected={selectedCodeSet} />
                <RowBound code="DENGUE_IGG" label="Dengue-IgG" selected={selectedCodeSet} />
                <RowBound code="DENGUE_IGM" label="Dengue-IgM" selected={selectedCodeSet} />
                <RowBound code="CRP" label="C-reactive protein" selected={selectedCodeSet} />
                <RowBound code="TPHA" label="TPHA" selected={selectedCodeSet} />
                <RowBound code="ROSE_WAALER" label="Rose Waaler" selected={selectedCodeSet} />
                <RowBound code="ICT_MALARIA" label="ICT (Malaria)" selected={selectedCodeSet} />
                <RowBound code="DENGUE_NSI" label="Dengue NSI" selected={selectedCodeSet} />
                <RowBound code="FEBRILE_AG" label="Febrile Antigen" selected={selectedCodeSet} />
              </div>
            </div>

            {/* IMMUNOLOGY (2 Mini Columns matching reference photo) */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                IMMUNOLOGY
              </div>
              <div className="grid grid-cols-2 gap-1 text-[7px] leading-tight">
                {/* Left Mini Column */}
                <div className="space-y-[1.5px]">
                  <RowBound code="T3" label="T3" selected={selectedCodeSet} />
                  <RowBound code="T4" label="T4" selected={selectedCodeSet} />
                  <RowBound code="FT3" label="F.T3" selected={selectedCodeSet} />
                  <RowBound code="FT4" label="F. T4" selected={selectedCodeSet} />
                  <RowBound code="TSH" label="TSH" selected={selectedCodeSet} />
                  <RowBound code="ANTI_TPO" label="Anti TPO Ab" selected={selectedCodeSet} />
                  <RowBound code="ANTI_TG" label="Anti TG Ab" selected={selectedCodeSet} />
                  <RowBound code="ANTI_THYROID" label="Anti Thyroid" subText="AB" selected={selectedCodeSet} />
                  <RowBound code="B_HCG" label="B-HCG" selected={selectedCodeSet} />
                  <RowBound code="TESTOSTERONE" label="Testosterone" selected={selectedCodeSet} />
                  <RowBound code="PROGESTERONE" label="Progesterone" selected={selectedCodeSet} />
                  <RowBound code="PROLACTIN" label="Prolactin" selected={selectedCodeSet} />
                  <RowBound code="LH" label="LH" selected={selectedCodeSet} />
                  <RowBound code="FSH" label="FSH" selected={selectedCodeSet} />
                  <RowBound code="IGE" label="IgE" selected={selectedCodeSet} />
                  <RowBound code="HIV" label="HIV ( 1+2)" selected={selectedCodeSet} />
                </div>
                {/* Right Mini Column */}
                <div className="space-y-[1.5px]">
                  <RowBound code="HAV_IGM" label="HAV-IgM" selected={selectedCodeSet} />
                  <RowBound code="HEV_IGM" label="HEV-Igm" selected={selectedCodeSet} />
                  <RowBound code="ANTI_HCV" label="Anti HCV" selected={selectedCodeSet} />
                  <RowBound code="HBS_AG_ELISA" label="HBs Ag (ELISA)" selected={selectedCodeSet} />
                  <RowBound code="ANTI_HBS" label="Anti-HBS" selected={selectedCodeSet} />
                  <RowBound code="HBE_AG" label="HBe-Ag" selected={selectedCodeSet} />
                  <RowBound code="ANA_ANF" label="ANA/ANF" selected={selectedCodeSet} />
                  <RowBound code="FERRITIN_IMMUNO" label="Ferritin" selected={selectedCodeSet} />
                  <RowBound code="H_PYLORI" label="H. pylori-IgG" selected={selectedCodeSet} />
                  <RowBound code="PSA" label="PSA" selected={selectedCodeSet} />
                  <RowBound code="AFP" label="AFP" selected={selectedCodeSet} />
                  <RowBound code="CA_125" label="CA-125" selected={selectedCodeSet} />
                  <RowBound code="CA_19_9" label="CA-19-9" selected={selectedCodeSet} />
                  <RowBound code="CA_15_3" label="CA-15-3" selected={selectedCodeSet} />
                  <RowBound code="CEA" label="CEA" selected={selectedCodeSet} />
                  <RowBound code="TORCH" label="Torch Panels" selected={selectedCodeSet} />
                  <RowBound code="ANTI_CCP" label="Anti CCP" selected={selectedCodeSet} />
                </div>
              </div>
            </div>

            {/* BLOOD TYPING & Rh FACTOR */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px]">
                BLOOD TYPING & Rh FACTOR
              </div>
              <div className="mt-0.5">
                <RowBound code="BLOOD_TYPING" label="Blood Grouping & Rh" selected={selectedCodeSet} />
              </div>
            </div>

            {/* CROSS MATCHING */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px]">
                CROSS MATCHING
              </div>
              <div className="mt-0.5">
                <RowBound code="CROSS_MATCH" label="Cross Matching" selected={selectedCodeSet} />
              </div>
            </div>

            {/* HISTOPATHOLOGY */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                HISTOPATHOLOGY
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="HISTOPATH" label="Biopsy / Histopathology" selected={selectedCodeSet} />
                <div className="flex items-center gap-1 py-[0.5px]">
                  <span className="w-2.5 h-2.5 border border-black inline-block" />
                  <span className="border-b border-dotted border-black flex-1 min-w-[50px]" />
                </div>
                <div className="flex items-center gap-1 py-[0.5px]">
                  <span className="w-2.5 h-2.5 border border-black inline-block" />
                  <span className="border-b border-dotted border-black flex-1 min-w-[50px]" />
                </div>
              </div>
            </div>

            {/* CYTOLOGY */}
            <div>
              <div className="border border-black px-1 py-0.2 inline-block font-bold text-[7.8px] mb-0.5">
                CYTOLOGY
              </div>
              <div className="space-y-[1.5px]">
                <RowBound code="PAP_SMEAR" label="PAP Smear" selected={selectedCodeSet} />
                <RowBound code="MALIG_CELL" label="Malignant cell" selected={selectedCodeSet} />
              </div>
            </div>
          </div>
        </div>

        {/* 5. FOOTER: DATE & DOCTOR'S SIGNATURE (Bottom aligned exactly like the photo) */}
        <div className="absolute bottom-[0.3in] left-[0.3in] right-[0.3in] pt-1">
          <div className="flex justify-between items-end">
            <div className="text-[8.5px] flex items-baseline">
              <span className="font-normal">Date</span>
              <span className="px-1.5 font-medium border-b border-dotted border-black min-w-[130px] inline-block">
                {formatDisplayDate(requisition.createdAt || new Date())}
              </span>
            </div>

            <div className="text-center min-w-[140px]">
              <div className="text-[8.5px] font-medium border-t border-black pt-1">
                Doctor's Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function Row({ code, label, subText, selected, subRows, editable, onToggle }) {
  const isSelfChecked = selected.has(code);
  const isAnySubChecked = subRows?.some((s) => selected.has(s.code));
  const isChecked = isSelfChecked || isAnySubChecked;

  return (
    <div>
      <div
        className={`flex items-start gap-1 py-[0.5px] ${editable ? 'cursor-pointer hover:bg-blue-50/60 print:hover:bg-transparent -mx-0.5 px-0.5 rounded-sm' : ''}`}
        onClick={editable ? () => onToggle(code, label) : undefined}
        role={editable ? 'checkbox' : undefined}
        aria-checked={editable ? isSelfChecked : undefined}
        tabIndex={editable ? 0 : undefined}
        onKeyDown={editable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(code, label); } } : undefined}
      >
        <span
          className={`w-2.5 h-2.5 border border-black flex items-center justify-center text-[7px] shrink-0 leading-none mt-[1px] ${
            isChecked ? 'bg-black text-white font-bold' : 'bg-white text-transparent'
          }`}
        >
          {isChecked ? '✓' : ''}
        </span>
        <span className="leading-tight">
          <span className={isChecked ? 'font-bold' : 'font-normal'}>{label}</span>
          {subText && <span className="block text-[6.8px] text-black leading-none">{subText}</span>}
        </span>
      </div>
      {subRows && (
        <div className="pl-3.5 space-y-[1px] mt-[0.5px]">
          {subRows.map((sr) => {
            const isSubChecked = selected.has(sr.code);
            return (
              <div
                key={sr.code}
                className={`flex items-center gap-1 text-[7px] ${editable ? 'cursor-pointer hover:bg-blue-50/60 print:hover:bg-transparent -mx-0.5 px-0.5 rounded-sm' : ''}`}
                onClick={editable ? () => onToggle(sr.code, sr.label) : undefined}
                role={editable ? 'checkbox' : undefined}
                aria-checked={editable ? isSubChecked : undefined}
                tabIndex={editable ? 0 : undefined}
                onKeyDown={editable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(sr.code, sr.label); } } : undefined}
              >
                <span
                  className={`w-2 h-2 border border-black flex items-center justify-center text-[6px] shrink-0 leading-none ${
                    isSubChecked ? 'bg-black text-white font-bold' : 'bg-white text-transparent'
                  }`}
                >
                  {isSubChecked ? '✓' : ''}
                </span>
                <span className={isSubChecked ? 'font-bold' : 'font-normal'}>{sr.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
