import Joi from 'joi';

/**
 * BET-07 — Gynecology & Sensitive Clinical Records validators.
 * Mirrors the shape/conventions of
 * `modules/patients/validators/patient.validation.js` (BET-06).
 */

const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'Invalid identifier.' });

const idParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const gynecologyRecordIdParamSchema = idParamSchema;

export const patientProfileIdParamSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
});

export const itemIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
  itemId: mongoIdSchema.required(),
});

// --- Embedded single-object fields ---

const menstrualHistorySchema = Joi.object({
  menarcheAge: Joi.number().integer().min(0).max(30).allow(null),
  cycleLengthDays: Joi.number().integer().min(0).max(120).allow(null),
  periodDurationDays: Joi.number().integer().min(0).max(30).allow(null),
  cycleRegularity: Joi.string().valid('REGULAR', 'IRREGULAR', 'UNKNOWN'),
  flow: Joi.string().valid('LIGHT', 'MODERATE', 'HEAVY', 'VARIABLE', 'UNKNOWN'),
  dysmenorrhea: Joi.boolean(),
  menopauseStatus: Joi.string().valid(
    'PREMENOPAUSAL',
    'PERIMENOPAUSAL',
    'POSTMENOPAUSAL',
    'UNKNOWN',
  ),
  menopauseAge: Joi.number().integer().min(0).max(100).allow(null),
  notes: Joi.string().trim().max(1000).allow(''),
});

const reproductiveHistorySchema = Joi.object({
  totalPregnancies: Joi.number().integer().min(0).max(50).allow(null),
  totalLiveBirths: Joi.number().integer().min(0).max(50).allow(null),
  totalMiscarriages: Joi.number().integer().min(0).max(50).allow(null),
  totalTerminations: Joi.number().integer().min(0).max(50).allow(null),
  notes: Joi.string().trim().max(1000).allow(''),
});

const fertilityInfertilitySchema = Joi.object({
  fertilityStatus: Joi.string().valid('TRYING_TO_CONCEIVE', 'NOT_TRYING', 'UNKNOWN'),
  monthsTrying: Joi.number().integer().min(0).max(600).allow(null),
  hasInfertilityHistory: Joi.boolean(),
  infertilityDiagnosedCause: Joi.string().trim().max(500).allow(''),
  treatmentsTried: Joi.array().items(Joi.string().trim().max(200)),
  notes: Joi.string().trim().max(1000).allow(''),
});

// Mirrors `sexualHistorySchema` in `models/gynecology-record.model.js`
// — see that file's docstring for why this is its own field rather
// than folded into contraception or STI history.
const sexualHistorySchema = Joi.object({
  isSexuallyActive: Joi.string().valid('YES', 'NO', 'UNKNOWN'),
  ageAtFirstIntercourse: Joi.number().integer().min(0).max(100).allow(null),
  numberOfLifetimePartners: Joi.number().integer().min(0).max(999).allow(null),
  numberOfPartnersLast12Months: Joi.number().integer().min(0).max(999).allow(null),
  partnerHistoryNotes: Joi.string().trim().max(1000).allow(''),
  relevantSexualPractices: Joi.string().trim().max(1000).allow(''),
  exposureHistory: Joi.string().trim().max(1000).allow(''),
  condomOrProtectionUse: Joi.string().valid(
    'ALWAYS',
    'USUALLY',
    'SOMETIMES',
    'NEVER',
    'NOT_APPLICABLE',
    'UNKNOWN',
  ),
  protectionMethods: Joi.array().items(Joi.string().trim().max(100)),
  notes: Joi.string().trim().max(1000).allow(''),
});

// --- Create / update the record itself ---

export const createGynecologyRecordSchema = Joi.object({
  patientProfileId: mongoIdSchema.required(),
  menstrualHistory: menstrualHistorySchema,
  reproductiveHistory: reproductiveHistorySchema,
  fertilityInfertility: fertilityInfertilitySchema,
  sexualHistory: sexualHistorySchema,
  clinicalNotes: Joi.string().trim().max(5000).allow(''),
});

export const updateGynecologyRecordSchema = Joi.object({
  menstrualHistory: menstrualHistorySchema,
  reproductiveHistory: reproductiveHistorySchema,
  fertilityInfertility: fertilityInfertilitySchema,
  sexualHistory: sexualHistorySchema,
  clinicalNotes: Joi.string().trim().max(5000).allow(''),
}).min(1);

// --- Gynecological conditions ---

export const addGynecologicalConditionSchema = Joi.object({
  condition: Joi.string().trim().min(1).max(200).required(),
  diagnosedDate: Joi.date().iso().allow(null),
  status: Joi.string().valid('ACTIVE', 'MANAGED', 'RESOLVED', 'CHRONIC'),
  notes: Joi.string().trim().max(1000).allow(''),
});

export const updateGynecologicalConditionSchema = addGynecologicalConditionSchema
  .fork(['condition'], (s) => s.optional())
  .min(1);

// --- Contraception ---

export const addContraceptionSchema = Joi.object({
  method: Joi.string().trim().min(1).max(150).required(),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().allow(null),
  isCurrent: Joi.boolean(),
  sideEffects: Joi.string().trim().max(500).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});

export const updateContraceptionSchema = addContraceptionSchema
  .fork(['method'], (s) => s.optional())
  .min(1);

// --- STI / STD history ---

export const addStiHistorySchema = Joi.object({
  infection: Joi.string().trim().min(1).max(200).required(),
  diagnosedDate: Joi.date().iso().allow(null),
  treated: Joi.boolean(),
  treatmentDetails: Joi.string().trim().max(1000).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});

export const updateStiHistorySchema = addStiHistorySchema
  .fork(['infection'], (s) => s.optional())
  .min(1);

// --- Cervical screenings ---

export const addCervicalScreeningSchema = Joi.object({
  screeningType: Joi.string()
    .valid('PAP_SMEAR', 'HPV_TEST', 'COLPOSCOPY', 'BIOPSY', 'OTHER')
    .required(),
  date: Joi.date().iso().allow(null),
  result: Joi.string().trim().max(500).allow(''),
  nextDueDate: Joi.date().iso().allow(null),
  provider: Joi.string().trim().max(150).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});

export const updateCervicalScreeningSchema = addCervicalScreeningSchema
  .fork(['screeningType'], (s) => s.optional())
  .min(1);

// --- Breast records ---

export const addBreastRecordSchema = Joi.object({
  examType: Joi.string()
    .valid('SELF_EXAM', 'CLINICAL_EXAM', 'MAMMOGRAM', 'ULTRASOUND', 'BIOPSY', 'OTHER')
    .required(),
  date: Joi.date().iso().allow(null),
  findings: Joi.string().trim().max(1000).allow(''),
  result: Joi.string().trim().max(500).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});

export const updateBreastRecordSchema = addBreastRecordSchema
  .fork(['examType'], (s) => s.optional())
  .min(1);

// --- Gynecological procedures ---

export const addProcedureSchema = Joi.object({
  procedure: Joi.string().trim().min(1).max(300).required(),
  date: Joi.date().iso().allow(null),
  provider: Joi.string().trim().max(150).allow(''),
  hospital: Joi.string().trim().max(200).allow(''),
  findings: Joi.string().trim().max(1000).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});

export const updateProcedureSchema = addProcedureSchema
  .fork(['procedure'], (s) => s.optional())
  .min(1);
