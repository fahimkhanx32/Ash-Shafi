import mongoose from 'mongoose';

import { Medicine } from '../models/medicine.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { ROLES } from '../../../security/permissions.js';

/**
 * BET-11 — Medicine database service.
 *
 * Two-tier deletion approach:
 * - SOFTWARE_OWNER / SUPER_ADMIN: can permanently delete (hardDeleteMedicine) or view soft-deleted records
 * - All other roles: delete = soft-delete (isDeleted: true, hidden from regular views)
 */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findMedicineOrThrow = async (id, { includeDeleted = false } = {}) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid medicine id.', 400, { code: 'INVALID_ID' });
  }
  const query = { _id: id };
  if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }
  const medicine = await Medicine.findOne(query);
  if (!medicine) {
    throw new AppError('Medicine not found.', 404, { code: 'MEDICINE_NOT_FOUND' });
  }
  return medicine;
};

export const createMedicine = async (data, actor) => {
  const medicine = await Medicine.create({ ...data, createdBy: actor._id });
  logger.info(
    { event: 'medicine_created', medicineId: medicine._id.toString(), createdBy: String(actor._id) },
    'Medicine reference record created.',
  );
  return medicine;
};

export const getMedicineById = async (id) => findMedicineOrThrow(id);

export const listMedicines = async (filters = {}, actorRole = null) => {
  const {
    search = '',
    dosageForm = '',
    route = '',
    isActive = null,
    verificationStatus = '',
    page = 1,
    limit = 20,
    includeDeleted = false,
    onlyDeleted = false,
  } = filters;

  const isSuperOrOwner = actorRole === ROLES.SOFTWARE_OWNER || actorRole === ROLES.SUPER_ADMIN;

  const query = {};

  if (isSuperOrOwner && onlyDeleted) {
    query.isDeleted = true;
  } else if (isSuperOrOwner && includeDeleted) {
    // include all when explicitly requested
  } else {
    query.isDeleted = { $ne: true };
  }

  if (search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ genericName: searchRegex }, { brandName: searchRegex }, { manufacturer: searchRegex }];
  }
  if (dosageForm) query.dosageForm = dosageForm;
  if (route) query.route = route;
  if (isActive !== null && isActive !== undefined && isActive !== '') query.isActive = isActive;
  if (verificationStatus) query.verificationStatus = verificationStatus;

  const numericPage = parseInt(page, 10) || 1;
  const numericLimit = parseInt(limit, 10) || 20;
  const skip = (numericPage - 1) * numericLimit;

  const [items, total] = await Promise.all([
    Medicine.find(query).sort({ genericName: 1 }).skip(skip).limit(numericLimit).lean(),
    Medicine.countDocuments(query),
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

/**
 * Lightweight autocomplete for the prescription-writing UI. Deliberately
 * a separate query from `listMedicines` (the admin catalog table): fewer
 * fields, a tight result cap, and a prefix-biased sort so typing "para"
 * surfaces "Paracetamol" ahead of a brand that merely contains it —
 * `listMedicines`' admin table search is a full substring match by
 * design (staff scanning/filtering the whole catalog), which is the
 * wrong ranking for a doctor typing mid-prescription.
 */
export const autocompleteMedicines = async (q, limit = 10) => {
  const term = String(q || '').trim();
  if (!term) return [];

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixRegex = new RegExp(`^${escaped}`, 'i');
  const containsRegex = new RegExp(escaped, 'i');

  const query = {
    isDeleted: { $ne: true },
    isActive: true,
    $or: [
      { genericName: prefixRegex },
      { brandName: prefixRegex },
      { genericName: containsRegex },
      { brandName: containsRegex },
    ],
  };

  const projection = 'genericName brandName manufacturer strength unit dosageForm route dgdaCode packSize';

  const results = await Medicine.find(query).select(projection).limit(Math.min(limit, 25) * 3).lean();

  // Rank prefix matches first (regex alone can't express that ordering
  // across an $or without a second pass), then cap to the requested limit.
  results.sort((a, b) => {
    const aPrefix = prefixRegex.test(a.genericName) || prefixRegex.test(a.brandName || '');
    const bPrefix = prefixRegex.test(b.genericName) || prefixRegex.test(b.brandName || '');
    if (aPrefix === bPrefix) return 0;
    return aPrefix ? -1 : 1;
  });

  return results.slice(0, Math.min(limit, 25));
};

export const updateMedicine = async (id, updates, actor) => {
  const medicine = await findMedicineOrThrow(id);

  const protectedFields = ['_id', 'createdBy'];
  protectedFields.forEach((field) => delete updates[field]);

  Object.assign(medicine, updates, { updatedBy: actor._id });
  await medicine.save();

  logger.info(
    { event: 'medicine_updated', medicineId: medicine._id.toString(), updatedBy: String(actor._id) },
    'Medicine reference record updated.',
  );

  return medicine;
};

// Soft-deactivate — marks inactive but keeps document visible to Owner/SuperAdmin.
export const deactivateMedicine = async (id, actor) => {
  const medicine = await findMedicineOrThrow(id);
  medicine.isActive = false;
  medicine.updatedBy = actor._id;
  await medicine.save();

  logger.info(
    { event: 'medicine_deactivated', medicineId: medicine._id.toString(), deactivatedBy: String(actor._id) },
    'Medicine reference record deactivated.',
  );

  return medicine;
};

export const reactivateMedicine = async (id, actor) => {
  const medicine = await findMedicineOrThrow(id);
  medicine.isActive = true;
  medicine.updatedBy = actor._id;
  await medicine.save();
  return medicine;
};

/**
 * Soft-delete a medicine (marks isDeleted: true, hidden from regular staff).
 * For non-Owner/SuperAdmin roles — this is what "delete" means for them.
 */
export const softDeleteMedicine = async (id, actor) => {
  const medicine = await findMedicineOrThrow(id);
  medicine.isDeleted = true;
  medicine.deletedAt = new Date();
  medicine.deletedBy = actor._id;
  medicine.isActive = false;
  medicine.updatedBy = actor._id;
  await medicine.save();

  logger.info(
    { event: 'medicine_soft_deleted', medicineId: medicine._id.toString(), deletedBy: String(actor._id) },
    'Medicine reference record soft-deleted.',
  );

  return medicine;
};

/**
 * Permanent hard delete — exclusive to SOFTWARE_OWNER and SUPER_ADMIN.
 * Physically removes the document from the database collection.
 */
export const hardDeleteMedicine = async (id, actor) => {
  const isSuperOrOwner = actor.role === ROLES.SOFTWARE_OWNER || actor.role === ROLES.SUPER_ADMIN;
  if (!isSuperOrOwner) {
    throw new AppError('Only Software Owner or Super Admin can permanently delete medicines.', 403, {
      code: 'FORBIDDEN',
    });
  }

  const medicine = await findMedicineOrThrow(id, { includeDeleted: true });
  const medicineId = medicine._id.toString();

  await Medicine.deleteOne({ _id: medicine._id });

  logger.info(
    { event: 'medicine_hard_deleted', medicineId, deletedBy: String(actor._id) },
    'Medicine reference record permanently deleted from database.',
  );

  return { _id: medicineId, deletedPermanently: true };
};

/**
 * Restore a soft-deleted medicine — exclusive to SOFTWARE_OWNER and SUPER_ADMIN.
 */
export const restoreMedicine = async (id, actor) => {
  const isSuperOrOwner = actor.role === ROLES.SOFTWARE_OWNER || actor.role === ROLES.SUPER_ADMIN;
  if (!isSuperOrOwner) {
    throw new AppError('Only Software Owner or Super Admin can restore deleted medicines.', 403, {
      code: 'FORBIDDEN',
    });
  }

  const medicine = await findMedicineOrThrow(id, { includeDeleted: true });
  medicine.isDeleted = false;
  medicine.deletedAt = null;
  medicine.deletedBy = null;
  medicine.isActive = true;
  medicine.updatedBy = actor._id;
  await medicine.save();

  logger.info(
    { event: 'medicine_restored', medicineId: medicine._id.toString(), restoredBy: String(actor._id) },
    'Medicine reference record restored.',
  );

  return medicine;
};
