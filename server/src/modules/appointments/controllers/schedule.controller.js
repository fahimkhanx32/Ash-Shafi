import * as scheduleService from '../services/schedule.service.js';
import * as availabilityService from '../services/availability.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification, recordDeletion } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const getDoctorScheduleController = async (req, res, next) => {
  try {
    const schedule = await scheduleService.getDoctorSchedule(req.params.doctorId);
    return sendSuccess(res, { message: 'Doctor schedule retrieved successfully.', data: schedule, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const upsertDoctorScheduleController = async (req, res, next) => {
  try {
    const schedule = await scheduleService.upsertDoctorSchedule(req.params.doctorId, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.DOCTOR_SCHEDULE_UPSERT,
      resourceType: 'DoctorSchedule',
      resourceId: schedule?._id ?? req.params.doctorId,
      metadata: { doctorId: req.params.doctorId },
    });

    return sendSuccess(res, { message: 'Doctor schedule saved successfully.', data: schedule, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const deactivateDoctorScheduleController = async (req, res, next) => {
  try {
    const schedule = await scheduleService.deactivateDoctorSchedule(req.params.doctorId, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.DOCTOR_SCHEDULE_DEACTIVATE,
      resourceType: 'DoctorSchedule',
      resourceId: schedule?._id ?? req.params.doctorId,
      metadata: { doctorId: req.params.doctorId },
    });

    return sendSuccess(res, { message: 'Doctor schedule deactivated successfully.', data: schedule, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const getAvailableSlotsController = async (req, res, next) => {
  try {
    const result = await availabilityService.getAvailableSlots(req.params.doctorId, req.query.date);
    return sendSuccess(res, { message: 'Available slots retrieved successfully.', data: result, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const listBlockedDatesController = async (req, res, next) => {
  try {
    const { doctorId, from, to } = req.query;
    const blockedDates = await scheduleService.listBlockedDates({
      doctorId: doctorId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    return sendSuccess(res, { message: 'Blocked dates retrieved successfully.', data: blockedDates, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const createBlockedDateController = async (req, res, next) => {
  try {
    const blockedDate = await scheduleService.createBlockedDate(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.BLOCKED_DATE_CREATE,
      resourceType: 'BlockedDate',
      resourceId: blockedDate?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Blocked date created successfully.',
      data: blockedDate,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeBlockedDateController = async (req, res, next) => {
  try {
    await scheduleService.removeBlockedDate(req.params.id, req.user);

    await recordDeletion(req, {
      action: AUDIT_ACTIONS.BLOCKED_DATE_REMOVE,
      resourceType: 'BlockedDate',
      resourceId: req.params.id,
    });

    return sendSuccess(res, { message: 'Blocked date removed successfully.', requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};
