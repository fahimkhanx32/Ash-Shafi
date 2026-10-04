import { PERMISSIONS } from '../../../security/permissions.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';
import { AUDIT_CATEGORIES } from '../../../audit/audit.model.js';

import { searchPatient, getPatientSummary } from './patient.tools.js';
import { searchMedicine } from './medicine.tools.js';
import { searchInvestigation } from './investigation.tools.js';
import {
  createPrescriptionTool,
  getCurrentPrescriptionTool,
  addMedicineToPrescriptionTool,
  updateMedicineOnPrescriptionTool,
  removeMedicineFromPrescriptionTool,
  savePrescriptionTool,
  prescriptionPatientGuard,
  previewCancelPrescription,
  cancelPrescriptionTool,
  removeInvestigationFromPrescriptionTool,
  addInvestigationToPrescriptionTool,
  addDiagnosisToPrescriptionTool,
  updateVitalsTool,
  addAdviceTool,
  addClinicalNoteTool,
  updateClinicalNoteTool,
  setFollowUpTool,
  finalizePrescriptionTool,
  generatePrescriptionPdfTool,
} from './prescription.tools.js';
import { getAssistantProfileTool, setAssistantNameTool } from './assistant-profile.tools.js';
import {
  searchAppointmentsTool,
  getAvailableSlotsTool,
  bookAppointmentTool,
  confirmAppointmentTool,
  rescheduleAppointmentTool,
  cancelAppointmentTool,
} from './appointment.tools.js';
import {
  invoicePatientGuard,
  paymentPatientGuard,
  searchFeeTool,
  getInvoiceTool,
  getOutstandingBalanceTool,
  previewApplyInvoiceDiscount,
  applyInvoiceDiscountTool,
  previewAddInvoiceItem,
  addInvoiceItemTool,
  previewRemoveInvoiceItem,
  removeInvoiceItemTool,
  previewCancelInvoice,
  cancelInvoiceTool,
  previewRefundPayment,
  refundPaymentTool,
  createInvoiceTool,
  previewCreateInvoice,
  recordPaymentTool,
  previewRecordPayment,
} from './billing.tools.js';
import {
  labRequisitionPatientGuard,
  createLabRequisitionTool,
  getLabRequisitionTool,
  updateLabRequisitionTool,
  issueLabRequisitionTool,
  previewIssueLabRequisition,
  cancelLabRequisitionTool,
  previewCancelLabRequisition,
} from './lab.tools.js';

export const RISK_LEVELS = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' });

/**
 * Every entry:
 *   - `permission`: a `PERMISSIONS.*` constant, or `null` for "any
 *     authenticated user" (mirrors an existing route's own gate,
 *     documented per tool below — never a stricter or looser rule
 *     invented for the voice path specifically, master prompt §9).
 *   - `risk`: master prompt §28. HIGH tools are refused by the
 *     dispatcher (`services/voice-tool-executor.service.js`) unless
 *     the validated args include `confirmed: true`.
 *   - `audit`: `{ category, action }` from the existing
 *     `server/src/audit` infra, or `null` for read-only tools that
 *     mirror the project's existing convention of not auditing plain
 *     reads (see the comment on the AI_* actions in
 *     `audit.constants.js`).
 *   - `handler(args, actor)`: the real function; always a thin call
 *     into an existing service, never new business logic.
 */
export const VOICE_TOOL_REGISTRY = Object.freeze({
  // --- Patient (read-only) ---
  search_patient: {
    permission: PERMISSIONS.PATIENTS_READ,
    risk: RISK_LEVELS.LOW,
    audit: { category: AUDIT_CATEGORIES.CLINICAL_ACCESS, action: AUDIT_ACTIONS.AI_SEARCH_PATIENT },
    handler: searchPatient,
  },
  get_patient_summary: {
    permission: PERMISSIONS.PATIENTS_READ,
    risk: RISK_LEVELS.LOW,
    audit: { category: AUDIT_CATEGORIES.CLINICAL_ACCESS, action: AUDIT_ACTIONS.PATIENT_RECORD_VIEW },
    handler: getPatientSummary,
  },

  // --- Medicine / investigation search (read-only) ---
  search_medicine: {
    // Mirrors `medicine.routes.js`'s own router-wide gate, which
    // reuses PRESCRIPTIONS_READ rather than a separate medicines:*
    // permission (see that file's docstring).
    permission: PERMISSIONS.PRESCRIPTIONS_READ,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: searchMedicine,
  },
  search_investigation: {
    // Mirrors `GET /lab-requisitions/catalog`: any authenticated
    // user, no extra permission.
    permission: null,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: searchInvestigation,
  },

  // --- Prescription (write) ---
  create_prescription: {
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_CREATE, action: AUDIT_ACTIONS.AI_CREATE_PRESCRIPTION },
    handler: createPrescriptionTool,
  },
  get_current_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_READ,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: getCurrentPrescriptionTool,
  },
  add_medicine_to_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_ADD_MEDICINE },
    handler: addMedicineToPrescriptionTool,
  },
  update_medicine_on_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_UPDATE_MEDICINE },
    handler: updateMedicineOnPrescriptionTool,
  },
  remove_medicine_from_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_REMOVE_MEDICINE },
    handler: removeMedicineFromPrescriptionTool,
  },
  remove_investigation_from_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_REMOVE_INVESTIGATION },
    handler: removeInvestigationFromPrescriptionTool,
  },
  add_investigation_to_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_ADD_INVESTIGATION },
    handler: addInvestigationToPrescriptionTool,
  },
  add_diagnosis_to_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_ADD_DIAGNOSIS },
    handler: addDiagnosisToPrescriptionTool,
  },
  update_vitals: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_UPDATE_VITALS },
    handler: updateVitalsTool,
  },
  add_advice: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_ADD_ADVICE },
    handler: addAdviceTool,
  },
  add_clinical_note: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_UPDATE_CLINICAL_NOTE },
    handler: addClinicalNoteTool,
  },
  update_clinical_note: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_UPDATE_CLINICAL_NOTE },
    handler: updateClinicalNoteTool,
  },
  set_follow_up: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_SET_FOLLOW_UP },
    handler: setFollowUpTool,
  },
  finalize_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.HIGH,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_FINALIZE_PRESCRIPTION },
    handler: finalizePrescriptionTool,
  },
  // Read-back: drafts are persisted on every edit, so "save" writes nothing
  // (see `savePrescriptionTool`). Gated like the edits it confirms.
  save_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: savePrescriptionTool,
  },
  cancel_prescription: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_WRITE,
    risk: RISK_LEVELS.HIGH,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_CANCEL_PRESCRIPTION },
    preview: previewCancelPrescription,
    handler: cancelPrescriptionTool,
  },
  generate_prescription_pdf: {
    guard: prescriptionPatientGuard,
    permission: PERMISSIONS.PRESCRIPTIONS_READ,
    risk: RISK_LEVELS.LOW,
    audit: { category: AUDIT_CATEGORIES.CLINICAL_ACCESS, action: AUDIT_ACTIONS.AI_GENERATE_PRESCRIPTION_PDF },
    handler: generatePrescriptionPdfTool,
  },

  // --- Appointments (master prompt §21). Permissions mirror
  // `appointment.routes.js`: APPOINTMENTS_READ for reads,
  // APPOINTMENTS_WRITE for every mutation. Availability is read-only
  // and reuses the same function booking itself validates against.
  search_appointments: {
    permission: PERMISSIONS.APPOINTMENTS_READ,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: searchAppointmentsTool,
  },
  get_available_slots: {
    permission: PERMISSIONS.APPOINTMENTS_READ,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: getAvailableSlotsTool,
  },
  book_appointment: {
    permission: PERMISSIONS.APPOINTMENTS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_CREATE, action: AUDIT_ACTIONS.AI_BOOK_APPOINTMENT },
    handler: bookAppointmentTool,
  },
  confirm_appointment: {
    permission: PERMISSIONS.APPOINTMENTS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_CONFIRM_APPOINTMENT },
    handler: confirmAppointmentTool,
  },
  reschedule_appointment: {
    permission: PERMISSIONS.APPOINTMENTS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_RESCHEDULE_APPOINTMENT },
    handler: rescheduleAppointmentTool,
  },
  cancel_appointment: {
    permission: PERMISSIONS.APPOINTMENTS_WRITE,
    risk: RISK_LEVELS.HIGH, // master prompt §28: cancelling an appointment needs explicit confirmation
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_CANCEL_APPOINTMENT },
    handler: cancelAppointmentTool,
  },

  // --- Billing (master prompt §19/§20/§40). Permissions mirror
  // `billing.routes.js` / `payment.routes.js`. Writes are HIGH risk
  // with a read-only `preview` so the doctor confirms the real
  // total/balance before anything is committed. Discount, refund,
  // invoice-item add/remove and cancellation all reuse the same
  // edit-window rule the service enforces (no edits once a payment is
  // recorded) — that rule lives once, in
  // `billing/services/invoice.service.js`, not duplicated here. ---
  search_fee: {
    permission: null, // `GET /billing/fees` is open to any authenticated user
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: searchFeeTool,
  },
  get_invoice: {
    guard: invoicePatientGuard,
    permission: PERMISSIONS.BILLING_READ,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: getInvoiceTool,
  },
  get_outstanding_balance: {
    permission: PERMISSIONS.BILLING_READ,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: getOutstandingBalanceTool,
  },
  create_invoice: {
    permission: [PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE],
    risk: RISK_LEVELS.HIGH,
    idempotent: true,
    audit: { category: AUDIT_CATEGORIES.RECORD_CREATE, action: AUDIT_ACTIONS.AI_CREATE_INVOICE },
    preview: previewCreateInvoice,
    handler: createInvoiceTool,
  },
  record_payment: {
    guard: invoicePatientGuard,
    permission: PERMISSIONS.BILLING_WRITE,
    risk: RISK_LEVELS.HIGH,
    idempotent: true,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_RECORD_PAYMENT },
    preview: previewRecordPayment,
    handler: recordPaymentTool,
  },

  apply_invoice_discount: {
    guard: invoicePatientGuard,
    permission: [PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE], // mirrors PATCH /billing/invoices/:id/discount
    risk: RISK_LEVELS.HIGH,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_APPLY_INVOICE_DISCOUNT },
    preview: previewApplyInvoiceDiscount,
    handler: applyInvoiceDiscountTool,
  },
  // checkpoint 18 — billing/services/invoice.service.js gained
  // addInvoiceItem/removeInvoiceItem/cancelInvoice (no such service
  // existed before; see docs §13). Same edit-window rules as
  // apply_invoice_discount: refused once the invoice has any payment
  // recorded — record_payment/refund_payment are the only path once
  // money has moved, per master prompt §80/§30.
  add_invoice_item: {
    guard: invoicePatientGuard,
    permission: [PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE], // mirrors POST /billing/invoices/:id/items
    risk: RISK_LEVELS.HIGH,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_ADD_INVOICE_ITEM },
    preview: previewAddInvoiceItem,
    handler: addInvoiceItemTool,
  },
  remove_invoice_item: {
    guard: invoicePatientGuard,
    permission: [PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE], // mirrors DELETE /billing/invoices/:id/items/:itemId
    risk: RISK_LEVELS.HIGH,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_REMOVE_INVOICE_ITEM },
    preview: previewRemoveInvoiceItem,
    handler: removeInvoiceItemTool,
  },
  cancel_invoice: {
    guard: invoicePatientGuard,
    permission: [PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICES_WRITE], // mirrors POST /billing/invoices/:id/cancel
    risk: RISK_LEVELS.HIGH,
    idempotent: true,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_CANCEL_INVOICE },
    preview: previewCancelInvoice,
    handler: cancelInvoiceTool,
  },
  refund_payment: {
    guard: paymentPatientGuard,
    permission: PERMISSIONS.BILLING_WRITE, // mirrors POST /payments/:id/refund
    risk: RISK_LEVELS.HIGH,
    idempotent: true,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_REFUND_PAYMENT },
    preview: previewRefundPayment,
    handler: refundPaymentTool,
  },

  // --- Lab requisitions (master prompt §15/§41/§42). Permissions
  // mirror `investigation.routes.js` (INVESTIGATIONS_WRITE). Creating
  // makes a DRAFT (MEDIUM); issuing and cancelling are HIGH with a
  // read-only preview naming the real tests and total. ---
  get_lab_requisition: {
    guard: labRequisitionPatientGuard,
    permission: PERMISSIONS.INVESTIGATIONS_READ,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: getLabRequisitionTool,
  },
  create_lab_requisition: {
    permission: PERMISSIONS.INVESTIGATIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_CREATE, action: AUDIT_ACTIONS.AI_CREATE_LAB_REQUISITION },
    handler: createLabRequisitionTool,
  },
  update_lab_requisition: {
    guard: labRequisitionPatientGuard,
    permission: PERMISSIONS.INVESTIGATIONS_WRITE,
    risk: RISK_LEVELS.MEDIUM,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_UPDATE_LAB_REQUISITION },
    handler: updateLabRequisitionTool,
  },
  issue_lab_requisition: {
    guard: labRequisitionPatientGuard,
    permission: PERMISSIONS.INVESTIGATIONS_WRITE,
    risk: RISK_LEVELS.HIGH,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_ISSUE_LAB_REQUISITION },
    preview: previewIssueLabRequisition,
    handler: issueLabRequisitionTool,
  },
  cancel_lab_requisition: {
    guard: labRequisitionPatientGuard,
    permission: PERMISSIONS.INVESTIGATIONS_WRITE,
    risk: RISK_LEVELS.HIGH,
    audit: { category: AUDIT_CATEGORIES.RECORD_MODIFY, action: AUDIT_ACTIONS.AI_CANCEL_LAB_REQUISITION },
    preview: previewCancelLabRequisition,
    handler: cancelLabRequisitionTool,
  },

  // --- Assistant persona (naming master prompt) ---
  get_assistant_profile: {
    permission: null,
    risk: RISK_LEVELS.LOW,
    audit: null,
    handler: getAssistantProfileTool,
  },
  set_assistant_name: {
    permission: null,
    risk: RISK_LEVELS.LOW,
    audit: { category: AUDIT_CATEGORIES.USER_ACTION, action: AUDIT_ACTIONS.AI_ASSISTANT_NAME_CHANGE },
    handler: setAssistantNameTool,
  },
});
