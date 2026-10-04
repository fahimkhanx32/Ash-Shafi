import mongoose from 'mongoose';

/**
 * BET-08 — Obstetric & Pregnancy Records.
 *
 * Unlike `GynecologyRecord` (BET-07, one-per-patient), a
 * `PregnancyRecord` is one-per-pregnancy — a `PatientProfile` may have
 * several over time, each with its own lifecycle. Gated on the same
 * `SENSITIVE_RECORDS_READ`/`SENSITIVE_RECORDS_WRITE` permissions and
 * the same provider-based access rule as BET-07, reusing
 * `modules/gynecology/services/sensitive-record-access.service.js`
 * (already resource-parameterized, not gynecology-specific) rather
 * than duplicating that logic.
 */

const antenatalVisitSchema = new mongoose.Schema(
  {
    visitDate: { type: Date, required: true },
    gestationalAgeWeeks: { type: Number, min: 0, max: 45, default: null },
    weightKg: { type: Number, min: 0, max: 300, default: null },
    bloodPressure: { type: String, trim: true, maxlength: 20, default: '' },
    fundalHeightCm: { type: Number, min: 0, max: 60, default: null },
    fetalHeartRateBpm: { type: Number, min: 0, max: 300, default: null },
    findings: { type: String, trim: true, maxlength: 1000, default: '' },
    complications: { type: String, trim: true, maxlength: 1000, default: '' },
    nextVisitDate: { type: Date, default: null },
    provider: { type: String, trim: true, maxlength: 150, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: true, timestamps: true },
);

const fetalObservationSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    gestationalAgeWeeks: { type: Number, min: 0, max: 45, default: null },
    method: {
      type: String,
      enum: ['ULTRASOUND', 'DOPPLER', 'NST', 'OTHER'],
      default: 'ULTRASOUND',
    },
    estimatedFetalWeightGrams: { type: Number, min: 0, max: 8000, default: null },
    presentation: {
      type: String,
      enum: ['CEPHALIC', 'BREECH', 'TRANSVERSE', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    findings: { type: String, trim: true, maxlength: 1000, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: true, timestamps: true },
);

const pregnancyComplicationSchema = new mongoose.Schema(
  {
    complication: { type: String, required: true, trim: true, maxlength: 300 },
    diagnosedDate: { type: Date, default: null },
    severity: {
      type: String,
      enum: ['MILD', 'MODERATE', 'SEVERE', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'MANAGED', 'RESOLVED'],
      default: 'ACTIVE',
    },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: true, timestamps: true },
);

const deliverySchema = new mongoose.Schema(
  {
    date: { type: Date, default: null },
    type: {
      type: String,
      enum: ['VAGINAL', 'ASSISTED_VAGINAL', 'C_SECTION', 'UNKNOWN'],
      default: null,
    },
    location: { type: String, trim: true, maxlength: 200, default: '' },
    provider: { type: String, trim: true, maxlength: 150, default: '' },
    outcome: {
      type: String,
      enum: ['LIVE_BIRTH', 'STILLBIRTH', 'NEONATAL_DEATH', 'UNKNOWN'],
      default: null,
    },
    babyWeightGrams: { type: Number, min: 0, max: 8000, default: null },
    babyGender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'UNKNOWN'],
      default: null,
    },
    apgarScore1Min: { type: Number, min: 0, max: 10, default: null },
    apgarScore5Min: { type: Number, min: 0, max: 10, default: null },
    complications: { type: String, trim: true, maxlength: 1000, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false },
);

const postpartumSchema = new mongoose.Schema(
  {
    checkupDate: { type: Date, default: null },
    findings: { type: String, trim: true, maxlength: 1000, default: '' },
    complications: { type: String, trim: true, maxlength: 1000, default: '' },
    contraceptionPlan: { type: String, trim: true, maxlength: 500, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false },
);

const pregnancyRecordSchema = new mongoose.Schema(
  {
    patientProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: true,
      index: true,
    },

    // Denormalized, same reasoning as `GynecologyRecord.patient` (BET-07).
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'DELIVERED', 'MISCARRIAGE', 'ECTOPIC', 'TERMINATED', 'STILLBIRTH'],
      default: 'ACTIVE',
      index: true,
    },

    // Summary-level shorthand at the time this pregnancy was booked —
    // distinct from `GynecologyRecord.reproductiveHistory`'s lifetime
    // totals.
    gravida: { type: Number, min: 0, max: 50, default: null },
    para: { type: Number, min: 0, max: 50, default: null },

    lmp: { type: Date, default: null },
    edd: { type: Date, default: null },
    gestationalAgeAtBookingWeeks: { type: Number, min: 0, max: 45, default: null },

    isMultiplePregnancy: { type: Boolean, default: false },
    fetusCount: { type: Number, min: 1, max: 10, default: 1 },

    antenatalVisits: { type: [antenatalVisitSchema], default: [] },
    fetalObservations: { type: [fetalObservationSchema], default: [] },
    complications: { type: [pregnancyComplicationSchema], default: [] },

    delivery: { type: deliverySchema, default: () => ({}) },
    postpartum: { type: postpartumSchema, default: () => ({}) },

    clinicalNotes: { type: String, trim: true, maxlength: 5000, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

pregnancyRecordSchema.index({ patient: 1, status: 1 });
pregnancyRecordSchema.index({ patientProfile: 1, createdAt: -1 });

pregnancyRecordSchema.set('toJSON', { virtuals: true });
pregnancyRecordSchema.set('toObject', { virtuals: true });

export const PregnancyRecord = mongoose.model(
  'PregnancyRecord',
  pregnancyRecordSchema,
  'pregnancy_records',
);
