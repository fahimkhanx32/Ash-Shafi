import express from 'express';

import {
  getDoctorScheduleController,
  upsertDoctorScheduleController,
  deactivateDoctorScheduleController,
  getAvailableSlotsController,
  listBlockedDatesController,
  createBlockedDateController,
  removeBlockedDateController,
} from '../controllers/schedule.controller.js';
import * as scheduleValidation from '../validators/schedule.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';

/**
 * BET-10.1 — Doctor Schedules, BET-10.2 — Doctor Availability,
 * BET-10.3 — Appointment Slots, BET-10.7 — Holidays & Blocked Dates.
 *
 * Gated on `APPOINTMENTS_WRITE`/`READ` rather than adding a new
 * permission constant (master prompt §14/§93 — don't unnecessarily
 * expand the fixed RBAC catalog for something the existing
 * appointments permission already covers conceptually). That
 * permission is also granted to `PATIENT`, though — for self-booking
 * only — so schedule/holiday *management* additionally requires
 * `staffOnly` below. Reading available slots stays open to any
 * authenticated user (a patient must be able to see what's bookable
 * before booking).
 */

const staffOnly = (req, res, next) => {
  if (req.user.role === 'PATIENT') {
    return next(
      new AppError('This action is restricted to clinic staff.', 403, { code: 'PATIENT_ACTION_FORBIDDEN' }),
    );
  }
  return next();
};

const router = express.Router();

router.use(authenticate);

router.get(
  '/blocked-dates',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateQuery(scheduleValidation.listBlockedDatesQuerySchema),
  listBlockedDatesController,
);

router.post(
  '/blocked-dates',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  staffOnly,
  validateBody(scheduleValidation.createBlockedDateSchema),
  createBlockedDateController,
);

router.delete(
  '/blocked-dates/:id',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  staffOnly,
  validateParams(scheduleValidation.blockedDateIdParamSchema),
  removeBlockedDateController,
);

router.get(
  '/:doctorId',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateParams(scheduleValidation.doctorIdParamSchema),
  getDoctorScheduleController,
);

router.put(
  '/:doctorId',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  staffOnly,
  validateParams(scheduleValidation.doctorIdParamSchema),
  validateBody(scheduleValidation.upsertScheduleSchema),
  upsertDoctorScheduleController,
);

router.post(
  '/:doctorId/deactivate',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  staffOnly,
  validateParams(scheduleValidation.doctorIdParamSchema),
  deactivateDoctorScheduleController,
);

router.get(
  '/:doctorId/available-slots',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateParams(scheduleValidation.doctorIdParamSchema),
  validateQuery(scheduleValidation.availabilityQuerySchema),
  getAvailableSlotsController,
);

export default router;
