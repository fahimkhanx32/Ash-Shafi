import * as queueService from '../services/queue.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';

export const checkInController = async (req, res, next) => {
  try {
    const entry = await queueService.checkIn(req.params.appointmentId, req.user, { notes: req.body.notes });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Patient checked in successfully.',
      data: entry,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getTodayQueueController = async (req, res, next) => {
  try {
    const queue = await queueService.getTodayQueue(req.params.doctorId, { date: req.query.date || undefined });
    return sendSuccess(res, { message: "Today's queue retrieved successfully.", data: queue, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const getQueueEntryController = async (req, res, next) => {
  try {
    const entry = await queueService.getQueueEntryById(req.params.id);
    return sendSuccess(res, { message: 'Queue entry retrieved successfully.', data: entry, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const getMyQueueStatusController = async (req, res, next) => {
  try {
    const entry = await queueService.getMyQueueStatus(req.params.appointmentId, req.user);
    return sendSuccess(res, { message: 'Queue status retrieved successfully.', data: entry, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const callPatientController = async (req, res, next) => {
  try {
    const entry = await queueService.callPatient(req.params.id, req.user);
    return sendSuccess(res, { message: 'Patient called.', data: entry, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const startConsultationController = async (req, res, next) => {
  try {
    const entry = await queueService.startConsultation(req.params.id, req.user);
    return sendSuccess(res, { message: 'Consultation started.', data: entry, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const completeConsultationController = async (req, res, next) => {
  try {
    const entry = await queueService.completeConsultation(req.params.id, req.user);
    return sendSuccess(res, { message: 'Consultation completed.', data: entry, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const markNoShowController = async (req, res, next) => {
  try {
    const entry = await queueService.markNoShow(req.params.id, req.user, { reason: req.body.reason });
    return sendSuccess(res, { message: 'Patient marked as no-show.', data: entry, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};
