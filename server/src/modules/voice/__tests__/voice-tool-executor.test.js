import { jest } from '@jest/globals';

import { executeVoiceTool } from '../services/voice-tool-executor.service.js';

// `recordAuditEvent` writes to Mongo; every case in this file is
// designed to resolve before a handler would touch the database, but
// the executor itself unconditionally logs permission denials, so we
// still need to stub the audit writer out for a DB-free unit test.
jest.unstable_mockModule('../../../audit/audit.service.js', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const { executeVoiceTool: executeVoiceToolMocked } = await import('../services/voice-tool-executor.service.js');

describe('voice-tool-executor — pure dispatch logic (no database required)', () => {
  const doctorActor = { _id: 'doc1', role: 'DOCTOR' };
  const patientActor = { _id: 'pat1', role: 'PATIENT' };

  test('rejects an unknown tool name without throwing', async () => {
    const result = await executeVoiceToolMocked({ toolName: 'delete_everything', args: {}, actor: doctorActor });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not a tool/i);
  });

  test('denies a tool when the actor role lacks the required permission', async () => {
    // PATIENT role has no PRESCRIPTIONS_WRITE grant in security/permissions.js.
    const result = await executeVoiceToolMocked({
      toolName: 'create_prescription',
      args: { patientProfileId: '507f1f77bcf86cd799439011' },
      actor: patientActor,
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/permission/i);
  });

  test('rejects invalid arguments via the Joi schema before any handler runs', async () => {
    const result = await executeVoiceToolMocked({
      toolName: 'create_prescription',
      args: { patientProfileId: 'not-a-valid-object-id' },
      actor: doctorActor,
    });
    expect(result.success).toBe(false);
  });

  test('a HIGH-risk tool without confirmed:true is refused with requiresConfirmation', async () => {
    const result = await executeVoiceToolMocked({
      toolName: 'finalize_prescription',
      args: { prescriptionId: '507f1f77bcf86cd799439011' },
      actor: doctorActor,
    });
    expect(result.success).toBe(false);
    expect(result.requiresConfirmation).toBe(true);
  });
});
