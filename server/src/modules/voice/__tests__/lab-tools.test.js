import { jest } from '@jest/globals';

const mockCreateRequisition = jest.fn();
const mockIssueRequisition = jest.fn();
const mockCancelRequisition = jest.fn();
const mockGetRequisitionById = jest.fn();

jest.unstable_mockModule('../../investigations/services/lab-requisition.service.js', () => ({
  createRequisition: mockCreateRequisition,
  updateRequisition: jest.fn(),
  issueRequisition: mockIssueRequisition,
  cancelRequisition: mockCancelRequisition,
  getRequisitionById: mockGetRequisitionById,
}));
jest.unstable_mockModule('../../../audit/audit.service.js', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const { executeVoiceTool } = await import('../services/voice-tool-executor.service.js');

const doctor = { _id: 'doc1', role: 'DOCTOR' };
const patient = { _id: 'pat1', role: 'PATIENT' };
const PID = '507f1f77bcf86cd799439011';
const REQ = '507f1f77bcf86cd799439015';

const draft = (over = {}) => ({
  _id: 'r1',
  requisitionReference: 'LAB-1',
  status: 'DRAFT',
  priority: 'ROUTINE',
  totalCostBDT: 500,
  tests: [{ name: 'CBC (Including ESR)' }],
  ...over,
});

describe('lab requisition voice tools (services mocked, no live DB)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('create sends catalog name/category/cost — never anything from the agent', async () => {
    mockCreateRequisition.mockResolvedValue(draft());

    const result = await executeVoiceTool({
      toolName: 'create_lab_requisition',
      args: { patientProfileId: PID, testCodes: ['CBC_ESR'] },
      actor: doctor,
    });

    const [body] = mockCreateRequisition.mock.calls[0];
    expect(body.tests).toEqual([
      { code: 'CBC_ESR', name: 'CBC (Including ESR)', category: 'HEMATOLOGY', costBDT: 500 },
    ]);
    expect(body.walkIn).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/500 taka/);
    expect(result.message).toMatch(/draft/i);
  });

  test('an unknown test code is rejected and nothing is created', async () => {
    const result = await executeVoiceTool({
      toolName: 'create_lab_requisition',
      args: { patientProfileId: PID, testCodes: ['NOT_A_TEST'] },
      actor: doctor,
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/couldn't find a test/i);
    expect(mockCreateRequisition).not.toHaveBeenCalled();
  });

  test('issue without confirmed:true previews tests and total, and issues nothing', async () => {
    mockGetRequisitionById.mockResolvedValue(draft());
    const result = await executeVoiceTool({
      toolName: 'issue_lab_requisition',
      args: { requisitionId: REQ },
      actor: doctor,
    });
    expect(result.requiresConfirmation).toBe(true);
    expect(result.message).toMatch(/CBC \(Including ESR\)/);
    expect(result.message).toMatch(/500 taka/);
    expect(mockIssueRequisition).not.toHaveBeenCalled();
  });

  test('issue executes only with confirmed:true', async () => {
    mockIssueRequisition.mockResolvedValue(draft({ status: 'ISSUED' }));
    const result = await executeVoiceTool({
      toolName: 'issue_lab_requisition',
      args: { requisitionId: REQ, confirmed: true },
      actor: doctor,
    });
    expect(result.success).toBe(true);
    expect(mockIssueRequisition).toHaveBeenCalledWith(REQ, doctor);
  });

  test('an already-issued requisition is refused at preview, before asking for confirmation', async () => {
    mockGetRequisitionById.mockResolvedValue(draft({ status: 'ISSUED' }));
    const result = await executeVoiceTool({
      toolName: 'issue_lab_requisition',
      args: { requisitionId: REQ },
      actor: doctor,
    });
    expect(result.success).toBe(false);
    expect(result.requiresConfirmation).toBeUndefined();
    expect(result.message).toMatch(/already issued/i);
  });

  test('cancel is confirmation-gated and refuses an already-cancelled requisition', async () => {
    mockGetRequisitionById.mockResolvedValue(draft({ status: 'ISSUED' }));
    const preview = await executeVoiceTool({
      toolName: 'cancel_lab_requisition',
      args: { requisitionId: REQ },
      actor: doctor,
    });
    expect(preview.requiresConfirmation).toBe(true);
    expect(mockCancelRequisition).not.toHaveBeenCalled();

    mockGetRequisitionById.mockResolvedValue(draft({ status: 'CANCELLED' }));
    const already = await executeVoiceTool({
      toolName: 'cancel_lab_requisition',
      args: { requisitionId: REQ },
      actor: doctor,
    });
    expect(already.success).toBe(false);
    expect(already.message).toMatch(/already cancelled/i);
  });

  test('a role without INVESTIGATIONS_WRITE is denied every lab write tool', async () => {
    for (const [toolName, args] of [
      ['create_lab_requisition', { patientProfileId: PID, testCodes: ['CBC_ESR'] }],
      ['issue_lab_requisition', { requisitionId: REQ, confirmed: true }],
      ['cancel_lab_requisition', { requisitionId: REQ, confirmed: true }],
    ]) {
      const result = await executeVoiceTool({ toolName, args, actor: patient });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/permission/i);
    }
    expect(mockCreateRequisition).not.toHaveBeenCalled();
    expect(mockIssueRequisition).not.toHaveBeenCalled();
    expect(mockCancelRequisition).not.toHaveBeenCalled();
  });
});
