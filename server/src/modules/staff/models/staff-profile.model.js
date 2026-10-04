import mongoose from 'mongoose';

/**
 * BET-05 — Staff & Organization Management.
 *
 * A `StaffProfile` is deliberately kept separate from `User`
 * (`users/user.model.js`, BET-03). `User` remains the single
 * authentication/authorization identity (email, password, RBAC
 * `role`, account `status`) and must not be duplicated here. This
 * collection instead holds the organizational/HR side of a staff
 * member: designation, department, employment details, and — for
 * doctors specifically — clinical-practice metadata. One `User` has
 * at most one `StaffProfile` (enforced by the unique index below).
 *
 * `PATIENT` accounts never get a `StaffProfile` — enforced in
 * `staff.service.js`, not here, since that check needs to read the
 * referenced `User` document.
 *
 * This intentionally reuses the fixed RBAC roles already defined in
 * `security/permissions.js` (master prompt section 14 lists many
 * more staff titles than the 8 RBAC roles that module settled on —
 * see BET-04). Rather than reopening/expanding that enum, the wider
 * set of real-world job titles (Nurse, Accountant, Pharmacist, etc.)
 * is modeled here as an organizational `designation`, independent of
 * the account's RBAC `role`. This keeps authorization simple (still
 * driven entirely by `User.role`) while still letting the practice
 * record who someone actually is on staff.
 */

export const STAFF_DESIGNATIONS = Object.freeze([
  'DOCTOR',
  'ADMINISTRATOR',
  'NURSE',
  'MEDICAL_ASSISTANT',
  'RECEPTIONIST',
  'ACCOUNTANT',
  'PHARMACIST',
  'CONTENT_MANAGER',
  'SUPPORT_STAFF',
  'OTHER',
]);

export const STAFF_EMPLOYMENT_TYPES = Object.freeze([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'VISITING',
  'INTERN',
]);

/**
 * Employment status is deliberately separate from `User.status`
 * (ACTIVE/INACTIVE/SUSPENDED — the login/account-access state).
 * `employmentStatus` is HR-facing: an account can remain login-
 * capable (e.g. to review historical records) while marked
 * ON_LEAVE or even TERMINATED, and vice versa. Login access itself
 * is still only ever governed by `User.status` and RBAC.
 */
export const STAFF_EMPLOYMENT_STATUSES = Object.freeze([
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED',
]);

export const STAFF_GENDERS = Object.freeze([
  'MALE',
  'FEMALE',
  'OTHER',
  'PREFER_NOT_TO_SAY',
]);

const doctorDetailsSchema = new mongoose.Schema(
  {
    specialization: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    qualifications: {
      type: [String],
      default: [],
    },

    // e.g. BM&DC registration number. Kept as a free-text field
    // since the exact registering body/format is jurisdiction
    // dependent (master prompt section 95 — Bangladesh healthcare
    // compliance direction) and must not be assumed here.
    registrationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 80,
      default: 0,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    // Bangla-language versions of the doctor's name/credentials, used
    // on the prescription letterhead (`buildDoctorSnapshot` in
    // `prescriptions/services/prescription.service.js`). Left blank
    // by default — a doctor without these filled in falls back to the
    // practice's default header text rather than another doctor's
    // name. Self-editable via `PATCH /staff/me`.
    nameBangla: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    degreesBangla: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    designationBangla: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    departmentBangla: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    specialtyBangla: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
  },
  { _id: false },
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: '' },
    relationship: { type: String, trim: true, maxlength: 80, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
  },
  { _id: false },
);

const staffProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Human-friendly, sequential, unique staff identifier —
    // distinct from the Mongo `_id`, for use on ID cards, printed
    // schedules, etc. Generated server-side; never client-supplied.
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    designation: {
      type: String,
      enum: STAFF_DESIGNATIONS,
      required: true,
    },

    // Only meaningful (and required, see the pre-validate hook
    // below) when `designation` is `OTHER` — lets the practice
    // record a real-world job title without having to keep
    // expanding `STAFF_DESIGNATIONS` for every one-off role
    // (master prompt section 14: "Custom Role").
    customDesignationLabel: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    department: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },

    gender: {
      type: String,
      enum: [...STAFF_GENDERS, null],
      default: null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    address: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    joiningDate: {
      type: Date,
      default: () => new Date(),
    },

    employmentType: {
      type: String,
      enum: STAFF_EMPLOYMENT_TYPES,
      default: 'FULL_TIME',
    },

    employmentStatus: {
      type: String,
      enum: STAFF_EMPLOYMENT_STATUSES,
      default: 'ACTIVE',
    },

    // Only populated (and validated, see below) when
    // `designation === 'DOCTOR'`.
    doctorDetails: {
      type: doctorDetailsSchema,
      default: () => ({}),
    },

    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },

    // Soft-delete flag for the HR record itself. Deactivating a
    // staff profile never touches the underlying `User` account
    // (login access is managed separately via BET-05's user-
    // management endpoints, and is itself blocked for protected
    // accounts at the `User` model level — master prompt section
    // 10/84: never destroy history, never silently cascade).
    isActive: {
      type: Boolean,
      default: true,
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

staffProfileSchema.index({ designation: 1, employmentStatus: 1, isActive: 1 });
staffProfileSchema.index({ department: 1 });

staffProfileSchema.pre('validate', function validateDesignationDetails(next) {
  if (this.designation === 'OTHER' && !this.customDesignationLabel?.trim()) {
    return next(
      new Error('customDesignationLabel is required when designation is OTHER.'),
    );
  }

  if (this.designation === 'DOCTOR') {
    const details = this.doctorDetails || {};

    if (!details.specialization?.trim()) {
      return next(
        new Error('doctorDetails.specialization is required for doctor staff profiles.'),
      );
    }

    if (!details.registrationNumber?.trim()) {
      return next(
        new Error('doctorDetails.registrationNumber is required for doctor staff profiles.'),
      );
    }
  }

  return next();
});

export const StaffProfile = mongoose.model(
  'StaffProfile',
  staffProfileSchema,
  'staff_profiles',
);
