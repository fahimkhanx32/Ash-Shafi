import mongoose from 'mongoose';

import { Fee } from '../models/fee.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const findFeeOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid fee id.', 400, { code: 'INVALID_ID' });
  }

  const fee = await Fee.findById(id);

  if (!fee) {
    throw new AppError('Fee not found.', 404, { code: 'FEE_NOT_FOUND' });
  }

  return fee;
};

export const createFee = async ({ name, serviceType, description, amount, currency }, actor) => {
  const fee = new Fee({
    name,
    serviceType,
    description: description || '',
    amount,
    currency: currency || 'BDT',
    isActive: true,
    createdBy: actor._id,
  });

  await fee.save();

  logger.info({ feeId: fee._id, serviceType }, 'Fee created.');

  return fee;
};

export const updateFee = async (id, { name, description, amount, currency }, actor) => {
  const fee = await findFeeOrThrow(id);

  if (name !== undefined) fee.name = name;
  if (description !== undefined) fee.description = description;
  if (amount !== undefined) fee.amount = amount;
  if (currency !== undefined) fee.currency = currency;
  fee.updatedBy = actor._id;

  await fee.save();

  return fee;
};

export const setFeeActive = async (id, isActive, actor) => {
  const fee = await findFeeOrThrow(id);

  fee.isActive = isActive;
  fee.updatedBy = actor._id;

  await fee.save();

  return fee;
};

/**
 * Open to any authenticated user (master prompt §35/§86 — a patient
 * must be able to see prices before booking/paying), not gated behind
 * `BILLING_READ`. `includeInactive` is only honored for callers who
 * hold `BILLING_WRITE` (checked in the controller) — everyone else
 * always gets the active catalog only.
 */
export const listFees = async ({ serviceType, includeInactive = false } = {}) => {
  const filter = {};

  if (serviceType) filter.serviceType = serviceType;
  if (!includeInactive) filter.isActive = true;

  return Fee.find(filter).sort({ serviceType: 1, name: 1 });
};

export const getFeeById = (id) => findFeeOrThrow(id);
