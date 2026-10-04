import mongoose from 'mongoose';

/**
 * BET-06 — Patient & Medical History.
 *
 * A `PatientProfile` is deliberately kept separate from `User`
 * (`users/user.model.js`, BET-03). `User` remains the single
 * authentication/authorization identity (email, password, RBAC
 * `role`, account `status`) and must not be duplicated here. This
 * collection instead holds the patient-specific demographics, emergency
 * contact, preferences, and the complete medical history.
 *
 * One `User` has at most one `PatientProfile` (enforced by the unique
 * index below). Only `PATIENT` role accounts get a `PatientProfile` —
 * enforced in `patient.service.js`, not here, since that check needs
 * to read the referenced `User` document.
 *
 * Medical history is intentionally stored within the patient profile
 * for this general medical history (allergies, conditions, surgeries,
 * medications, family history, social history). Sensitive reproductive/
 * sexual health data (BET-07) will be stored separately with additional
 * access controls per master prompt section 16.
 */

export const PATIENT_GENDERS = Object.freeze([
  'MALE',
  'FEMALE',
  'OTHER',
  'PREFER_NOT_TO_SAY',
]);

export const PATIENT_BLOOD_GROUPS = Object.freeze([
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'UNKNOWN',
]);

export const PATIENT_STATUSES = Object.freeze([
  'ACTIVE',
  'INACTIVE',
  'DECEASED',
]);

// Medical history sub-schemas
const allergySchema = new mongoose.Schema(
  {
    allergen: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    reaction: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    severity: {
      type: String,
      enum: ['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'],
      default: 'MODERATE',
    },
    diagnosedDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true, timestamps: true },
);

const chronicConditionSchema = new mongoose.Schema(
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
    treatment: {
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true, timestamps: true },
);

const surgeryHistorySchema = new mongoose.Schema(
  {
    procedure: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    surgeryDate: {
      type: Date,
      default: null,
    },
    hospital: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    surgeon: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    complications: {
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

const medicationHistorySchema = new mongoose.Schema(
  {
    medicationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    dosage: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    frequency: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    prescribedBy: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    reason: {
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
    isCurrent: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true, timestamps: true },
);

const familyHistorySchema = new mongoose.Schema(
  {
    relationship: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    condition: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    ageOfOnset: {
      type: Number,
      min: 0,
      max: 150,
      default: null,
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

/**
 * Structured smoking history — deliberately separate from the pre-existing
 * free-text `smokingDetails` below rather than replacing it, so existing
 * records/consumers of that field are untouched. `packYears` is derived
 * (never entered directly): (cigarettesPerDay / 20) * yearsSmoked, the
 * standard clinical pack-year formula. Recomputed on every save via the
 * `socialHistorySchema` pre-validate hook further down this file.
 */
const smokingHistorySchema = new mongoose.Schema(
  {
    cigarettesPerDay: { type: Number, min: 0, max: 200, default: null },
    yearsSmoked: { type: Number, min: 0, max: 100, default: null },
    startDate: { type: Date, default: null },
    quitDate: { type: Date, default: null },
    packYears: { type: Number, min: 0, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false },
);

const socialHistorySchema = new mongoose.Schema(
  {
    // Never / Former / Current / Unknown
    smokingStatus: {
      type: String,
      enum: ['NEVER', 'FORMER', 'CURRENT', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    smokingDetails: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    smoking: { type: smokingHistorySchema, default: () => ({}) },
    alcoholUse: {
      type: String,
      enum: ['NEVER', 'OCCASIONAL', 'MODERATE', 'HEAVY', 'FORMER', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    alcoholDetails: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    exerciseFrequency: {
      type: String,
      enum: ['NONE', 'RARELY', 'WEEKLY', 'DAILY', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    dietaryRestrictions: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    occupation: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    maritalStatus: {
      type: String,
      enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'OTHER', 'UNKNOWN'],
      default: 'UNKNOWN',
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

socialHistorySchema.pre('validate', function computePackYears(next) {
  const smoking = this.smoking;
  if (smoking && (smoking.cigarettesPerDay || smoking.yearsSmoked)) {
    const perDay = Number(smoking.cigarettesPerDay);
    const years = Number(smoking.yearsSmoked);
    smoking.packYears =
      Number.isFinite(perDay) && Number.isFinite(years) && perDay > 0 && years > 0
        ? Math.round(((perDay / 20) * years) * 10) / 10
        : smoking.packYears ?? null;
  }
  next();
});

const vaccinationHistorySchema = new mongoose.Schema(
  {
    vaccineName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    dateAdministered: {
      type: Date,
      default: null,
    },
    doseNumber: {
      type: Number,
      min: 1,
      default: 1,
    },
    administeredBy: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    relationship: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },
    alternatePhone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 150,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  { _id: false },
);

const patientProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Human-friendly, sequential, unique patient identifier —
    // distinct from the Mongo `_id`, for use on medical records,
    // prescriptions, appointment scheduling, etc. Generated server-
    // side; never client-supplied. Pattern: PAT-YYYYMM-XXXX
    patientId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    // Demographics
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    gender: {
      type: String,
      enum: PATIENT_GENDERS,
      required: true,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    bloodGroup: {
      type: String,
      enum: [...PATIENT_BLOOD_GROUPS, null],
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },

    alternatePhone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },

    address: {
      street: { type: String, trim: true, maxlength: 200, default: '' },
      city: { type: String, trim: true, maxlength: 100, default: '' },
      state: { type: String, trim: true, maxlength: 100, default: '' },
      postalCode: { type: String, trim: true, maxlength: 20, default: '' },
      country: { type: String, trim: true, maxlength: 100, default: '' },
    },

    nationality: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    nationalIdNumber: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },

    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },

    // Extra contact channels a patient can share (self-service form).
    // `phone` doubles as the SMS number.
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 150,
      default: '',
    },
    whatsappNumber: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },
    messengerUsername: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    // Preferences
    preferredLanguage: {
      type: String,
      enum: ['en', 'bn', 'hi', 'ur'],
      default: 'en',
    },

    preferredCommunicationMethod: {
      type: String,
      enum: ['EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'MESSENGER'],
      default: 'EMAIL',
    },

    // Medical History
    allergies: {
      type: [allergySchema],
      default: [],
    },

    chronicConditions: {
      type: [chronicConditionSchema],
      default: [],
    },

    surgeryHistory: {
      type: [surgeryHistorySchema],
      default: [],
    },

    medicationHistory: {
      type: [medicationHistorySchema],
      default: [],
    },

    familyHistory: {
      type: [familyHistorySchema],
      default: [],
    },

    socialHistory: {
      type: socialHistorySchema,
      default: () => ({}),
    },

    vaccinationHistory: {
      type: [vaccinationHistorySchema],
      default: [],
    },

    // Additional medical notes
    medicalNotes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },

    // Patient status
    patientStatus: {
      type: String,
      enum: PATIENT_STATUSES,
      default: 'ACTIVE',
    },

    // Registration and provider tracking
    registrationDate: {
      type: Date,
      default: () => new Date(),
    },

    primaryCareProvider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Profile image (Cloudinary public_id)
    profileImage: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },

    // Soft-delete flag (temporary deactivation vs. soft deletion)
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

// Indexes for efficient queries
patientProfileSchema.index({ firstName: 1, lastName: 1 });
patientProfileSchema.index({ phone: 1 });
patientProfileSchema.index({ dateOfBirth: 1 });
patientProfileSchema.index({ patientStatus: 1, isActive: 1 });
patientProfileSchema.index({ registrationDate: 1 });
patientProfileSchema.index({ primaryCareProvider: 1 });

// Virtual for full name
patientProfileSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual for age calculation
patientProfileSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Ensure virtuals are included when converting to JSON
patientProfileSchema.set('toJSON', { virtuals: true });
patientProfileSchema.set('toObject', { virtuals: true });

export const PatientProfile = mongoose.model(
  'PatientProfile',
  patientProfileSchema,
  'patient_profiles',
);
