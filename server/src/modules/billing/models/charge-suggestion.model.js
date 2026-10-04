import mongoose from 'mongoose';

import { FEE_SERVICE_TYPES } from './fee.model.js';

/**
 * A lightweight, non-binding note a clinical user (a DOCTOR, most
 * often — see `permissions.js`) leaves for billing staff: "charge
 * this patient for X" — without creating an actual `Invoice`
 * themselves. This is the complement to DOCTOR now also holding
 * `INVOICES_WRITE` (full self-billing, `invoice.service.js`): a
 * doctor who'd rather not deal with line items/pricing right now can
 * instead flag the charge type and let reception (who still holds
 * `BILLING_WRITE`) finish the actual invoice.
 *
 * Deliberately its own tiny collection rather than a field bolted
 * onto `Prescription`/`Encounter` — a suggestion has its own small
 * lifecycle (PENDING → INVOICED/DISMISSED) that has nothing to do
 * with the clinical record's own lifecycle, and a patient can rack up
 * more than one of these before any of them are invoiced.
 */
export const CHARGE_SUGGESTION_STATUSES = Object.freeze(['PENDING', 'INVOICED', 'DISMISSED']);

const chargeSuggestionSchema = new mongoose.Schema(
  {
    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Optional context — which visit/record this charge relates to,
    // purely informational for whoever picks it up.
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter', default: null },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },

    serviceType: { type: String, enum: FEE_SERVICE_TYPES, required: true },
    // A suggested catalog price, purely a convenience prefill for
    // whoever builds the real invoice — never itself charged. The
    // actual `Invoice.items[].unitPrice` is always re-entered/
    // re-validated in `invoice.service.js`, same as every other
    // invoice-creation path (master prompt §80).
    fee: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },

    status: { type: String, enum: CHARGE_SUGGESTION_STATUSES, default: 'PENDING', index: true },

    suggestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Set once resolved (invoiced or dismissed).
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    dismissalReason: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

chargeSuggestionSchema.index({ patientProfile: 1, status: 1 });
chargeSuggestionSchema.index({ status: 1, createdAt: -1 });
chargeSuggestionSchema.index({ suggestedBy: 1, status: 1 });

export const ChargeSuggestion =
  mongoose.models.ChargeSuggestion || mongoose.model('ChargeSuggestion', chargeSuggestionSchema);
