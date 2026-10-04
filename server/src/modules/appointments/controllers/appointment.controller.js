import * as appointmentService from '../services/appointment.service.js';
import * as queueService from '../../queue/services/queue.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const bookAppointmentController = async (req, res, next) => {
  try {
    const appointment = await appointmentService.bookAppointment(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.APPOINTMENT_CREATE,
      resourceType: 'Appointment',
      resourceId: appointment?._id,
      patientId: appointment?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Appointment booked successfully.',
      data: appointment,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAppointmentController = async (req, res, next) => {
  try {
    const appointment = await appointmentService.getAppointmentById(req.params.id, req.user);
    return sendSuccess(res, { message: 'Appointment retrieved successfully.', data: appointment, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const listAppointmentsController = async (req, res, next) => {
  try {
    const { doctorId, patientProfileId, status, from, to, page, limit } = req.query;
    const { items, pagination } = await appointmentService.listAppointments({
      doctorId: doctorId || undefined,
      patientProfileId: patientProfileId || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      limit,
    });
    return sendPaginated(res, {
      message: 'Appointments retrieved successfully.',
      items,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyAppointmentsController = async (req, res, next) => {
  try {
    const { status, from, to, page, limit } = req.query;
    const { items, pagination } = await appointmentService.getMyAppointments(req.user, {
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendPaginated(res, {
      message: 'Appointments retrieved successfully.',
      items,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const confirmAppointmentController = async (req, res, next) => {
  try {
    const appointment = await appointmentService.confirmAppointment(req.params.id, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.APPOINTMENT_CONFIRM,
      resourceType: 'Appointment',
      resourceId: req.params.id,
      patientId: appointment?.patientProfile ?? null,
    });
    return sendSuccess(res, { message: 'Appointment confirmed successfully.', data: appointment, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const cancelAppointmentController = async (req, res, next) => {
  try {
    const appointment = await appointmentService.cancelAppointment(req.params.id, req.body.reason, req.user);
    // BET-10.18 — if this appointment had already been checked in,
    // release its queue token too so the queue and appointment
    // states can never drift apart.
    await queueService.cancelForAppointment(appointment._id, req.user, req.body.reason || 'Appointment cancelled.');
    await recordModification(req, {
      action: AUDIT_ACTIONS.APPOINTMENT_CANCEL,
      resourceType: 'Appointment',
      resourceId: req.params.id,
      patientId: appointment?.patientProfile ?? null,
      reason: req.body.reason ?? null,
    });
    return sendSuccess(res, { message: 'Appointment cancelled successfully.', data: appointment, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const rescheduleAppointmentController = async (req, res, next) => {
  try {
    const { original, replacement } = await appointmentService.rescheduleAppointment(req.params.id, req.body, req.user);
    // BET-10.18 — same cascade as cancellation: a rescheduled
    // appointment that had already been checked in must release its
    // queue token, since the visit now belongs to a new appointment.
    await queueService.cancelForAppointment(
      original._id,
      req.user,
      req.body.reason || 'Appointment rescheduled.',
    );
    await recordModification(req, {
      action: AUDIT_ACTIONS.APPOINTMENT_RESCHEDULE,
      resourceType: 'Appointment',
      resourceId: req.params.id,
      patientId: original?.patientProfile ?? replacement?.patientProfile ?? null,
      metadata: { replacementId: replacement?._id ?? null },
    });
    return sendSuccess(res, {
      message: 'Appointment rescheduled successfully.',
      data: { original, replacement },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const markNoShowController = async (req, res, next) => {
  try {
    const appointment = await appointmentService.markNoShow(req.params.id, req.user, { reason: req.body.reason });
    await recordModification(req, {
      action: AUDIT_ACTIONS.APPOINTMENT_NO_SHOW,
      resourceType: 'Appointment',
      resourceId: req.params.id,
      patientId: appointment?.patientProfile ?? null,
      reason: req.body.reason ?? null,
    });
    return sendSuccess(res, { message: 'Appointment marked as no-show.', data: appointment, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const getAppointmentHistoryController = async (req, res, next) => {
  try {
    const history = await appointmentService.getAppointmentHistory(req.params.id, req.user);
    return sendSuccess(res, { message: 'Appointment history retrieved successfully.', data: history, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};
