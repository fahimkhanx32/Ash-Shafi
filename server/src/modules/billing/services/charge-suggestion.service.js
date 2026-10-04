import mongoose from 'mongoose';

import { ChargeSuggestion } from '../models/charge-suggestion.model.js';
import { Fee } from '../models/fee.model.js';
import { PatientProfile } from '../../patients/models/patient-profile.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { ROLES } from '../../../security/permissions.js';
import { logger } from '../../../config/logger.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createChargeSuggestion = async (
  { patientProfileId, serviceType, feeId, appointmentId, encounterId, prescriptionId, note },
  actor,
) => {
  const patientProfile = await PatientProfile.findById(patientProfileId);
  if (!patientProfile) {
    throw new AppError('Patient profile not found.', 404, { code: 'PATIENT_PROFILE_NOT_FOUND' });
  }

  if (feeId) {
    if (!isValidObjectId(feeId)) {
      throw new AppError('Invalid fee id.', 400, { code: 'INVALID_ID' });
    }
    const fee = await Fee.findById(feeId).select('_id');
    if (!fee) {
      throw new AppError('Fee not found.', 404, { code: 'FEE_NOT_FOUND' });
    }
  }

  const suggestion = await ChargeSuggestion.create({
    patientProfile: patientProfile._id,
    patient: patientProfile.user,
    appointment: appointmentId || null,
    encounter: encounterId || null,
    prescription: prescriptionId || null,
    serviceType,
    fee: feeId || null,
    note: note || '',
    suggestedBy: actor._id,
  });

  logger.info(
    { chargeSuggestionId: suggestion._id, patientProfileId, serviceType, suggestedBy: actor._id },
    'Charge suggestion created.',
  );

  return suggestion.populate([
    { path: 'patientProfile', select: 'user patientId firstName lastName' },
    { path: 'fee', select: 'name amount currency' },
    { path: 'suggestedBy', select: 'name email' },
  ]);
};

/**
 * Billing staff (BILLING_READ) see every pending suggestion clinic-
 * wide, to work through as a queue. A DOCTOR (who also holds
 * BILLING_READ now) only ever sees the ones they themselves raised —
 * this is their own "did reception pick this up yet" list, not a
 * clinic-wide billing view (that boundary stays with
 * `invoice.service.js`'s `listInvoices` scoping).
 */
export const listChargeSuggestions = async ({ patientProfileId, status, page = 1, limit = 20 }, actor) => {
  const filter = {};

  if (actor.role === ROLES.DOCTOR) {
    filter.suggestedBy = actor._id;
  }

  if (patientProfileId) {
    if (!isValidObjectId(patientProfileId)) {
      throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
    }
    filter.patientProfile = patientProfileId;
  }

  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ChargeSuggestion.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patientProfile', 'user patientId firstName lastName')
      .populate('fee', 'name amount currency')
      .populate('suggestedBy', 'name email'),
    ChargeSuggestion.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

const findSuggestionOrThrow = async (id) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid charge suggestion id.', 400, { code: 'INVALID_ID' });
  }
  const suggestion = await ChargeSuggestion.findById(id);
  if (!suggestion) {
    throw new AppError('Charge suggestion not found.', 404, { code: 'CHARGE_SUGGESTION_NOT_FOUND' });
  }
  return suggestion;
};

/**
 * A DOCTOR may only dismiss their own suggestion (they raised it, they
 * can withdraw it); billing staff (BILLING_WRITE) may dismiss any —
 * same shape as `invoice.service.js`'s ownership check.
 */
const assertCanResolve = (suggestion, actor) => {
  if (actor.role !== ROLES.DOCTOR) return true;
  return String(suggestion.suggestedBy) === String(actor._id);
};

export const dismissChargeSuggestion = async (id, { reason }, actor) => {
  const suggestion = await findSuggestionOrThrow(id);

  if (!assertCanResolve(suggestion, actor)) {
    throw new AppError('Charge suggestion not found.', 404, { code: 'CHARGE_SUGGESTION_NOT_FOUND' });
  }

  if (suggestion.status !== 'PENDING') {
    throw new AppError('Only a pending charge suggestion can be dismissed.', 409, {
      code: 'CHARGE_SUGGESTION_NOT_PENDING',
    });
  }

  suggestion.status = 'DISMISSED';
  suggestion.dismissalReason = reason || '';
  suggestion.resolvedBy = actor._id;
  suggestion.resolvedAt = new Date();

  await suggestion.save();

  return suggestion;
};

/**
 * Internal, cross-module entry point — called only by
 * `invoice.service.js`'s `createInvoice` once the invoice it's
 * resolving has actually been saved. Never called from a route
 * directly, mirroring the one-way-callback shape
 * `applyPaymentToInvoice`/`applyRefundToInvoice` already establish for
 * Invoice <-> Payment.
 */
export const markChargeSuggestionInvoiced = async (id, invoiceId, actor, session = null) => {
  const suggestion = await ChargeSuggestion.findById(id).session(session);
  if (!suggestion) {
    throw new AppError('Charge suggestion not found.', 404, { code: 'CHARGE_SUGGESTION_NOT_FOUND' });
  }
  if (suggestion.status !== 'PENDING') {
    throw new AppError('This charge suggestion was already resolved.', 409, {
      code: 'CHARGE_SUGGESTION_NOT_PENDING',
    });
  }

  suggestion.status = 'INVOICED';
  suggestion.invoice = invoiceId;
  suggestion.resolvedBy = actor?._id ?? null;
  suggestion.resolvedAt = new Date();

  await suggestion.save({ session });

  return suggestion;
};
