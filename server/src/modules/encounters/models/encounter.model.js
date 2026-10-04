import mongoose from 'mongoose';

/**
 * BET-09 — Consultation & Clinical Encounters.
 *
 * One `Encounter` = one consultation: chief complaint, examination,
 * diagnosis, treatment plan, follow-up. Deliberately distinct from
 * `GynecologyRecord`/`PregnancyRecord` (BET-07/08) — those are
 * longitudinal history; an `Encounter` is a single dated visit, and a
 * patient accumulates many over time (`encounter history`, per the
 * roadmap).
 *
 * `relatedInvestigations`/`relatedPrescriptions` are forward-looking
 * refs to modules that don't exist yet (BET-11 Prescription, BET-12
 * Investigation) — present so a consultation can link out to them the
 * day those modules ship, without a schema migration. They are never
 * populated by this module and stay empty until then; storing an
 * unresolvable ref is safe in Mongoose (population is opt-in), unlike
 * pretending the linked data exists.
 *
 * Master prompt §21/§50: a finalized encounter is not silently
 * editable — see `status`/`amendments` and `encounter.service.js`'s
 * `amendEncounter`. A doctor correcting a finalized note gets a new
 * amendment entry, not a rewritten history.
 */
export const ENCOUNTER_STATUSES = Object.freeze(['DRAFT', 'FINALIZED']);

const vitalsSchema = new mongoose.Schema(
  {
    bloodPressureSystolic: { type: Number, min: 0, max: 300, default: null },
    bloodPressureDiastolic: { type: Number, min: 0, max: 200, default: null },
    pulseBpm: { type: Number, min: 0, max: 300, default: null },
    temperatureCelsius: { type: Number, min: 25, max: 45, default: null },
    weightKg: { type: Number, min: 0, max: 400, default: null },
    heightCm: { type: Number, min: 0, max: 250, default: null },
    respiratoryRate: { type: Number, min: 0, max: 100, default: null },
    oxygenSaturationPercent: { type: Number, min: 0, max: 100, default: null },
  },
  { _id: false },
);

const diagnosisSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 300 },
    code: { type: String, trim: true, maxlength: 30, default: '' }, // free-text ICD-style code, not validated against a code system yet
    type: { type: String, enum: ['PRIMARY', 'SECONDARY'], default: 'PRIMARY' },
  },
  { _id: true },
);

const followUpSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    date: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false },
);

const amendmentSchema = new mongoose.Schema(
  {
    amendedAt: { type: Date, default: Date.now },
    amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    // Snapshot of the clinical fields as they stood immediately before
    // this amendment, so the pre-correction record is never lost.
    previousSnapshot: {
      chiefComplaint: String,
      examinationFindings: String,
      vitals: vitalsSchema,
      diagnoses: [diagnosisSchema],
      clinicalFindings: String,
      assessment: String,
      treatmentPlan: String,
      instructions: String,
      followUp: followUpSchema,
    },
  },
  { _id: true },
);

const encounterSchema = new mongoose.Schema(
  {
    patientProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Forward-looking only — Appointment doesn't exist yet (BET-10).
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },

    status: { type: String, enum: ENCOUNTER_STATUSES, default: 'DRAFT', index: true },
    encounterDate: { type: Date, default: Date.now, index: true },

    chiefComplaint: { type: String, trim: true, maxlength: 1000, default: '' },
    examinationFindings: { type: String, trim: true, maxlength: 2000, default: '' },
    vitals: { type: vitalsSchema, default: () => ({}) },
    diagnoses: { type: [diagnosisSchema], default: [] },
    clinicalFindings: { type: String, trim: true, maxlength: 2000, default: '' },
    assessment: { type: String, trim: true, maxlength: 2000, default: '' },
    treatmentPlan: { type: String, trim: true, maxlength: 2000, default: '' },
    instructions: { type: String, trim: true, maxlength: 1000, default: '' },
    followUp: { type: followUpSchema, default: () => ({}) },

    relatedInvestigations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Investigation' }],
    relatedPrescriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' }],

    amendments: { type: [amendmentSchema], default: [] },

    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

encounterSchema.index({ patientProfile: 1, encounterDate: -1 });
encounterSchema.index({ provider: 1, encounterDate: -1 });

export const Encounter = mongoose.model('Encounter', encounterSchema, 'encounters');
