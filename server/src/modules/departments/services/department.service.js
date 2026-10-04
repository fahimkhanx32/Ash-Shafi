import mongoose from 'mongoose';

import { Department } from '../models/department.model.js';
import { StaffProfile } from '../../staff/models/staff-profile.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

/**
 * Departments — organizational-structure CRUD service.
 *
 * Deliberately thin, mirroring `modules/medicines/services/medicine.service.js`'s
 * reference-data shape: this is a named catalog an administrator
 * maintains, not a module with its own workflow/state machine.
 * Deactivation is soft (never a hard delete) for the same reason
 * every other reference-data module in this project uses soft-delete
 * — a department referenced historically on a staff member's record
 * must not vanish out from under it.
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findDepartmentOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid department id.', 400, { code: 'INVALID_ID' });
  }
  const department = await Department.findById(id).populate(
    'headOfDepartment',
    'employeeId designation customDesignationLabel',
  );
  if (!department) {
    throw new AppError('Department not found.', 404, { code: 'DEPARTMENT_NOT_FOUND' });
  }
  return department;
};

const assertNameAvailable = async (name, excludeId = null) => {
  const nameNormalized = name.trim().toLowerCase();
  const query = { nameNormalized };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const existing = await Department.findOne(query);
  if (existing) {
    throw new AppError('A department with this name already exists.', 409, {
      code: 'DEPARTMENT_NAME_TAKEN',
    });
  }
};

const assertHeadIsValidStaff = async (headOfDepartment) => {
  if (!headOfDepartment) return;
  if (!isValidObjectId(headOfDepartment)) {
    throw new AppError('Invalid headOfDepartment id.', 400, { code: 'INVALID_ID' });
  }
  const staff = await StaffProfile.findById(headOfDepartment);
  if (!staff || !staff.isActive) {
    throw new AppError('headOfDepartment must be an active staff profile.', 400, {
      code: 'INVALID_HEAD_OF_DEPARTMENT',
    });
  }
};

export const createDepartment = async (data, actor) => {
  const { name, description = '', headOfDepartment = null } = data;

  await assertNameAvailable(name);
  await assertHeadIsValidStaff(headOfDepartment);

  const department = await Department.create({
    name: name.trim(),
    description,
    headOfDepartment: headOfDepartment || null,
    createdBy: actor._id,
  });

  logger.info(
    { event: 'department_created', departmentId: department._id.toString(), createdBy: String(actor._id) },
    'Department created.',
  );

  return findDepartmentOrThrow(department._id);
};

export const getDepartmentById = async (id) => findDepartmentOrThrow(id);

export const listDepartments = async (filters = {}) => {
  const { search = '', isActive = null, page = 1, limit = 50 } = filters;

  const query = {};
  if (search.trim()) {
    query.name = new RegExp(search.trim(), 'i');
  }
  if (isActive !== null && isActive !== undefined && isActive !== '') {
    query.isActive = isActive;
  }

  const numericPage = parseInt(page, 10) || 1;
  const numericLimit = parseInt(limit, 10) || 50;
  const skip = (numericPage - 1) * numericLimit;

  const [items, total] = await Promise.all([
    Department.find(query)
      .populate('headOfDepartment', 'employeeId designation customDesignationLabel')
      .sort({ name: 1 })
      .skip(skip)
      .limit(numericLimit)
      .lean(),
    Department.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page: numericPage,
      limit: numericLimit,
      total,
      pages: Math.ceil(total / numericLimit),
    },
  };
};

export const updateDepartment = async (id, updates, actor) => {
  const department = await findDepartmentOrThrow(id);

  if (updates.name && updates.name.trim() !== department.name) {
    await assertNameAvailable(updates.name, department._id);
  }
  if (updates.headOfDepartment !== undefined) {
    await assertHeadIsValidStaff(updates.headOfDepartment);
  }

  const protectedFields = ['_id', 'createdBy', 'nameNormalized', 'isActive'];
  protectedFields.forEach((field) => delete updates[field]);

  Object.assign(department, updates, { updatedBy: actor._id });
  await department.save();

  logger.info(
    { event: 'department_updated', departmentId: department._id.toString(), updatedBy: String(actor._id) },
    'Department updated.',
  );

  return findDepartmentOrThrow(department._id);
};

export const deactivateDepartment = async (id, actor) => {
  const department = await findDepartmentOrThrow(id);
  department.isActive = false;
  department.updatedBy = actor._id;
  await department.save();

  logger.info(
    { event: 'department_deactivated', departmentId: department._id.toString(), deactivatedBy: String(actor._id) },
    'Department deactivated.',
  );

  return department;
};

export const reactivateDepartment = async (id, actor) => {
  const department = await findDepartmentOrThrow(id);
  department.isActive = true;
  department.updatedBy = actor._id;
  await department.save();
  return department;
};
