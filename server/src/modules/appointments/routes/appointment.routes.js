import express from 'express';

import {
  bookAppointmentController,
  getAppointmentController,
  listAppointmentsController,
  getMyAppointmentsController,
  confirmAppointmentController,
  cancelAppointmentController,
  rescheduleAppointmentController,
  markNoShowController,
  getAppointmentHistoryController,
} from '../controllers/appointment.controller.js';
import * as appointmentValidation from '../validators/appointment.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';

/**
 * BET-10.4 — Appointment Booking, BET-10.5 — Cancellation,
 * BET-10.6 — Rescheduling, BET-10.8 — Appointment States,
 * BET-10.9 — Appointment History.
 *
 * Gated on `APPOINTMENTS_READ`/`WRITE` — `PATIENT` holds both (for
 * self-booking, self-cancel, self-reschedule; `security/permissions.js`
 * already grants this deliberately, same as `schedule.routes.js`).
 * Ownership for a `PATIENT` actor is enforced in the *service* layer
 * (`assertCanAccessAppointment` — 404, not 403, on a mismatch, so an
 * appointment id can't be used to enumerate other patients' bookings —
 * master prompt §30/§80), not here — this router only adds the
 * coarser `staffOnly` gate on the handful of actions that should never
 * be patient-initiated at all (confirming/no-showing a booking),
 * regardless of whose id it is.
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
  '/me',
  validateQuery(appointmentValidation.myAppointmentsQuerySchema),
  getMyAppointmentsController,
);

router.post(
  '/',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateBody(appointmentValidation.bookAppointmentSchema),
  bookAppointmentController,
);

router.get(
  '/',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  staffOnly,
  validateQuery(appointmentValidation.listAppointmentsQuerySchema),
  listAppointmentsController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateParams(appointmentValidation.appointmentIdParamSchema),
  getAppointmentController,
);

router.get(
  '/:id/history',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateParams(appointmentValidation.appointmentIdParamSchema),
  getAppointmentHistoryController,
);

router.post(
  '/:id/confirm',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  staffOnly,
  validateParams(appointmentValidation.appointmentIdParamSchema),
  confirmAppointmentController,
);

router.post(
  '/:id/cancel',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(appointmentValidation.appointmentIdParamSchema),
  validateBody(appointmentValidation.cancelAppointmentSchema),
  cancelAppointmentController,
);

router.post(
  '/:id/reschedule',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(appointmentValidation.appointmentIdParamSchema),
  validateBody(appointmentValidation.rescheduleAppointmentSchema),
  rescheduleAppointmentController,
);

router.post(
  '/:id/no-show',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  staffOnly,
  validateParams(appointmentValidation.appointmentIdParamSchema),
  validateBody(appointmentValidation.noShowAppointmentSchema),
  markNoShowController,
);

export default router;
