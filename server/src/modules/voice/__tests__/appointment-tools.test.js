import { jest } from '@jest/globals';

const mockListAppointments = jest.fn();
const mockBookAppointment = jest.fn();
const mockConfirmAppointment = jest.fn();
const mockCancelAppointment = jest.fn();
const mockRescheduleAppointment = jest.fn();
const mockGetAvailableSlots = jest.fn();

jest.unstable_mockModule('../../appointments/services/appointment.service.js', () => ({
  listAppointments: mockListAppointments,
  bookAppointment: mockBookAppointment,
  confirmAppointment: mockConfirmAppointment,
  cancelAppointment: mockCancelAppointment,
  rescheduleAppointment: mockRescheduleAppointment,
}));
jest.unstable_mockModule('../../appointments/services/availability.service.js', () => ({
  getAvailableSlots: mockGetAvailableSlots,
}));
jest.unstable_mockModule('../../../audit/audit.service.js', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const {
  searchAppointmentsTool,
  getAvailableSlotsTool,
  confirmAppointmentTool,
  rescheduleAppointmentTool,
} = await import('../tools/appointment.tools.js');
const { executeVoiceTool } = await import('../services/voice-tool-executor.service.js');

const doctor = { _id: 'doc1', role: 'DOCTOR' };
const patient = { _id: 'pat1', role: 'PATIENT' };
const OID = '507f1f77bcf86cd799439011';

describe('appointment.tools.js (services mocked, no live DB)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('search defaults a DOCTOR caller to their own schedule', async () => {
    mockListAppointments.mockResolvedValue({ items: [] });
    await searchAppointmentsTool({ limit: 5 }, doctor);
    expect(mockListAppointments).toHaveBeenCalledWith(expect.objectContaining({ doctorId: 'doc1', limit: 5 }));
  });

  test('search honours an explicitly named doctor over the default', async () => {
    mockListAppointments.mockResolvedValue({ items: [] });
    await searchAppointmentsTool({ doctorId: OID }, doctor);
    expect(mockListAppointments).toHaveBeenCalledWith(expect.objectContaining({ doctorId: OID }));
  });

  test('a PATIENT caller is refused search and confirm, mirroring the REST staffOnly gate', async () => {
    await expect(searchAppointmentsTool({}, patient)).rejects.toThrow(/restricted to clinic staff/i);
    await expect(confirmAppointmentTool({ appointmentId: OID }, patient)).rejects.toThrow(/restricted/i);
    expect(mockListAppointments).not.toHaveBeenCalled();
    expect(mockConfirmAppointment).not.toHaveBeenCalled();
  });

  test('reschedule reports the REPLACEMENT booking (service returns { original, replacement })', async () => {
    mockRescheduleAppointment.mockResolvedValue({
      original: { _id: 'a1', status: 'RESCHEDULED' },
      replacement: { _id: 'a2', status: 'SCHEDULED', scheduledStart: '2026-10-01T11:00:00Z' },
    });
    const result = await rescheduleAppointmentTool(
      { appointmentId: OID, scheduledStart: '2026-10-01T11:00:00Z' },
      doctor,
    );
    expect(result.appointment.appointmentId).toBe('a2');
    expect(result.appointment.status).toBe('SCHEDULED');
  });

  test('available slots returns only open ones and surfaces the reason when none', async () => {
    mockGetAvailableSlots.mockResolvedValue({
      slots: [
        { start: 's1', end: 'e1', available: true },
        { start: 's2', end: 'e2', available: false },
      ],
      reason: null,
    });
    const open = await getAvailableSlotsTool({ doctorId: OID, date: '2026-10-01' });
    expect(open.slots).toEqual([{ start: 's1', end: 'e1' }]);

    mockGetAvailableSlots.mockResolvedValue({ slots: [], reason: 'BLOCKED_DATE' });
    const none = await getAvailableSlotsTool({ doctorId: OID, date: '2026-10-02' });
    expect(none.message).toMatch(/BLOCKED_DATE/);
  });
});

describe('cancel_appointment through the executor (HIGH risk)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('is refused without confirmed:true and never reaches the service', async () => {
    const result = await executeVoiceTool({
      toolName: 'cancel_appointment',
      args: { appointmentId: OID },
      actor: doctor,
    });
    expect(result.success).toBe(false);
    expect(result.requiresConfirmation).toBe(true);
    expect(mockCancelAppointment).not.toHaveBeenCalled();
  });

  test('executes once confirmed:true is sent', async () => {
    mockCancelAppointment.mockResolvedValue({ _id: 'a1', status: 'CANCELLED' });
    const result = await executeVoiceTool({
      toolName: 'cancel_appointment',
      args: { appointmentId: OID, reason: 'Patient request', confirmed: true },
      actor: doctor,
    });
    expect(result.success).toBe(true);
    expect(mockCancelAppointment).toHaveBeenCalledWith(OID, 'Patient request', doctor);
  });
});
