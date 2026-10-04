import mongoose from 'mongoose';

import { PERMISSIONS } from '../../../security/permissions.js';

const ALL_PERMISSION_VALUES = Object.values(PERMISSIONS);

const roleSchema = new mongoose.Schema(
  {
    /**
     * Stable identifier. For a system role this is exactly the
     * fixed `ROLES` enum value (e.g. `"DOCTOR"`), keeping the DB
     * record and the code-level enum in lockstep. For a custom role
     * it is a generated, unique, URL-safe slug derived from `name`.
     */
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    /**
     * Subset of the fixed, code-defined permission catalog
     * (`security/permissions.js`). Every value is validated against
     * that catalog below — a role can never reference a permission
     * that does not actually exist in the enforcement layer.
     */
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator(values) {
          if (!Array.isArray(values)) {
            return false;
          }

          return values.every((value) =>
            ALL_PERMISSION_VALUES.includes(value),
          );
        },
        message: 'One or more permissions are not part of the permission catalog.',
      },
    },

    /**
     * True for the 8 fixed roles defined in `security/permissions.js`
     * (`ROLE_HIERARCHY`). System roles are enforced from that
     * in-memory map regardless of what is stored here — this
     * document exists purely so the roles list/administration UI has
     * a single, unified source to read from (system + custom roles
     * together). Because of that, system-role documents are
     * read-only through the API (see `role.service.js`): allowing an
     * edit here that enforcement never actually reads would be
     * exactly the kind of "frontend/DB says one thing, backend
     * enforcement does another" gap master prompt section 80
     * prohibits.
     */
    isSystem: {
      type: Boolean,
      default: false,
    },

    /**
     * System roles that additionally can never be deleted or
     * repurposed even if system-role mutation is ever revisited
     * (SOFTWARE_OWNER, SUPER_ADMIN). Mirrors, at the role-definition
     * level, the same protected-account principle already enforced
     * per-account on `User` (master prompt section 10).
     */
    isProtected: {
      type: Boolean,
      default: false,
    },

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

roleSchema.index({ isSystem: 1, isActive: 1 });

// Guard against deleting/deactivating a protected system role through
// ordinary document-level operations, mirroring `user.model.js`.
roleSchema.pre('deleteOne', { document: true, query: false }, function guard(next) {
  if (this.isSystem) {
    return next(new Error('System roles cannot be deleted.'));
  }

  return next();
});

roleSchema.pre(
  ['deleteOne', 'findOneAndDelete'],
  { document: false, query: true },
  async function guard(next) {
    const target = await this.model
      .findOne(this.getFilter())
      .select('isSystem')
      .lean();

    if (target?.isSystem) {
      return next(new Error('System roles cannot be deleted.'));
    }

    return next();
  },
);

export const Role = mongoose.model('Role', roleSchema, 'roles');
