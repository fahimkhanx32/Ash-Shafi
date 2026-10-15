import Joi from 'joi';

import {
  STAFF_DESIGNATIONS,
  STAFF_EMPLOYMENT_TYPES,
  STAFF_EMPLOYMENT_STATUSES,
  STAFF_GENDERS,
} from '../models/staff-profile.model.js';

// Follows the existing `validate(schema, source)` middleware
// convention (`middlewares/validation.middleware.js`) and the same
// Mongo-id pattern already used in `modules/roles/validators`.
const mongoIdSchema = Joi.string()
  .trim()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({
    'string.pattern.base': 'Invalid identifier.',
  });

const doctorDetailsSchema = Joi.object({
  specialization: Joi.string().trim().max(150),
  qualifications: Joi.array().items(Joi.string().trim().max(150)).max(20),
  registrationNumber: Joi.string().trim().max(100),
  yearsOfExperience: Joi.number().integer().min(0).max(80),
  bio: Joi.string().trim().max(1000).allow(''),
  nameBangla: Joi.string().trim().max(150).allow(''),
  degreesBangla: Joi.string().trim().max(300).allow(''),
  designationBangla: Joi.string().trim().max(150).allow(''),
  departmentBangla: Joi.string().trim().max(150).allow(''),
  specialtyBangla: Joi.string().trim().max(200).allow(''),
  designationEnglish: Joi.string().trim().max(150).allow(''),
  departmentEnglish: Joi.string().trim().max(150).allow(''),
  hospitalEnglish: Joi.string().trim().max(250).allow(''),
  hospitalBangla: Joi.string().trim().max(250).allow(''),
  chamberInfo: Joi.string().trim().max(500).allow(''),
  visitingHours: Joi.string().trim().max(300).allow(''),
});

const emergencyContactSchema = Joi.object({
  name: Joi.string().trim().max(120).allow(''),
  relationship: Joi.string().trim().max(80).allow(''),
  phone: Joi.string().trim().max(30).allow(''),
});

export const createStaffProfileSchema = Joi.object({
  userId: mongoIdSchema.required(),

  designation: Joi.string()
    .valid(...STAFF_DESIGNATIONS)
    .required(),

  customDesignationLabel: Joi.string()
    .trim()
    .max(100)
    .when('designation', {
      is: 'OTHER',
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),

  department: Joi.string().trim().max(100).allow('').optional(),
  phone: Joi.string().trim().max(30).allow('').optional(),
  gender: Joi.string().valid(...STAFF_GENDERS).optional(),
  dateOfBirth: Joi.date().iso().max('now').optional(),
  address: Joi.string().trim().max(300).allow('').optional(),
  joiningDate: Joi.date().iso().optional(),
  employmentType: Joi.string().valid(...STAFF_EMPLOYMENT_TYPES).optional(),

  doctorDetails: Joi.when('designation', {
    is: 'DOCTOR',
    then: doctorDetailsSchema.fork(
      ['specialization', 'registrationNumber'],
      (schema) => schema.required(),
    ).required(),
    otherwise: doctorDetailsSchema.optional(),
  }),

  emergencyContact: emergencyContactSchema.optional(),
});

export const updateStaffProfileSchema = Joi.object({
  designation: Joi.string().valid(...STAFF_DESIGNATIONS).optional(),
  customDesignationLabel: Joi.string().trim().max(100).allow('').optional(),
  department: Joi.string().trim().max(100).allow('').optional(),
  phone: Joi.string().trim().max(30).allow('').optional(),
  gender: Joi.string().valid(...STAFF_GENDERS).optional(),
  dateOfBirth: Joi.date().iso().max('now').optional(),
  address: Joi.string().trim().max(300).allow('').optional(),
  joiningDate: Joi.date().iso().optional(),
  employmentType: Joi.string().valid(...STAFF_EMPLOYMENT_TYPES).optional(),
  doctorDetails: doctorDetailsSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
}).min(1);

// A staff member editing their own record (`PATCH /staff/me`) —
// deliberately narrower than `updateStaffProfileSchema`. Org-assigned
// fields (designation, customDesignationLabel, department,
// employmentType, joiningDate) stay admin-only (`PATCH /staff/:id`,
// gated on `USERS_WRITE`); this only covers personal/clinical details
// the person themself is the authority on — including the Bangla
// name/credential fields used on the prescription letterhead, which
// previously had no way of ever being set per-doctor.
export const updateMyStaffProfileSchema = Joi.object({
  phone: Joi.string().trim().max(30).allow('').optional(),
  gender: Joi.string().valid(...STAFF_GENDERS).optional(),
  dateOfBirth: Joi.date().iso().max('now').optional(),
  address: Joi.string().trim().max(300).allow('').optional(),
  doctorDetails: doctorDetailsSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
}).min(1);

export const setEmploymentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...STAFF_EMPLOYMENT_STATUSES)
    .required(),
});

export const staffIdParamsSchema = Joi.object({
  id: mongoIdSchema.required(),
});

export const listStaffQuerySchema = Joi.object({
  designation: Joi.string().valid(...STAFF_DESIGNATIONS).optional(),
  employmentStatus: Joi.string().valid(...STAFF_EMPLOYMENT_STATUSES).optional(),
  department: Joi.string().trim().max(100).optional(),
  search: Joi.string().trim().max(150).optional(),
  includeInactive: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const listDoctorsQuerySchema = Joi.object({
  search: Joi.string().trim().max(150).optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
