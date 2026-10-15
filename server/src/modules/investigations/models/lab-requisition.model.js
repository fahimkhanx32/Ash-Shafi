import mongoose from 'mongoose';

/**
 * LabRequisition — A single requisition form = one order event with
 * multiple tests ticked at once, matching the paper Bangladesh hospital
 * requisition form. One requisition may contain any number of tests across
 * any categories.
 *
 * Mirrors the Prescription pattern: walk-in patients are supported via
 * an auto-created PatientProfile (same as prescription.service.js walk-in
 * flow), and the requisition stores a patientSnapshot so the printed
 * document is self-contained even if the patient profile changes.
 */

export const LAB_REQUISITION_STATUSES = Object.freeze(['DRAFT', 'ISSUED', 'CANCELLED']);
export const LAB_REQUISITION_PRIORITIES = Object.freeze(['ROUTINE', 'URGENT', 'STAT']);

const requisitionTestSchema = new mongoose.Schema(
  {
    code:     { type: String, required: true, trim: true, maxlength: 40 },
    name:     { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    costBDT:  { type: Number, default: 0, min: 0 },
    notes:    { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false },
);

const labRequisitionSchema = new mongoose.Schema(
  {
    // Human-friendly ref e.g. REQ-20260829-0001
    requisitionReference: {
      type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40,
    },

    patientProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', required: true, index: true },
    patient:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',            required: true, index: true },
    orderedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',            required: true, index: true },

    // Optional links
    encounter:    { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter',    default: null },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },

    // Tests ticked on this requisition
    tests: { type: [requisitionTestSchema], default: [] },

    // Form-level fields (appear on the printed paper)
    clinicalDiagnosis: { type: String, trim: true, maxlength: 500, default: '' },
    priority:          { type: String, enum: LAB_REQUISITION_PRIORITIES, default: 'ROUTINE' },
    notes:             { type: String, trim: true, maxlength: 1000, default: '' },

    // Admission/logistics blanks on the printed paper form that carry no
    // clinical meaning and aren't derived from any other record (unlike
    // patientSnapshot/doctorSnapshot below, which ARE derived and
    // therefore stay non-editable on the document) — filled in directly
    // by whoever is issuing the requisition.
    admissionDetails: {
      cabinSemiCabin: { type: String, trim: true, maxlength: 60, default: '' },
      opdWardNo:      { type: String, trim: true, maxlength: 60, default: '' },
      bedNo:          { type: String, trim: true, maxlength: 30, default: '' },
      payingStatus:   { type: String, trim: true, maxlength: 30, default: '' },
    },

    // Computed total cost in BDT (sum of all tests)
    totalCostBDT: { type: Number, default: 0, min: 0 },

    status:   { type: String, enum: LAB_REQUISITION_STATUSES, default: 'DRAFT', index: true },
    issuedAt: { type: Date, default: null },

    cancellationReason: { type: String, trim: true, maxlength: 500, default: '' },
    cancelledAt:        { type: Date, default: null },
    cancelledBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Snapshot at requisition time (so the printed form is always accurate)
    patientSnapshot: {
      name:        { type: String, default: '' },
      patientId:   { type: String, default: '' },
      age:         { type: String, default: '' },
      sex:         { type: String, default: '' },
      phone:       { type: String, default: '' },
      bloodGroup:  { type: String, default: '' },
      address:     { type: String, default: '' },
    },
    // The doctor this requisition is "Referred by" — chosen from a dropdown
    // (defaults to the ordering doctor). doctorSnapshot below is built from them.
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    doctorSnapshot: {
      name:           { type: String, default: '' },
      qualifications: { type: String, default: '' },
      bmdc:           { type: String, default: '' },
      chamberAddress: { type: String, default: '' },
      phone:          { type: String, default: '' },
      email:          { type: String, default: '' },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

labRequisitionSchema.index({ patientProfile: 1, createdAt: -1 });
labRequisitionSchema.index({ patient: 1, createdAt: -1 });
labRequisitionSchema.index({ orderedBy: 1, createdAt: -1 });
labRequisitionSchema.index({ status: 1, createdAt: -1 });

export const LabRequisition = mongoose.model('LabRequisition', labRequisitionSchema, 'lab_requisitions');
