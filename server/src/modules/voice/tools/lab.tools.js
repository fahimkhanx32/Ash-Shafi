import {
  createRequisition,
  updateRequisition,
  issueRequisition,
  cancelRequisition,
  getRequisitionById,
} from '../../investigations/services/lab-requisition.service.js';
import { TEST_CATALOG } from '../../investigations/models/test-catalog.js';
import { AppError } from '../../../middlewares/error.middleware.js';

const taka = (n) => `${Number(n).toLocaleString('en-US')} taka`;
const asPlain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {});

/**
 * Guard for requisition-scoped tools (checkpoint 16 — mirrors
 * `prescriptionPatientGuard` / `invoicePatientGuard`): if the call
 * names the patient currently open in the browser, the requisition
 * must actually belong to that patient. Uses the real
 * `getRequisitionById`, so its own access rules run first.
 */
export const labRequisitionPatientGuard = async ({ requisitionId, patientProfileId }, actor) => {
  if (!patientProfileId || !requisitionId) return;
  const requisition = asPlain(await getRequisitionById(requisitionId, actor));
  const owner = String(requisition.patientProfile?._id ?? requisition.patientProfile ?? '');
  if (owner !== String(patientProfileId)) {
    throw new AppError(
      'That lab requisition belongs to a different patient than the one that is open, so I have not touched it.',
      409,
      { code: 'REQUISITION_PATIENT_MISMATCH' },
    );
  }
};

const summarizeRequisition = (r) => ({
  requisitionId: String(r._id),
  reference: r.requisitionReference,
  status: r.status,
  priority: r.priority,
  totalCostBDT: r.totalCostBDT,
  tests: (r.tests || []).map((t) => t.name),
});

/**
 * Resolves every `testCode` against the real catalog and returns the
 * full test objects the service expects. Name, category and `costBDT`
 * always come from `TEST_CATALOG` — `createRequisition` would trust a
 * numeric `costBDT` it is handed, so the voice layer must never hand
 * it one the agent produced (master prompt §30/§41: use the existing
 * catalog and pricing, never invent a test or a price).
 */
const resolveTests = (testCodes) =>
  testCodes.map((code) => {
    const entry = TEST_CATALOG.find((t) => t.code === code);
    if (!entry) {
      throw new AppError(`I couldn't find a test with code "${code}" in the catalog.`, 404, { code: 'TEST_NOT_FOUND' });
    }
    return { code: entry.code, name: entry.name, category: entry.category, costBDT: entry.costBDT };
  });

/**
 * `create_lab_requisition` — creates a DRAFT only. Nothing reaches the
 * lab until `issue_lab_requisition` is confirmed (master prompt §42:
 * draft first, finalize after review).
 */
export const createLabRequisitionTool = async ({ patientProfileId, testCodes, priority, clinicalDiagnosis, prescriptionId }, actor) => {
  const tests = resolveTests(testCodes);
  const requisition = await createRequisition(
    { patientProfileId, tests, priority, clinicalDiagnosis, prescriptionId },
    actor,
  );
  return {
    success: true,
    action: 'create_lab_requisition',
    message: `I found ${tests.length} test${tests.length === 1 ? '' : 's'}: ${tests.map((t) => t.name).join(', ')}. The total is ${taka(requisition.totalCostBDT)}. It is saved as a draft — shall I issue it?`,
    requisition: summarizeRequisition(requisition),
  };
};

/** Read-only preview: names the tests and real total before anything is issued. */
export const previewIssueLabRequisition = async ({ requisitionId }, actor) => {
  const r = await getRequisitionById(requisitionId, actor);
  if (r.status !== 'DRAFT') {
    throw new AppError(`That requisition is already ${r.status.toLowerCase()}, so it can't be issued.`, 400, { code: 'INVALID_STATUS' });
  }
  return {
    message: `Issue requisition ${r.requisitionReference} for ${(r.tests || []).map((t) => t.name).join(', ')}, total ${taka(r.totalCostBDT)}? Shall I go ahead?`,
    preview: summarizeRequisition(r),
  };
};

export const issueLabRequisitionTool = async ({ requisitionId }, actor) => {
  const requisition = await issueRequisition(requisitionId, actor);
  return {
    success: true,
    action: 'issue_lab_requisition',
    message: 'The lab requisition has been issued.',
    requisition: summarizeRequisition(requisition),
  };
};

export const previewCancelLabRequisition = async ({ requisitionId }, actor) => {
  const r = await getRequisitionById(requisitionId, actor);
  if (r.status === 'CANCELLED') {
    throw new AppError('That requisition is already cancelled.', 400, { code: 'ALREADY_CANCELLED' });
  }
  return {
    message: `Cancel ${r.status.toLowerCase()} requisition ${r.requisitionReference} (${(r.tests || []).map((t) => t.name).join(', ')})? Shall I go ahead?`,
    preview: summarizeRequisition(r),
  };
};

export const cancelLabRequisitionTool = async ({ requisitionId, reason = '' }, actor) => {
  const requisition = await cancelRequisition(requisitionId, reason, actor);
  return {
    success: true,
    action: 'cancel_lab_requisition',
    message: 'The lab requisition has been cancelled.',
    requisition: summarizeRequisition(requisition),
  };
};

export const getLabRequisitionTool = async ({ requisitionId }, actor) => {
  const r = await getRequisitionById(requisitionId, actor);
  return {
    success: true,
    action: 'get_lab_requisition',
    message: `Requisition ${r.requisitionReference} is ${r.status.toLowerCase()}: ${(r.tests || []).map((t) => t.name).join(', ') || 'no tests'}.`,
    requisition: summarizeRequisition(r),
  };
};

/** DRAFT-only (the service refuses anything else). Tests are re-resolved from the catalog; prices never come from the agent. */
export const updateLabRequisitionTool = async ({ requisitionId, testCodes, priority, clinicalDiagnosis }, actor) => {
  const body = {};
  if (testCodes) body.tests = resolveTests(testCodes);
  if (priority) body.priority = priority;
  if (clinicalDiagnosis !== undefined) body.clinicalDiagnosis = clinicalDiagnosis;
  const requisition = await updateRequisition(requisitionId, body, actor);
  return {
    success: true,
    action: 'update_lab_requisition',
    message: `The draft requisition has been updated. The total is ${taka(requisition.totalCostBDT)}.`,
    requisition: summarizeRequisition(requisition),
  };
};
