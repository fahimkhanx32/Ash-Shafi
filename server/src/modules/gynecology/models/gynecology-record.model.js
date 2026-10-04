import mongoose from 'mongoose';

/**
 * BET-07 — Gynecology & Sensitive Clinical Records.
 *
 * A `GynecologyRecord` holds reproductive/sexual-health data that is
 * deliberately kept separate from the general medical history on
 * `PatientProfile` (BET-06) — it is gated on the separate
 * `SENSITIVE_RECORDS_READ`/`SENSITIVE_RECORDS_WRITE` permissions
 * (`security/permissions.js`, BET-04), which are granted to a
 * narrower set of roles (`SOFTWARE_OWNER`, `SUPER_ADMIN`, `DIRECTOR`,
 * `DOCTOR`) than `MEDICAL_RECORDS_*`. See
 * `modules/gynecology/services/sensitive-record-access.service.js`
 * for the additional "provider-based access" restriction applied on
 * top of that permission check.
 *
 * One `PatientProfile` has at most one `GynecologyRecord` (enforced
 * by the unique index below), mirroring the one-to-one shape already
 * established between `User` and `PatientProfile`/`StaffProfile`.
 *
 * Deliberately excluded from this model (out of scope for BET-07,
 * reserved for BET-08 — Obstetric & Pregnancy Records): LMP, EDD,
 * gestational age, antenatal/delivery/postpartum records, and any
 * per-pregnancy detail. `reproductiveHistory` below is a
 * *summary-level* gravida/para-style count only — the kind of
 * shorthand routinely captured during a gynecological history intake
 * — not a substitute for BET-08's detailed pregnancy records.
 *
 * `sexualHistory` (below) intentionally never overlaps with
 * `contraceptionHistory` (birth-control method/current use) or
 * `stiHistory` (diagnosed infections) — it is the master-prompt
 * §16-required record of sexual activity/partner history/practices/
 * exposure/protection use, kept as its own embedded object so it
 * carries the exact same `SENSITIVE_RECORDS_READ`/`WRITE` gate as
 * every other field on this document, never a looser one.
 */

// ---------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------

const menstrualHistorySchema = new mongoose.Schema(
  {
    menarcheAge: {
      type: Number,
      min: 0,
      max: 30,
      default: null,
    },
    cycleLengthDays: {
      type: Number,
      min: 0,
      max: 120,
      default: null,
    },
    periodDurationDays: {
      type: Number,
      min: 0,
      max: 30,
      default: null,
    },
    cycleRegularity: {
      type: String,
      enum: ['REGULAR', 'IRREGULAR', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    flow: {
      type: String,
      enum: ['LIGHT', 'MODERATE', 'HEAVY', 'VARIABLE', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    dysmenorrhea: {
      type: Boolean,
      default: false,
    },
    menopauseStatus: {
      type: String,
      enum: ['PREMENOPAUSAL', 'PERIMENOPAUSAL', 'POSTMENOPAUSAL', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    menopauseAge: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: false },
);

// Summary-level obstetric shorthand (gravida/para-style counts) —
// see the model-level docstring above for why this is a summary and
// not a duplicate of BET-08's detailed pregnancy records.
const reproductiveHistorySchema = new mongoose.Schema(
  {
    totalPregnancies: {
      type: Number,
      min: 0,
      max: 50,
      default: null,
    },
    totalLiveBirths: {
      type: Number,
      min: 0,
      max: 50,
      default: null,
    },
    totalMiscarriages: {
      type: Number,
      min: 0,
      max: 50,
      default: null,
    },
    totalTerminations: {
      type: Number,
      min: 0,
      max: 50,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: false },
);

const fertilityInfertilitySchema = new mongoose.Schema(
  {
    fertilityStatus: {
      type: String,
      enum: ['TRYING_TO_CONCEIVE', 'NOT_TRYING', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    monthsTrying: {
      type: Number,
      min: 0,
      max: 600,
      default: null,
    },
    hasInfertilityHistory: {
      type: Boolean,
      default: false,
    },
    infertilityDiagnosedCause: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    treatmentsTried: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: false },
);

// Sexual history — master prompt section 16 requires this as its
// own structured, clinically-appropriate field set ("sexual history,
// number of partners, ... relevant sexual practices, sexual exposure
// history, protection/condom use") separate from contraception
// (birth-control *method*, above) and from STI/STD diagnoses
// (`stiHistorySchema`, below). Embedded single-object field, updated
// through the same generic `PATCH /gynecology/:id` path as
// `menstrualHistory`/`reproductiveHistory`/`fertilityInfertility` —
// gated on the same `SENSITIVE_RECORDS_READ`/`WRITE` permission as
// the rest of this document (no separate, laxer access path for this
// field — master prompt section 16's "restrict access" requirement
// applies to it exactly as strictly as everything else here).
const sexualHistorySchema = new mongoose.Schema(
  {
    isSexuallyActive: {
      type: String,
      enum: ['YES', 'NO', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    ageAtFirstIntercourse: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    numberOfLifetimePartners: {
      type: Number,
      min: 0,
      max: 999,
      default: null,
    },
    numberOfPartnersLast12Months: {
      type: Number,
      min: 0,
      max: 999,
      default: null,
    },
    partnerHistoryNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    // Free-text rather than a closed enum list — clinically relevant
    // practices vary too widely per patient to force into a fixed
    // set (master prompt section 16: "support relevant fields for
    // sexual practices without forcing inappropriate categorization").
    relevantSexualPractices: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    exposureHistory: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    condomOrProtectionUse: {
      type: String,
      enum: ['ALWAYS', 'USUALLY', 'SOMETIMES', 'NEVER', 'NOT_APPLICABLE', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    protectionMethods: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: false },
);

const gynecologicalConditionSchema = new mongoose.Schema(
  {
    condition: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    diagnosedDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'MANAGED', 'RESOLVED', 'CHRONIC'],
      default: 'ACTIVE',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

const contraceptionSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isCurrent: {
      type: Boolean,
      default: true,
    },
    sideEffects: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

const stiHistorySchema = new mongoose.Schema(
  {
    infection: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    diagnosedDate: {
      type: Date,
      default: null,
    },
    treated: {
      type: Boolean,
      default: false,
    },
    treatmentDetails: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

const cervicalScreeningSchema = new mongoose.Schema(
  {
    screeningType: {
      type: String,
      enum: ['PAP_SMEAR', 'HPV_TEST', 'COLPOSCOPY', 'BIOPSY', 'OTHER'],
      required: true,
    },
    date: {
      type: Date,
      default: null,
    },
    result: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    nextDueDate: {
      type: Date,
      default: null,
    },
    provider: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

const breastRecordSchema = new mongoose.Schema(
  {
    examType: {
      type: String,
      enum: ['SELF_EXAM', 'CLINICAL_EXAM', 'MAMMOGRAM', 'ULTRASOUND', 'BIOPSY', 'OTHER'],
      required: true,
    },
    date: {
      type: Date,
      default: null,
    },
    findings: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    result: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

const gynecologicalProcedureSchema = new mongoose.Schema(
  {
    procedure: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    date: {
      type: Date,
      default: null,
    },
    provider: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    hospital: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    findings: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

// ---------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------

const gynecologyRecordSchema = new mongoose.Schema(
  {
    patientProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: true,
      unique: true,
    },

    // Denormalized copy of `PatientProfile.user` so a self-access
    // lookup (`GET /gynecology/me`) is a single indexed query rather
    // than a join through `PatientProfile` on every request. Kept in
    // sync only at creation time — `PatientProfile.user` is itself
    // immutable after creation (BET-06 never updates it), so this
    // cannot drift.
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    menstrualHistory: {
      type: menstrualHistorySchema,
      default: () => ({}),
    },

    reproductiveHistory: {
      type: reproductiveHistorySchema,
      default: () => ({}),
    },

    gynecologicalConditions: {
      type: [gynecologicalConditionSchema],
      default: [],
    },

    contraceptionHistory: {
      type: [contraceptionSchema],
      default: [],
    },

    fertilityInfertility: {
      type: fertilityInfertilitySchema,
      default: () => ({}),
    },

    sexualHistory: {
      type: sexualHistorySchema,
      default: () => ({}),
    },

    stiHistory: {
      type: [stiHistorySchema],
      default: [],
    },

    cervicalScreenings: {
      type: [cervicalScreeningSchema],
      default: [],
    },

    breastRecords: {
      type: [breastRecordSchema],
      default: [],
    },

    procedures: {
      type: [gynecologicalProcedureSchema],
      default: [],
    },

    clinicalNotes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);


gynecologyRecordSchema.set('toJSON', { virtuals: true });
gynecologyRecordSchema.set('toObject', { virtuals: true });

export const GynecologyRecord = mongoose.model(
  'GynecologyRecord',
  gynecologyRecordSchema,
  'gynecology_records',
);
