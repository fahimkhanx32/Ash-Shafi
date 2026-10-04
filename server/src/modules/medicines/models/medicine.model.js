import mongoose from 'mongoose';

/**
 * BET-11 — Medicine database (reference data).
 *
 * Master prompt §24: medicine data is reference information, never
 * hardcoded into frontend components, and the system must not
 * autonomously prescribe — a `Medicine` document is something a
 * doctor *selects* when writing a `Prescription` (see
 * `../../prescriptions/models/prescription.model.js`), never
 * something this module acts on by itself.
 *
 * Where a medicine's reference data comes from a bulk import, `source`
 * tracks provenance (§24: "track source, version, import date,
 * country, verification status") — this is deliberately separate from
 * `isActive` (whether it should currently be selectable) so a record
 * can be provisionally imported and later verified without losing the
 * import trail.
 */
export const DOSAGE_FORMS = Object.freeze([
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'SUSPENSION',
  'INJECTION',
  'IV_INFUSION',
  'CREAM',
  'OINTMENT',
  'GEL',
  'DROPS',
  'INHALER',
  'SUPPOSITORY',
  'PESSARY',
  'PATCH',
  'OTHER',
]);

export const ROUTES = Object.freeze([
  'ORAL',
  'TOPICAL',
  'INTRAVENOUS',
  'INTRAMUSCULAR',
  'SUBCUTANEOUS',
  'VAGINAL',
  'RECTAL',
  'INHALATION',
  'OPHTHALMIC',
  'NASAL',
  'OTHER',
]);

export const VERIFICATION_STATUSES = Object.freeze([
  'UNVERIFIED',
  'VERIFIED',
  'NEEDS_REVIEW',
]);

export const MEDICINE_STATUSES = Object.freeze([
  'ACTIVE',
  'DISCONTINUED',
  'SUSPENDED',
  'UNKNOWN',
]);

const sourceSchema = new mongoose.Schema(
  {
    origin: { type: String, trim: true, maxlength: 120, default: 'MANUAL' }, // e.g. "MANUAL", "DGDA import", a named dataset
    version: { type: String, trim: true, maxlength: 60, default: '' },
    importDate: { type: Date, default: null },
    country: { type: String, trim: true, maxlength: 60, default: 'Bangladesh' },
  },
  { _id: false },
);

const medicineSchema = new mongoose.Schema(
  {
    genericName: { type: String, required: true, trim: true, maxlength: 200, index: true },
    brandName: { type: String, trim: true, maxlength: 200, default: '', index: true },
    manufacturer: { type: String, trim: true, maxlength: 200, default: '', index: true },

    // DGDA/DGHS registered-drug integration (item 4 of the writable-Rx
    // scope). `dgdaCode` is the DGDA registration/drug code when the
    // record originates from an official import — sparse+unique so
    // manually-created medicines (no DGDA code) don't collide with each
    // other on `null`, but two imported rows can never silently
    // duplicate the same registration.
    dgdaCode: { type: String, trim: true, maxlength: 60, default: null },
    packSize: { type: String, trim: true, maxlength: 100, default: '' }, // e.g. "10x10 blister", "100 mL bottle"
    status: { type: String, enum: MEDICINE_STATUSES, default: 'UNKNOWN' }, // registration status as reported by the source — distinct from `isActive` (local selectability)
    sourceVersion: { type: String, trim: true, maxlength: 60, default: '' }, // denormalized copy of source.version for fast filtering/indexing
    lastSyncedAt: { type: Date, default: null, index: true },

    // FET-10 gap-closure — master prompt's Medicine checklist lists
    // "Strength" and "Unit" as two separate items; `strength` alone
    // (free text like "500") doesn't carry a unit of measure on its
    // own. Kept as its own free-text field rather than an enum for
    // the same reason `strength` is — units in real-world medicine
    // data are too varied (mg, mcg, IU, mg/mL, %, mEq…) to constrain
    // without rejecting legitimate values. Deliberately separate from
    // `strength` (not just appended to it) so the catalog can filter/
    // display/sort by each independently — e.g. "500" + "mg" rather
    // than a single opaque "500mg" string.
    strength: { type: String, trim: true, maxlength: 60, default: '' }, // e.g. "500" — the numeric/quantity part
    unit: { type: String, trim: true, maxlength: 20, default: '' }, // e.g. "mg", "mL", "IU"
    dosageForm: { type: String, enum: DOSAGE_FORMS, default: 'OTHER' },
    route: { type: String, enum: ROUTES, default: 'ORAL' },

    indications: { type: [String], default: [] },
    contraindications: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    adverseEffects: { type: [String], default: [] },
    interactions: { type: [String], default: [] },
    alternatives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }],

    price: { type: Number, min: 0, default: null },
    currency: { type: String, trim: true, maxlength: 10, default: 'BDT' },

    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'UNVERIFIED' },
    source: { type: sourceSchema, default: () => ({}) },

    notes: { type: String, trim: true, maxlength: 1000, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

medicineSchema.index({ genericName: 'text', brandName: 'text', manufacturer: 'text' });
medicineSchema.index({ genericName: 1, brandName: 1, strength: 1 });
// DGDA import support: sparse+unique so manually-created medicines (no
// DGDA code) never collide with each other on `null`, while two
// imported rows for the same registration always upsert to one document.
medicineSchema.index({ dgdaCode: 1 }, { unique: true, sparse: true });
medicineSchema.index({ strength: 1 });
medicineSchema.index({ dosageForm: 1 });
medicineSchema.index({ sourceVersion: 1 });

export const Medicine = mongoose.model('Medicine', medicineSchema, 'medicines');
