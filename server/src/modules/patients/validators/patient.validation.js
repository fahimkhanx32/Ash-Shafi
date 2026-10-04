import Joi from 'joi';
import {
  PATIENT_GENDERS,
  PATIENT_BLOOD_GROUPS,
  PATIENT_STATUSES,
} from '../models/patient-profile.model.js';

/**
 * BET-06 — Patient & Medical History Validation.
 *
 * Joi validation schemas for patient profile operations,
 * following the same pattern established in BET-05's
 * `modules/users/validators/user.validation.js` and earlier's
 * `modules/staff/validators/staff.validation.js`.
 */

// Reusable sub-schemas
const allergySchema = Joi.object({
  allergen: Joi.string().trim().max(200).required(),
  reaction: Joi.string().trim().max(500).allow(''),
  severity: Joi.string()
    .valid('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING')
    .default('MODERATE'),
  diagnosedDate: Joi.date().max('now').allow(null),
  notes: Joi.string().trim().max(1000).allow(''),
  isActive: Joi.boolean().default(true),
});

const chronicConditionSchema = Joi.object({
  condition: Joi.string().trim().max(200).required(),
  diagnosedDate: Joi.date().max('now').allow(null),
  status: Joi.string().valid('ACTIVE', 'MANAGED', 'RESOLVED', 'CHRONIC').default('ACTIVE'),
  treatment: Joi.string().trim().max(1000).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
  isActive: Joi.boolean().default(true),
});

const surgeryHistorySchema = Joi.object({
  procedure: Joi.string().trim().max(300).required(),
  surgeryDate: Joi.date().max('now').allow(null),
  hospital: Joi.string().trim().max(200).allow(''),
  surgeon: Joi.string().trim().max(150).allow(''),
  complications: Joi.string().trim().max(1000).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
});

const medicationHistorySchema = Joi.object({
  medicationName: Joi.string().trim().max(200).required(),
  dosage: Joi.string().trim().max(100).allow(''),
  frequency: Joi.string().trim().max(100).allow(''),
  startDate: Joi.date().max('now').allow(null),
  endDate: Joi.date().min(Joi.ref('startDate')).allow(null),
  prescribedBy: Joi.string().trim().max(150).allow(''),
  reason: Joi.string().trim().max(500).allow(''),
  notes: Joi.string().trim().max(1000).allow(''),
  isCurrent: Joi.boolean().default(false),
});

const familyHistorySchema = Joi.object({
  relationship: Joi.string().trim().max(100).required(),
  condition: Joi.string().trim().max(200).required(),
  ageOfOnset: Joi.number().integer().min(0).max(150).allow(null),
  notes: Joi.string().trim().max(1000).allow(''),
});

const smokingHistorySchema = Joi.object({
  cigarettesPerDay: Joi.number().min(0).max(200).allow(null),
  yearsSmoked: Joi.number().min(0).max(100).allow(null),
  startDate: Joi.date().iso().allow(null),
  quitDate: Joi.date().iso().allow(null),
  packYears: Joi.number().min(0).allow(null), // derived server-side; accepted but recomputed on save
  notes: Joi.string().trim().max(1000).allow(''),
});

const socialHistorySchema = Joi.object({
  smokingStatus: Joi.string()
    .valid('NEVER', 'FORMER', 'CURRENT', 'UNKNOWN')
    .default('UNKNOWN'),
  smokingDetails: Joi.string().trim().max(500).allow(''),
  smoking: smokingHistorySchema,
  alcoholUse: Joi.string()
    .valid('NEVER', 'OCCASIONAL', 'MODERATE', 'HEAVY', 'FORMER', 'UNKNOWN')
    .default('UNKNOWN'),
  alcoholDetails: Joi.string().trim().max(500).allow(''),
  exerciseFrequency: Joi.string()
    .valid('NONE', 'RARELY', 'WEEKLY', 'DAILY', 'UNKNOWN')
    .default('UNKNOWN'),
  dietaryRestrictions: Joi.string().trim().max(500).allow(''),
  occupation: Joi.string().trim().max(150).allow(''),
  maritalStatus: Joi.string()
    .valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'OTHER', 'UNKNOWN')
    .default('UNKNOWN'),
  notes: Joi.string().trim().max(1000).allow(''),
});

const vaccinationHistorySchema = Joi.object({
  vaccineName: Joi.string().trim().max(200).required(),
  dateAdministered: Joi.date().max('now').allow(null),
  doseNumber: Joi.number().integer().min(1).default(1),
  administeredBy: Joi.string().trim().max(150).allow(''),
  notes: Joi.string().trim().max(500).allow(''),
});

const emergencyContactSchema = Joi.object({
  name: Joi.string().trim().max(120).allow(''),
  relationship: Joi.string().trim().max(80).allow(''),
  phone: Joi.string().trim().max(30).allow(''),
  alternatePhone: Joi.string().trim().max(30).allow(''),
  email: Joi.string().trim().lowercase().email().max(150).allow(''),
  address: Joi.string().trim().max(300).allow(''),
});

const addressSchema = Joi.object({
  street: Joi.string().trim().max(200).allow(''),
  city: Joi.string().trim().max(100).allow(''),
  state: Joi.string().trim().max(100).allow(''),
  postalCode: Joi.string().trim().max(20).allow(''),
  country: Joi.string().trim().max(100).allow(''),
});

// Mongo-id pattern, matching the convention already used in
// `modules/staff/validators/staff.validation.js`.
const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({
    'string.pattern.base': 'Invalid identifier.',
  });

// Create patient profile validation
export const createPatientProfileSchema = Joi.object({
  // The existing `User` (role PATIENT) this profile attaches to, or auto-created if omitted.
  userId: Joi.string().trim().min(1).max(254).allow(null, '').optional(),

  // Required demographics
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  gender: Joi.string()
    .valid(...PATIENT_GENDERS)
    .required(),
  dateOfBirth: Joi.date().max('now').required(),

  // Optional demographics
  bloodGroup: Joi.string()
    .valid(...PATIENT_BLOOD_GROUPS)
    .allow(null),
  phone: Joi.string().trim().max(30).allow(''),
  alternatePhone: Joi.string().trim().max(30).allow(''),
  address: addressSchema,
  nationality: Joi.string().trim().max(100).allow(''),
  nationalIdNumber: Joi.string().trim().max(50).allow(''),

  // Emergency contact
  emergencyContact: emergencyContactSchema,

  // Preferences
  preferredLanguage: Joi.string().valid('en', 'bn', 'hi', 'ur').default('en'),
  preferredCommunicationMethod: Joi.string()
    .valid('EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'MESSENGER')
    .default('EMAIL'),

  // Optional medical history (can be added later)
  allergies: Joi.array().items(allergySchema).default([]),
  chronicConditions: Joi.array().items(chronicConditionSchema).default([]),
  surgeryHistory: Joi.array().items(surgeryHistorySchema).default([]),
  medicationHistory: Joi.array().items(medicationHistorySchema).default([]),
  familyHistory: Joi.array().items(familyHistorySchema).default([]),
  socialHistory: socialHistorySchema,
  vaccinationHistory: Joi.array().items(vaccinationHistorySchema).default([]),

  // Additional notes
  medicalNotes: Joi.string().trim().max(5000).allow(''),

  // Patient status
  patientStatus: Joi.string()
    .valid(...PATIENT_STATUSES)
    .default('ACTIVE'),

  // Primary care provider
  primaryCareProvider: Joi.string().hex().length(24).allow(null),

  // Profile image
  profileImage: Joi.string().trim().max(255).allow(''),
});

// Update patient profile validation
export const updatePatientProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100),
  lastName: Joi.string().trim().min(1).max(100),
  gender: Joi.string().valid(...PATIENT_GENDERS),
  dateOfBirth: Joi.date().max('now'),
  bloodGroup: Joi.string()
    .valid(...PATIENT_BLOOD_GROUPS)
    .allow(null),
  phone: Joi.string().trim().max(30).allow(''),
  alternatePhone: Joi.string().trim().max(30).allow(''),
  address: addressSchema,
  nationality: Joi.string().trim().max(100).allow(''),
  nationalIdNumber: Joi.string().trim().max(50).allow(''),
  emergencyContact: emergencyContactSchema,
  contactEmail: Joi.string().trim().lowercase().email().max(150).allow(''),
  whatsappNumber: Joi.string().trim().max(30).allow(''),
  messengerUsername: Joi.string().trim().max(100).allow(''),
  preferredLanguage: Joi.string().valid('en', 'bn', 'hi', 'ur'),
  preferredCommunicationMethod: Joi.string().valid('EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'MESSENGER'),
  medicalNotes: Joi.string().trim().max(5000).allow(''),
  patientStatus: Joi.string().valid(...PATIENT_STATUSES),
  primaryCareProvider: Joi.string().hex().length(24).allow(null),
  profileImage: Joi.string().trim().max(255).allow(''),
}).min(1);

// Patient SELF-service schemas (PATCH/POST /patients/me). A strict allowlist:
// a patient may maintain contact and demographic details, but never clinical
// or administrative fields (status, primary care provider, medical notes,
// national ID, history arrays, profile image path). Unknown fields are
// rejected rather than silently stripped so a tampered request is visible.
const selfServiceFields = {
  firstName: Joi.string().trim().min(1).max(100),
  lastName: Joi.string().trim().min(1).max(100),
  gender: Joi.string().valid(...PATIENT_GENDERS),
  dateOfBirth: Joi.date().max('now'),
  bloodGroup: Joi.string()
    .valid(...PATIENT_BLOOD_GROUPS)
    .allow(null),
  phone: Joi.string().trim().max(30).allow(''),
  alternatePhone: Joi.string().trim().max(30).allow(''),
  address: addressSchema,
  nationality: Joi.string().trim().max(100).allow(''),
  emergencyContact: emergencyContactSchema,
  // Contact channels the "My details" form sends. Without these the strict
  // allowUnknown:false below rejected every save with "Request validation failed".
  contactEmail: Joi.string().trim().lowercase().email().max(150).allow(''),
  whatsappNumber: Joi.string().trim().max(30).allow(''),
  messengerUsername: Joi.string().trim().max(100).allow(''),
  preferredLanguage: Joi.string().valid('en', 'bn', 'hi', 'ur'),
  preferredCommunicationMethod: Joi.string().valid('EMAIL', 'SMS', 'PHONE', 'WHATSAPP', 'MESSENGER'),
};

export const updateMyPatientProfileSchema = Joi.object(selfServiceFields)
  .min(1)
  .options({ allowUnknown: false, stripUnknown: false });

export const createMyPatientProfileSchema = Joi.object({
  ...selfServiceFields,
  firstName: selfServiceFields.firstName.required(),
  lastName: selfServiceFields.lastName.required(),
  gender: selfServiceFields.gender.required(),
  dateOfBirth: selfServiceFields.dateOfBirth.required(),
}).options({ allowUnknown: false, stripUnknown: false });

// List patients query validation
export const listPatientsQuerySchema = Joi.object({
  search: Joi.string().trim().max(200).allow(''),
  patientStatus: Joi.string()
    .valid(...PATIENT_STATUSES)
    .allow(''),
  gender: Joi.string()
    .valid(...PATIENT_GENDERS)
    .allow(''),
  minAge: Joi.number().integer().min(0).max(150).allow(null),
  maxAge: Joi.number()
    .integer()
    .min(Joi.ref('minAge'))
    .max(150)
    .allow(null),
  registeredAfter: Joi.date().allow(null),
  registeredBefore: Joi.date().min(Joi.ref('registeredAfter')).allow(null),
  primaryCareProvider: Joi.string().hex().length(24).allow(null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('registrationDate', 'firstName', 'lastName', 'patientId', 'dateOfBirth')
    .default('registrationDate'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

// Add allergy validation
export const addAllergySchema = allergySchema;

// Update allergy validation
export const updateAllergySchema = allergySchema.fork(
  ['allergen'],
  (schema) => schema.optional(),
);

// Add chronic condition validation
export const addChronicConditionSchema = chronicConditionSchema;

// Update chronic condition validation
export const updateChronicConditionSchema = chronicConditionSchema.fork(
  ['condition'],
  (schema) => schema.optional(),
);

// Add surgery history validation
export const addSurgeryHistorySchema = surgeryHistorySchema;

// Update surgery history validation
export const updateSurgeryHistorySchema = surgeryHistorySchema.fork(
  ['procedure'],
  (schema) => schema.optional(),
);

// Add medication history validation
export const addMedicationHistorySchema = medicationHistorySchema;

// Update medication history validation
export const updateMedicationHistorySchema = medicationHistorySchema.fork(
  ['medicationName'],
  (schema) => schema.optional(),
);

// Add family history validation
export const addFamilyHistorySchema = familyHistorySchema;

// Update family history validation
export const updateFamilyHistorySchema = familyHistorySchema.fork(
  ['relationship', 'condition'],
  (schema) => schema.optional(),
);

// Update social history validation
export const updateSocialHistorySchema = socialHistorySchema;

// Add vaccination history validation
export const addVaccinationHistorySchema = vaccinationHistorySchema;

// Update vaccination history validation
export const updateVaccinationHistorySchema = vaccinationHistorySchema.fork(
  ['vaccineName'],
  (schema) => schema.optional(),
);

// Patient ID param validation
export const patientIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

// Medical history item ID param validation
export const medicalHistoryItemIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
  itemId: Joi.string().hex().length(24).required(),
});
