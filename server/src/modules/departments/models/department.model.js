import mongoose from 'mongoose';

/**
 * Departments — organizational structure entity.
 *
 * Filled gap: master prompt §19 (Administration section) lists
 * Doctors / Staff / Departments as three separate administration
 * screens, but until now `department` only existed as a free-text
 * field on `StaffProfile` (`modules/staff/models/staff-profile.model.js`)
 * — there was no real `Department` collection an admin could list,
 * create, rename, or deactivate. This module adds that entity.
 *
 * Deliberately additive, not a migration: `StaffProfile.department`
 * remains a free-text `String` field (unchanged) rather than being
 * converted to a `Department` reference. Changing an existing,
 * already-relied-upon field's type is a bigger, riskier change than
 * this gap asked for, and doing it silently would risk breaking
 * every existing staff profile's `department` value. Instead, the
 * frontend's staff forms are updated to *source* the free-text
 * field's suggestions from this new catalog (see
 * `client/web/src/services/departmentsService.js`), which closes the
 * real gap — "an admin can now define what the department list even
 * is" — without an invasive, out-of-scope schema migration.
 */

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    // Lowercased mirror of `name`, used only for a case-insensitive
    // uniqueness check (see the unique index below) — Mongo's default
    // string index is case-sensitive, and "Radiology" / "radiology"
    // being treated as two different departments would defeat the
    // purpose of this catalog.
    nameNormalized: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    // Optional — not every department has a named head yet, and this
    // module must not force one just to create a department record.
    headOfDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffProfile',
      default: null,
    },

    // Soft-deactivate only, same convention as `Medicine.isActive`
    // (`modules/medicines/models/medicine.model.js`) — a department
    // referenced historically (e.g. in a staff member's employment
    // record) must not disappear outright.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

departmentSchema.index({ nameNormalized: 1 }, { unique: true });

departmentSchema.pre('validate', function normalizeName(next) {
  if (this.name) {
    this.nameNormalized = this.name.trim().toLowerCase();
  }
  return next();
});

export const Department = mongoose.model('Department', departmentSchema, 'departments');
