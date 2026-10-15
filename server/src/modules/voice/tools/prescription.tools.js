import {
  createPrescription,
  getPrescriptionById,
  updatePrescription,
  finalizePrescription as finalizePrescriptionService,
  cancelPrescription as cancelPrescriptionService,
} from '../../prescriptions/services/prescription.service.js';
import { getMedicineById } from '../../medicines/services/medicine.service.js';
import { TEST_CATALOG } from '../../investigations/models/test-catalog.js';
import { AppError } from '../../../middlewares/error.middleware.js';

const asPlain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {});

const summarizePrescription = (p) => ({
  prescriptionId: String(p._id),
  humanId: p.prescriptionId,
  status: p.status,
  patientName: p.patientSnapshot?.name || '',
  itemCount: (p.items || []).length,
  investigationCount: (p.investigations || []).length,
  diagnoses: (p.diagnoses || []).map((d) => d.name),
});

/**
 * `create_prescription` — master prompt §39 ("Start a new
 * prescription."). Thin call to the real service — snapshotting,
 * ID generation, and the initial `DRAFT_CREATED` audit-log entry all
 * already happen inside `createPrescription` itself, so this tool
 * does not repeat any of that.
 */
export const createPrescriptionTool = async ({ patientProfileId }, actor) => {
  const prescription = await createPrescription(patientProfileId, {}, actor);
  return {
    success: true,
    action: 'create_prescription',
    message: `New prescription started for ${prescription.patientSnapshot?.name || 'the patient'}.`,
    prescription: summarizePrescription(prescription),
  };
};

export const getCurrentPrescriptionTool = async ({ prescriptionId }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  return {
    success: true,
    action: 'get_current_prescription',
    message: `Prescription for ${prescription.patientSnapshot?.name || 'the patient'}: ${
      (prescription.items || []).length
    } medicine(s), ${(prescription.investigations || []).length} test(s).`,
    prescription: summarizePrescription(prescription),
  };
};

/**
 * `add_medicine_to_prescription` — master prompt §12–§14.
 *
 * `medicineId` must already be resolved (via `search_medicine`) to a
 * single real `Medicine` document — this tool never accepts a free-
 * typed name. Dosage/frequency/food-instruction/duration are the
 * agent's own structured parse of the doctor's natural language
 * (master prompt §14); this tool only validates them against the
 * schema's real enums (`voice.validation.js`) and never re-parses
 * free text itself.
 */
// Clinically meaningful dosing fields. If the doctor didn't say one, it
// is left blank (never fabricated — master prompt §15/§29) and the
// medicine is added anyway, so "Add Napa 500" then a later "one tablet
// twice daily..." (→ update_medicine_on_prescription) both keep working.
// `foodInstruction` and `continuation` are dosing decisions too, so they
// get the same treatment rather than a silent "after food" / "continuing".
const DOSING_FIELDS = ['dosage', 'frequency', 'durationValue', 'durationUnit', 'foodInstruction', 'continuation'];
const ASK_LABEL = {
  dosage: 'the dose',
  frequency: 'how often',
  durationValue: 'how long',
  durationUnit: null, // only asked about alongside durationValue
  foodInstruction: 'before or after food',
  continuation: null, // secondary; not worth its own question
};

export const addMedicineToPrescriptionTool = async (args, actor) => {
  const { prescriptionId, medicineId, ...dosageFields } = args;
  const medicine = await getMedicineById(medicineId);
  const prescription = await getPrescriptionById(prescriptionId, actor);

  const existingItems = asPlain(prescription).items || [];
  const given = Object.fromEntries(
    DOSING_FIELDS.map((key) => [key, typeof dosageFields[key] === 'string' && dosageFields[key].trim() ? dosageFields[key].trim() : '']),
  );
  const newItem = {
    medicineRef: medicine._id,
    medicineType: dosageFields.medicineType || 'Tablet',
    brandName: medicine.brandName || '',
    medicineName: medicine.brandName || medicine.genericName,
    genericName: medicine.genericName,
    strength: medicine.strength || '',
    strengthUnit: medicine.unit || '',
    dosageForm: medicine.dosageForm || '',
    route: medicine.route || '',
    ...given, // explicit '' for anything not given — overrides the model's own defaults, never invents a value
    specialInstruction: dosageFields.specialInstruction || '',
    displayOrder: existingItems.length + 1,
  };

  const updated = await updatePrescription(prescriptionId, { items: [...existingItems, newItem] }, actor);
  const addedName = newItem.brandName || newItem.genericName;

  const missing = ['dosage', 'frequency', 'durationValue', 'foodInstruction'].filter((key) => !given[key]);
  const questions = missing.map((key) => ASK_LABEL[key]).filter(Boolean);
  const message =
    questions.length > 0
      ? `${addedName} ${newItem.strength}${newItem.strengthUnit} has been added. What's ${questions.join(', ')}?`
      : `${addedName} ${newItem.strength}${newItem.strengthUnit} has been added.`;

  return {
    success: true,
    action: 'add_medicine_to_prescription',
    message,
    missingDosageFields: missing.length > 0 ? missing : undefined,
    // Read back from the saved doc — subdocuments only get their _id on save.
    itemId: String(asPlain(updated).items?.slice(-1)[0]?._id ?? ''),
    prescription: summarizePrescription(updated),
  };
};

/**
 * `update_medicine_on_prescription` — dosage instructions for a medicine
 * already on the draft ("one tablet twice daily after food for seven
 * days"). Only the fields the doctor actually gave are changed; the
 * medicine identity (brand/generic/strength) is never touched, and no
 * value is defaulted or invented here. The real `updatePrescription`
 * still enforces draft-only editing.
 */
export const updateMedicineOnPrescriptionTool = async ({ prescriptionId, itemId, ...changes }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const items = asPlain(prescription).items || [];
  const target = items.find((i) => String(i._id) === String(itemId));
  if (!target) {
    throw new AppError('That medicine is not on this prescription.', 404, { code: 'ITEM_NOT_FOUND' });
  }
  const applied = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
  const nextItems = items.map((i) => (String(i._id) === String(itemId) ? { ...i, ...applied } : i));
  const updated = await updatePrescription(prescriptionId, { items: nextItems }, actor);

  return {
    success: true,
    action: 'update_medicine_on_prescription',
    message: `Updated ${target.brandName || target.genericName}: ${Object.keys(applied).join(', ')}.`,
    updatedFields: Object.keys(applied),
    prescription: summarizePrescription(updated),
  };
};

export const removeMedicineFromPrescriptionTool = async ({ prescriptionId, itemId }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const items = asPlain(prescription).items || [];
  const target = items.find((i) => String(i._id) === String(itemId));
  if (!target) {
    throw new AppError('That medicine is not on this prescription.', 404, { code: 'ITEM_NOT_FOUND' });
  }
  const remaining = items.filter((i) => String(i._id) !== String(itemId));
  const updated = await updatePrescription(prescriptionId, { items: remaining }, actor);

  return {
    success: true,
    action: 'remove_medicine_from_prescription',
    message: `${target.brandName || target.genericName} has been removed.`,
    prescription: summarizePrescription(updated),
  };
};

/**
 * `add_investigation_to_prescription` — master prompt §15/§30.
 * `testCode` resolved via `search_investigation`; cost/category always
 * come from `TEST_CATALOG`, never from the agent, so a hallucinated
 * price can never end up on the prescription.
 */
export const addInvestigationToPrescriptionTool = async ({ prescriptionId, testCode, notes = '' }, actor) => {
  const target = String(testCode || '').trim();
  const catalogEntry = TEST_CATALOG.find(
    (t) =>
      t.code === target ||
      t.code.toLowerCase() === target.toLowerCase() ||
      t.code.replace(/_/g, ' ').toLowerCase() === target.toLowerCase() ||
      t.name.toLowerCase() === target.toLowerCase() ||
      t.name.toLowerCase().startsWith(target.toLowerCase()),
  );
  if (!catalogEntry) {
    throw new AppError('That test was not found in the catalog.', 404, { code: 'TEST_NOT_FOUND' });
  }

  const prescription = await getPrescriptionById(prescriptionId, actor);
  const existing = asPlain(prescription).investigations || [];
  const newInvestigation = {
    testName: catalogEntry.name,
    category: catalogEntry.category,
    cost: catalogEntry.costBDT,
    currency: 'BDT',
    notes,
    isCustom: false,
    displayOrder: existing.length + 1,
  };

  const updated = await updatePrescription(
    prescriptionId,
    { investigations: [...existing, newInvestigation] },
    actor,
  );

  return {
    success: true,
    action: 'add_investigation_to_prescription',
    message: `${catalogEntry.name} has been added.`,
    prescription: summarizePrescription(updated),
  };
};

export const addDiagnosisToPrescriptionTool = async ({ prescriptionId, name, type = 'PRIMARY' }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const existing = asPlain(prescription).diagnoses || [];
  const newDiagnosis = { name, type, isCustom: true, displayOrder: existing.length + 1 };
  const updated = await updatePrescription(
    prescriptionId,
    { diagnoses: [...existing, newDiagnosis] },
    actor,
  );

  return {
    success: true,
    action: 'add_diagnosis_to_prescription',
    message: `Diagnosis "${name}" added.`,
    prescription: summarizePrescription(updated),
  };
};

/**
 * `update_vitals` — master prompt §16/§17.
 *
 * Merges only the fields the doctor actually spoke into the existing
 * `vitals` subdocument rather than replacing it wholesale — a
 * shallow `Object.assign(prescription, { vitals })` inside
 * `updatePrescription` would otherwise silently wipe out any vital
 * already recorded earlier in the same encounter. BMI is
 * deliberately not computed here: `Prescription`'s own
 * `pre('validate')` hook already recomputes it from
 * `vitals.weight`/`vitals.height` on every save (master prompt §17:
 * "if Ash-Shāfī already calculates BMI, reuse that functionality").
 */
export const updateVitalsTool = async (args, actor) => {
  const { prescriptionId, bloodPressureSystolic, bloodPressureDiastolic, pulse, weightKg, heightCm, temperatureF, spo2 } =
    args;
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const existing = asPlain(prescription).vitals || {};
  const now = new Date();

  const vitals = { ...existing };
  if (bloodPressureSystolic != null || bloodPressureDiastolic != null) {
    vitals.bloodPressure = {
      ...(existing.bloodPressure || {}),
      ...(bloodPressureSystolic != null ? { systolic: bloodPressureSystolic } : {}),
      ...(bloodPressureDiastolic != null ? { diastolic: bloodPressureDiastolic } : {}),
      recordedAt: now,
    };
  }
  if (pulse != null) vitals.pulse = { ...(existing.pulse || {}), value: pulse, recordedAt: now };
  if (weightKg != null) vitals.weight = { ...(existing.weight || {}), value: weightKg, recordedAt: now };
  if (heightCm != null) vitals.height = { ...(existing.height || {}), value: heightCm, recordedAt: now };
  if (temperatureF != null) vitals.temperature = { ...(existing.temperature || {}), value: temperatureF, recordedAt: now };
  if (spo2 != null) vitals.spo2 = { ...(existing.spo2 || {}), value: spo2, recordedAt: now };

  const updated = await updatePrescription(prescriptionId, { vitals }, actor);
  const recordedBits = [];
  if (bloodPressureSystolic != null) recordedBits.push(`BP ${bloodPressureSystolic}/${bloodPressureDiastolic ?? '?'}`);
  if (pulse != null) recordedBits.push(`pulse ${pulse}`);
  if (temperatureF != null) recordedBits.push(`temp ${temperatureF}°F`);
  if (weightKg != null) recordedBits.push(`weight ${weightKg}kg`);
  if (heightCm != null) recordedBits.push(`height ${heightCm}cm`);
  if (spo2 != null) recordedBits.push(`SpO2 ${spo2}%`);

  return {
    success: true,
    action: 'update_vitals',
    message: `Recorded ${recordedBits.join(', ')}.`,
    vitals: asPlain(updated).vitals,
  };
};

export const addAdviceTool = async ({ prescriptionId, text }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const existing = asPlain(prescription).advice || [];
  const updated = await updatePrescription(
    prescriptionId,
    { advice: [...existing, { text, displayOrder: existing.length + 1 }] },
    actor,
  );
  return {
    success: true,
    action: 'add_advice',
    message: 'Advice added.',
    prescription: summarizePrescription(updated),
  };
};

const CLINICAL_NOTE_LABELS = {
  chiefComplaint: 'chief complaint',
  coMorbidities: 'co-morbidities',
  pastHistory: 'past history',
  personalHistory: 'personal history',
  smokingHistory: 'smoking history',
  menstrualHistory: 'menstrual history',
  drugHistory: 'drug history',
};

/**
 * `add_clinical_note` / `update_clinical_note` — master prompt §12,
 * §18 (dictation mode), §39 acceptance test ("Chief complaint: fever
 * for three days" → "Added."). One handler, two tool names in the
 * registry with different `mode` defaults: `add_clinical_note`
 * appends (so several turns of dictation accumulate rather than each
 * overwriting the last), `update_clinical_note` replaces outright
 * (including clearing the field with an empty string, matching what
 * the free-text `ClinicalNotesEditor.jsx` textarea itself allows).
 * `field` is exactly one of the seven real scalar fields on
 * `Prescription` — no new clinical-note schema invented.
 */
export const upsertClinicalNoteTool = async ({ prescriptionId, field, text }, actor, mode) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const existingValue = asPlain(prescription)[field] || '';
  const nextValue = mode === 'append' && existingValue ? `${existingValue} ${text}`.trim() : text;

  const updated = await updatePrescription(prescriptionId, { [field]: nextValue }, actor);
  const label = CLINICAL_NOTE_LABELS[field] || field;

  return {
    success: true,
    action: mode === 'append' ? 'add_clinical_note' : 'update_clinical_note',
    message: mode === 'append' ? `Added to ${label}.` : `Updated ${label}.`,
    prescription: summarizePrescription(updated),
  };
};

export const addClinicalNoteTool = (args, actor) => upsertClinicalNoteTool(args, actor, 'append');
export const updateClinicalNoteTool = (args, actor) => upsertClinicalNoteTool(args, actor, 'replace');

/**
 * `set_follow_up` — master prompt §12.
 *
 * Deliberately writes only `followUpDate`, not the also-present
 * `nextFollowUp` subdocument: the real prescription form
 * (`PrescriptionFormDialog.jsx`) only ever reads/writes
 * `followUpDate` — `nextFollowUp` isn't wired to any current UI field
 * — so this tool matches the field the app actually uses rather than
 * the one that merely exists on the schema (master prompt §14: don't
 * invent field usage the rest of the app doesn't already have).
 */
export const setFollowUpTool = async ({ prescriptionId, date }, actor) => {
  const updated = await updatePrescription(prescriptionId, { followUpDate: date }, actor);
  return {
    success: true,
    action: 'set_follow_up',
    message: `Follow-up set for ${new Date(date).toDateString()}.`,
    prescription: summarizePrescription(updated),
  };
};

/**
 * `finalize_prescription` — master prompt §20/§28/§42, HIGH risk.
 * The registry (`tool-registry.js`) already blocks execution unless
 * `confirmed: true` is present, so by the time this function runs the
 * doctor has already said yes; this just calls the real
 * `finalizePrescription` service, which itself enforces the
 * DRAFT/PENDING_REVIEW → FINALIZED status-machine rules.
 */
export const finalizePrescriptionTool = async ({ prescriptionId }, actor) => {
  const prescription = await finalizePrescriptionService(prescriptionId, actor);
  return {
    success: true,
    action: 'finalize_prescription',
    message: 'Prescription finalized.',
    prescription: summarizePrescription(prescription),
  };
};

/**
 * `generate_prescription_pdf` — master prompt §12.
 * Confirms the prescription exists/is accessible, then hands back the
 * *existing* `GET /prescriptions/:id/pdf` route rather than
 * generating a PDF a second, different way — `prescription-pdf.
 * service.js#generatePrescriptionPdf` streams straight to an Express
 * `res`, which isn't representable as this tool's JSON return value,
 * so the client tool layer opens this URL instead of the agent
 * carrying PDF bytes through the conversation.
 */
export const generatePrescriptionPdfTool = async ({ prescriptionId }, actor) => {
  await getPrescriptionById(prescriptionId, actor);
  return {
    success: true,
    action: 'generate_prescription_pdf',
    message: 'The prescription PDF is ready.',
    pdfUrl: `/api/v1/prescriptions/${prescriptionId}/pdf`,
  };
};

/**
 * `save_prescription` — READ-BACK ONLY, and deliberately so.
 *
 * In this codebase every draft edit (`updatePrescription`) is already
 * written to the database and audit-logged the moment it is made;
 * there is no separate "save" step to perform. Fabricating a write here
 * would be a fake success (master prompt §72). So this tool re-reads the
 * stored prescription and reports what is *actually* persisted, and
 * whether it is still an unfinalized draft.
 */
export const savePrescriptionTool = async ({ prescriptionId }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const summary = summarizePrescription(prescription);
  const p = asPlain(prescription);

  if (summary.status === 'CANCELLED') {
    return {
      success: false,
      action: 'save_prescription',
      message: 'That prescription is cancelled, so there is nothing to save.',
      prescription: summary,
    };
  }

  const empty = [];
  if (!summary.itemCount) empty.push('medicines');
  if (!summary.diagnoses.length) empty.push('diagnosis');
  if (!(p.advice || []).length) empty.push('advice');

  const stored = `${summary.itemCount} medicine(s), ${summary.investigationCount} test(s), ${summary.diagnoses.length} diagnosis`;
  const message =
    summary.status === 'FINALIZED'
      ? `It is already finalized and stored: ${stored}.`
      : `It is stored as a draft with ${stored}. Every change is saved as it is made; it is not finalized yet.`;

  return { success: true, action: 'save_prescription', message, emptySections: empty, prescription: summary };
};

export const previewCancelPrescription = async ({ prescriptionId }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const summary = summarizePrescription(prescription);
  if (summary.status === 'CANCELLED') {
    throw new AppError('That prescription is already cancelled.', 409, { code: 'ALREADY_CANCELLED' });
  }
  return {
    message: `Cancel the ${summary.status.toLowerCase()} prescription for ${summary.patientName || 'the patient'} (${summary.itemCount} medicine(s))? Shall I go ahead?`,
    preview: summary,
  };
};

export const cancelPrescriptionTool = async ({ prescriptionId, reason = '' }, actor) => {
  const prescription = await cancelPrescriptionService(prescriptionId, reason, actor);
  return {
    success: true,
    action: 'cancel_prescription',
    message: 'The prescription has been cancelled.',
    prescription: summarizePrescription(prescription),
  };
};

/**
 * Guard for every prescription-scoped tool: if the call names the patient
 * currently open, the prescription must belong to that patient. Uses the
 * real `getPrescriptionById` (so its own access rules apply first).
 */
export const prescriptionPatientGuard = async ({ prescriptionId, patientProfileId }, actor) => {
  if (!patientProfileId) return;
  const p = asPlain(await getPrescriptionById(prescriptionId, actor));
  const owner = String(p.patientProfile?._id ?? p.patientProfile ?? '');
  if (owner !== String(patientProfileId)) {
    throw new AppError(
      'That prescription belongs to a different patient than the one that is open, so I have not touched it.',
      409,
      { code: 'PRESCRIPTION_PATIENT_MISMATCH' },
    );
  }
};

/** Removes one investigation, matched by its real item id (never by a guessed name). */
export const removeInvestigationFromPrescriptionTool = async ({ prescriptionId, investigationId }, actor) => {
  const prescription = await getPrescriptionById(prescriptionId, actor);
  const list = asPlain(prescription).investigations || [];
  const target = list.find((i) => String(i._id) === String(investigationId));
  if (!target) {
    throw new AppError('That test is not on this prescription.', 404, { code: 'INVESTIGATION_NOT_FOUND' });
  }
  const remaining = list.filter((i) => String(i._id) !== String(investigationId));
  const updated = await updatePrescription(prescriptionId, { investigations: remaining }, actor);
  return {
    success: true,
    action: 'remove_investigation_from_prescription',
    message: `${target.testName} has been removed.`,
    prescription: summarizePrescription(updated),
  };
};
