import Joi from 'joi';

import {
  FREQUENCIES,
  FOOD_INSTRUCTIONS,
  DURATION_UNITS,
  CONTINUATIONS,
  MEDICINE_TYPES,
} from '../../prescriptions/models/prescription.model.js';
import { APPOINTMENT_STATUSES } from '../../appointments/models/appointment.model.js';
import { LAB_REQUISITION_PRIORITIES } from '../../investigations/models/lab-requisition.model.js';

const objectId = Joi.string().hex().length(24);

/**
 * ElevenLabs voice-agent tool argument schemas (ElevenLabs integration
 * master prompt §11–§16, §46).
 *
 * One schema per tool, keyed by tool name exactly as it appears in
 * `tools/tool-registry.js` and in the ElevenLabs agent's own tool
 * definitions. Deliberately narrow and reusing the *real* schema
 * enums (`FREQUENCIES`/`FOOD_INSTRUCTIONS`/`DURATION_UNITS` from
 * `prescription.model.js`) rather than inventing a parallel set the
 * agent could send values the underlying `Prescription` document
 * would then reject — master prompt §14 ("do not invent field
 * names") and §30 ("never invent medicines or tests") apply equally
 * to the *shape* of a tool's arguments, not just their content.
 *
 * `confirmed` appears only on the tools the registry marks HIGH risk
 * (see `tools/tool-registry.js`) — the agent is expected to omit it
 * (or send `false`) on its first call, receive
 * `requiresConfirmation: true` back, relay that to the doctor in
 * speech, and only resend the same call with `confirmed: true` after
 * an explicit verbal yes (master prompt §20, §28, §42).
 */
export const voiceToolSchemas = {
  // --- Patient tools ---
  search_patient: Joi.object({
    query: Joi.string().trim().min(1).max(200).required(),
    limit: Joi.number().integer().min(1).max(10).default(5),
  }),

  get_patient_summary: Joi.object({
    patientProfileId: objectId.required(),
  }),

  // --- Prescription tools ---
  create_prescription: Joi.object({
    patientProfileId: objectId.required(),
  }),

  get_current_prescription: Joi.object({
    prescriptionId: objectId.required(),
  }),

  add_medicine_to_prescription: Joi.object({
    prescriptionId: objectId.required(),
    // Resolved via `search_medicine` first (master prompt §13) — the
    // agent is never expected to free-type a medicine name here.
    medicineId: objectId.required(),
    medicineType: Joi.string().valid(...MEDICINE_TYPES),
    dosage: Joi.string().trim().max(100),
    frequency: Joi.string().valid(...FREQUENCIES),
    foodInstruction: Joi.string().valid(...FOOD_INSTRUCTIONS),
    durationValue: Joi.string().trim().max(60),
    durationUnit: Joi.string().valid(...DURATION_UNITS),
    continuation: Joi.string().valid(...CONTINUATIONS),
    specialInstruction: Joi.string().trim().max(500).allow(''),
  }),

  // Changes dosage fields on a medicine ALREADY on the prescription — the
  // "one tablet twice daily after food for seven days" step that follows
  // "add Napa 500". At least one field must be supplied; nothing is
  // defaulted here (a dosage the doctor didn't say is never invented).
  update_medicine_on_prescription: Joi.object({
    prescriptionId: objectId.required(),
    itemId: objectId.required(),
    dosage: Joi.string().trim().max(100),
    frequency: Joi.string().valid(...FREQUENCIES),
    foodInstruction: Joi.string().valid(...FOOD_INSTRUCTIONS),
    durationValue: Joi.string().trim().max(60),
    durationUnit: Joi.string().valid(...DURATION_UNITS),
    continuation: Joi.string().valid(...CONTINUATIONS),
    specialInstruction: Joi.string().trim().max(500).allow(''),
  }).or('dosage', 'frequency', 'foodInstruction', 'durationValue', 'durationUnit', 'continuation', 'specialInstruction'),

  remove_investigation_from_prescription: Joi.object({
    prescriptionId: objectId.required(),
    investigationId: objectId.required(),
  }),

  apply_invoice_discount: Joi.object({
    invoiceId: objectId.required(),
    itemId: objectId.required(),
    discountAmount: Joi.number().min(0).required(),
    confirmed: Joi.boolean().default(false),
  }),

  // checkpoint 18 — feeId (never a free-text description/price) is
  // resolved server-side against the fee catalog, same rule
  // create_invoice already follows (master prompt §40: never invent
  // the amount).
  add_invoice_item: Joi.object({
    invoiceId: objectId.required(),
    feeId: objectId.required(),
    quantity: Joi.number().integer().min(1).default(1),
    confirmed: Joi.boolean().default(false),
  }),

  remove_invoice_item: Joi.object({
    invoiceId: objectId.required(),
    itemId: objectId.required(),
    confirmed: Joi.boolean().default(false),
  }),

  cancel_invoice: Joi.object({
    invoiceId: objectId.required(),
    reason: Joi.string().trim().min(3).max(300).required(),
    confirmed: Joi.boolean().default(false),
  }),

  refund_payment: Joi.object({
    paymentId: objectId.required(),
    amount: Joi.number().positive().required(),
    reason: Joi.string().trim().min(3).max(300).required(),
    confirmed: Joi.boolean().default(false),
  }),

  update_lab_requisition: Joi.object({
    requisitionId: objectId.required(),
    testCodes: Joi.array().items(Joi.string().trim().max(60)).min(1).max(30),
    priority: Joi.string().valid(...LAB_REQUISITION_PRIORITIES),
    clinicalDiagnosis: Joi.string().trim().max(400).allow(''),
  }).or('testCodes', 'priority', 'clinicalDiagnosis'),

  remove_medicine_from_prescription: Joi.object({
    prescriptionId: objectId.required(),
    itemId: objectId.required(),
  }),

  add_investigation_to_prescription: Joi.object({
    prescriptionId: objectId.required(),
    // Resolved via `search_investigation` first, same reasoning as
    // `add_medicine_to_prescription`'s `medicineId`.
    testCode: Joi.string().trim().max(60).required(),
    notes: Joi.string().trim().max(400).allow(''),
  }),

  add_diagnosis_to_prescription: Joi.object({
    prescriptionId: objectId.required(),
    name: Joi.string().trim().min(1).max(300).required(),
    type: Joi.string().trim().max(60),
  }),

  update_vitals: Joi.object({
    prescriptionId: objectId.required(),
    bloodPressureSystolic: Joi.number().min(0).max(400),
    bloodPressureDiastolic: Joi.number().min(0).max(300),
    pulse: Joi.number().min(0).max(300),
    weightKg: Joi.number().min(0).max(500),
    heightCm: Joi.number().min(0).max(300),
    temperatureF: Joi.number().min(0).max(120),
    spo2: Joi.number().min(0).max(100),
  }).min(2), // prescriptionId + at least one actual vital

  add_advice: Joi.object({
    prescriptionId: objectId.required(),
    text: Joi.string().trim().min(1).max(600).required(),
  }),

  // --- Clinical notes / follow-up (added after auditing the schema
  // against master prompt §12/§18/§39 — `chiefComplaint` etc. and
  // `followUpDate` are real Prescription fields the phase-1 tool set
  // had missed entirely). Field names match the schema and
  // `ClinicalNotesEditor.jsx`'s own `form.<field>` keys exactly — no
  // new field names invented.
  add_clinical_note: Joi.object({
    prescriptionId: objectId.required(),
    field: Joi.string()
      .valid(
        'chiefComplaint',
        'coMorbidities',
        'pastHistory',
        'personalHistory',
        'smokingHistory',
        'menstrualHistory',
        'drugHistory',
      )
      .required(),
    text: Joi.string().trim().min(1).max(2000).required(),
  }),

  update_clinical_note: Joi.object({
    prescriptionId: objectId.required(),
    field: Joi.string()
      .valid(
        'chiefComplaint',
        'coMorbidities',
        'pastHistory',
        'personalHistory',
        'smokingHistory',
        'menstrualHistory',
        'drugHistory',
      )
      .required(),
    text: Joi.string().trim().max(2000).allow(''), // '' clears the field, matching the free-text editor
  }),

  set_follow_up: Joi.object({
    prescriptionId: objectId.required(),
    // ISO date string — the agent is responsible for resolving "in a
    // week" / "after 5 days" into a concrete date, same division of
    // labor as duration/frequency parsing for medicines (§14).
    date: Joi.string().isoDate().required(),
  }),

  finalize_prescription: Joi.object({
    prescriptionId: objectId.required(),
    confirmed: Joi.boolean().default(false),
  }),

  // Read-back only — see `savePrescriptionTool`.
  save_prescription: Joi.object({
    prescriptionId: objectId.required(),
  }),

  cancel_prescription: Joi.object({
    prescriptionId: objectId.required(),
    reason: Joi.string().trim().max(300).allow(''),
    confirmed: Joi.boolean().default(false),
  }),

  generate_prescription_pdf: Joi.object({
    prescriptionId: objectId.required(),
  }),

  // --- Appointment tools (master prompt §21). Times are ISO strings;
  // the agent resolves "tomorrow at 5 PM" into a concrete ISO
  // timestamp, and the real `assertSlotIsBookable` decides whether
  // that is an actual open slot — never this schema. ---
  search_appointments: Joi.object({
    patientProfileId: objectId,
    doctorId: objectId,
    status: Joi.string().valid(...APPOINTMENT_STATUSES),
    from: Joi.string().isoDate(),
    to: Joi.string().isoDate(),
    limit: Joi.number().integer().min(1).max(20).default(10),
  }),

  get_available_slots: Joi.object({
    doctorId: objectId.required(),
    date: Joi.string().isoDate().required(),
  }),

  book_appointment: Joi.object({
    patientProfileId: objectId.required(),
    doctorId: objectId.required(),
    scheduledStart: Joi.string().isoDate().required(),
    reasonForVisit: Joi.string().trim().max(500).allow(''),
  }),

  confirm_appointment: Joi.object({
    appointmentId: objectId.required(),
  }),

  reschedule_appointment: Joi.object({
    appointmentId: objectId.required(),
    scheduledStart: Joi.string().isoDate().required(),
    reason: Joi.string().trim().max(300).allow(''),
  }),

  cancel_appointment: Joi.object({
    appointmentId: objectId.required(),
    reason: Joi.string().trim().max(300).allow(''),
    confirmed: Joi.boolean().default(false),
  }),

  // --- Billing tools (master prompt §19/§20/§40). The agent NEVER
  // supplies a price: invoice lines reference a catalog `feeId` +
  // quantity and the price is read from the Fee record server-side
  // ("never invent the amount"). Refund, discount and invoice
  // cancellation are deliberately not exposed by voice at all. ---
  search_fee: Joi.object({
    query: Joi.string().trim().min(1).max(100).required(),
    limit: Joi.number().integer().min(1).max(10).default(5),
  }),

  get_invoice: Joi.object({
    invoiceId: objectId.required(),
  }),

  get_outstanding_balance: Joi.object({
    patientProfileId: objectId.required(),
  }),

  get_lab_requisition: Joi.object({
    requisitionId: objectId.required(),
  }),

  create_invoice: Joi.object({
    patientProfileId: objectId.required(),
    items: Joi.array()
      .items(
        Joi.object({
          feeId: objectId.required(),
          quantity: Joi.number().integer().min(1).max(20).default(1),
        }),
      )
      .min(1)
      .max(15)
      .required(),
    confirmed: Joi.boolean().default(false),
  }),

  record_payment: Joi.object({
    invoiceId: objectId.required(),
    amount: Joi.number().positive().required(),
    method: Joi.string().valid('CASH', 'BANK_TRANSFER').required(),
    confirmed: Joi.boolean().default(false),
  }),

  // --- Lab requisition tools (master prompt §15/§41). Tests are chosen
  // by catalog `testCode` (resolved via `search_investigation`); name,
  // category and cost always come from TEST_CATALOG, never the agent.
  // Registered patients only — no walk-in creation by voice, since
  // that would silently create user accounts. Creating makes a DRAFT;
  // issuing and cancelling are HIGH risk. ---
  create_lab_requisition: Joi.object({
    patientProfileId: objectId.required(),
    testCodes: Joi.array().items(Joi.string().trim().max(60)).min(1).max(20).unique().required(),
    priority: Joi.string().valid(...LAB_REQUISITION_PRIORITIES),
    clinicalDiagnosis: Joi.string().trim().max(500).allow(''),
    prescriptionId: objectId,
  }),

  issue_lab_requisition: Joi.object({
    requisitionId: objectId.required(),
    confirmed: Joi.boolean().default(false),
  }),

  cancel_lab_requisition: Joi.object({
    requisitionId: objectId.required(),
    reason: Joi.string().trim().max(300).allow(''),
    confirmed: Joi.boolean().default(false),
  }),

  // --- Medicine / investigation search (read-only, resolve ambiguity) ---
  search_medicine: Joi.object({
    query: Joi.string().trim().min(1).max(200).required(),
    limit: Joi.number().integer().min(1).max(10).default(5),
  }),

  search_investigation: Joi.object({
    query: Joi.string().trim().min(1).max(200).required(),
    limit: Joi.number().integer().min(1).max(10).default(5),
  }),

  // --- Assistant persona (naming/personalization master prompt) ---
  get_assistant_profile: Joi.object({}),

  set_assistant_name: Joi.object({
    name: Joi.string()
      .trim()
      .min(1)
      .max(50)
      .pattern(/^[^\x00-\x1F\x7F<>]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Assistant name contains characters that are not allowed.',
      }),
  }),
};

// Prescription-scoped tools may carry the patient the doctor has open. When
// present, the executor's guard refuses a prescription that belongs to
// someone else (master prompt §10). Optional: omitted = no extra check, the
// real service-level authorization still applies either way.
export const PRESCRIPTION_SCOPED_TOOLS = Object.freeze([
  'get_current_prescription',
  'add_medicine_to_prescription',
  'update_medicine_on_prescription',
  'remove_medicine_from_prescription',
  'remove_investigation_from_prescription',
  'add_investigation_to_prescription',
  'add_diagnosis_to_prescription',
  'update_vitals',
  'add_advice',
  'add_clinical_note',
  'update_clinical_note',
  'set_follow_up',
  'finalize_prescription',
  'save_prescription',
  'cancel_prescription',
  'generate_prescription_pdf',
]);
PRESCRIPTION_SCOPED_TOOLS.forEach((name) => {
  voiceToolSchemas[name] = voiceToolSchemas[name].keys({ patientProfileId: objectId });
});

/**
 * Same pattern as `PRESCRIPTION_SCOPED_TOOLS` (checkpoint 16 — extends
 * the ownership guard past prescriptions, to billing and lab
 * requisitions). Accepting `patientProfileId` here doesn't do anything
 * by itself — it only lets the tool-registry `guard` for each of these
 * (`invoicePatientGuard`, `paymentPatientGuard`, `labRequisitionPatientGuard`
 * in `tool-registry.js`) compare it against the resource's real owner.
 */
export const INVOICE_SCOPED_TOOLS = Object.freeze([
  'get_invoice',
  'record_payment',
  'apply_invoice_discount',
  'add_invoice_item',
  'remove_invoice_item',
  'cancel_invoice',
]);
export const PAYMENT_SCOPED_TOOLS = Object.freeze(['refund_payment']);
export const LAB_REQUISITION_SCOPED_TOOLS = Object.freeze([
  'get_lab_requisition',
  'update_lab_requisition',
  'issue_lab_requisition',
  'cancel_lab_requisition',
]);
[...INVOICE_SCOPED_TOOLS, ...PAYMENT_SCOPED_TOOLS, ...LAB_REQUISITION_SCOPED_TOOLS].forEach((name) => {
  voiceToolSchemas[name] = voiceToolSchemas[name].keys({ patientProfileId: objectId });
});

const FREQUENCY_MAP = {
  '1+0+0': '1 + 0 + 0',
  '1-0-0': '1 + 0 + 0',
  '1 0 0': '1 + 0 + 0',
  '0+1+0': '0 + 1 + 0',
  '0-1-0': '0 + 1 + 0',
  '0+0+1': '0 + 0 + 1',
  '0-0-1': '0 + 0 + 1',
  '1+1+1': '1 + 1 + 1',
  '1-1-1': '1 + 1 + 1',
  '1 1 1': '1 + 1 + 1',
  '1+0+1': '1 + 0 + 1',
  '1-0-1': '1 + 0 + 1',
  '1 0 1': '1 + 0 + 1',
  '1+1+0': '1 + 1 + 0',
  '1-1-0': '1 + 1 + 0',
  '0+1+1': '0 + 1 + 1',
  '0-1-1': '0 + 1 + 1',
  '1+1+1+1': '1 + 1 + 1 + 1',
  '1-1-1-1': '1 + 1 + 1 + 1',
  'once daily': 'ONCE_DAILY',
  'once a day': 'ONCE_DAILY',
  'od': 'ONCE_DAILY',
  'twice daily': 'TWICE_DAILY',
  'twice a day': 'TWICE_DAILY',
  'bid': 'TWICE_DAILY',
  'b.i.d.': 'TWICE_DAILY',
  'bd': 'TWICE_DAILY',
  'three times daily': 'THREE_TIMES_DAILY',
  'three times a day': 'THREE_TIMES_DAILY',
  'tid': 'THREE_TIMES_DAILY',
  't.i.d.': 'THREE_TIMES_DAILY',
  'four times daily': 'FOUR_TIMES_DAILY',
  'four times a day': 'FOUR_TIMES_DAILY',
  'qid': 'FOUR_TIMES_DAILY',
  'q.i.d.': 'FOUR_TIMES_DAILY',
  'every other day': 'EVERY_OTHER_DAY',
  'qod': 'EVERY_OTHER_DAY',
  'weekly': 'WEEKLY',
  'as needed': 'AS_NEEDED',
  'prn': 'AS_NEEDED',
};

const FOOD_MAP = {
  'after meal': 'After Meal',
  'after meals': 'After Meal',
  'after food': 'After Meal',
  'before meal': 'Before Meal',
  'before meals': 'Before Meal',
  'before food': 'Before Meal',
  'with food': 'With Food',
  'with meals': 'With Food',
  'empty stomach': 'Empty Stomach',
  'anytime': 'Anytime',
  'খাবার পর': 'খাবার পরে',
  'খাবার পরে': 'খাবার পরে',
  'খাবার আগে': 'খাবার আগে',
  'খাবারের সাথে': 'খাবারের সাথে',
  'খালি পেটে': 'খালি পেটে',
  'যেকোনো সময়': 'যেকোনো সময়',
};

const DURATION_UNIT_MAP = {
  'day': 'Days',
  'days': 'Days',
  'week': 'Weeks',
  'weeks': 'Weeks',
  'month': 'Months',
  'months': 'Months',
  'year': 'Years',
  'years': 'Years',
  'continuous': 'Continuous',
  'চলবে': 'Continuous',
};

const CLINICAL_NOTE_FIELD_MAP = {
  'chief_complaint': 'chiefComplaint',
  'chief_complaints': 'chiefComplaint',
  'chief complaint': 'chiefComplaint',
  'chief complaints': 'chiefComplaint',
  'comorbidities': 'coMorbidities',
  'co_morbidities': 'coMorbidities',
  'co-morbidities': 'coMorbidities',
  'past_history': 'pastHistory',
  'past history': 'pastHistory',
  'personal_history': 'personalHistory',
  'personal history': 'personalHistory',
  'smoking_history': 'smokingHistory',
  'smoking history': 'smokingHistory',
  'menstrual_history': 'menstrualHistory',
  'menstrual history': 'menstrualHistory',
  'drug_history': 'drugHistory',
  'drug history': 'drugHistory',
};

export const validateToolArgs = (toolName, args) => {
  const schema = voiceToolSchemas[toolName];
  if (!schema) {
    return { error: `Unknown tool "${toolName}".` };
  }

  const normalized = { ...(args || {}) };
  if (toolName === 'add_medicine_to_prescription' || toolName === 'update_medicine_on_prescription') {
    if (typeof normalized.frequency === 'string') {
      const key = normalized.frequency.trim().toLowerCase();
      if (FREQUENCY_MAP[key]) normalized.frequency = FREQUENCY_MAP[key];
    }
    if (typeof normalized.foodInstruction === 'string') {
      const key = normalized.foodInstruction.trim().toLowerCase();
      if (FOOD_MAP[key]) normalized.foodInstruction = FOOD_MAP[key];
    }
    if (typeof normalized.durationUnit === 'string') {
      const key = normalized.durationUnit.trim().toLowerCase();
      if (DURATION_UNIT_MAP[key]) normalized.durationUnit = DURATION_UNIT_MAP[key];
    }
  }

  if (toolName === 'add_clinical_note' || toolName === 'update_clinical_note') {
    if (typeof normalized.field === 'string') {
      const key = normalized.field.trim().toLowerCase();
      if (CLINICAL_NOTE_FIELD_MAP[key]) normalized.field = CLINICAL_NOTE_FIELD_MAP[key];
    }
  }

  const { error, value } = schema.validate(normalized, { abortEarly: false, stripUnknown: true });
  if (error) {
    return { error: error.details.map((d) => d.message).join('; ') };
  }
  return { value };
};
