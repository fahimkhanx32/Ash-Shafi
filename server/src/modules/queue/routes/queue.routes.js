import express from 'express';

import {
  checkInController,
  getTodayQueueController,
  getQueueEntryController,
  getMyQueueStatusController,
  callPatientController,
  startConsultationController,
  completeConsultationController,
  markNoShowController,
} from '../controllers/queue.controller.js';
import * as queueValidation from '../validators/queue.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';

/**
 * BET-10.10 — Queue Management, BET-10.11 — Token Generation,
 * BET-10.12 — Check-in, BET-10.13 — Waiting & Queue Position,
 * BET-10.14 — Consultation State, BET-10.15 — Completed State,
 * BET-10.16 — No-show Management.
 *
 * Unlike `appointment.routes.js`, every route here is `staffOnly` —
 * the queue (master prompt §20: "a simple reception-friendly
 * interface") is a clinic-operations tool, not something a patient
 * drives themselves. Reused `APPOINTMENTS_READ`/`WRITE` rather than
 * adding a new `queue:*` permission pair — same "don't expand the
 * fixed RBAC catalog for something an existing permission already
 * covers conceptually" call `schedule.routes.js` made — and gated
 * out `PATIENT` here explicitly since that role holds
 * `APPOINTMENTS_READ`/`WRITE` only for self-service booking, not
 * queue operation.
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

/**
 * FET-12 (Patient Portal) self-service — deliberately registered
 * BEFORE `router.use(staffOnly)` below, since this is the one queue
 * route a `PATIENT` is meant to reach directly (master prompt §62:
 * "Queue status" is an explicit patient-dashboard bullet). Ownership
 * is enforced inside `queueService.getMyQueueStatus` itself (reuses
 * `appointmentService.getAppointmentById`'s existing check), not by
 * a route-level role gate — mirrors how `appointment.routes.js`
 * leaves `GET /:id` open to `PATIENT` and enforces ownership in the
 * service layer instead.
 */
router.get(
  '/me/:appointmentId',
  validateParams(queueValidation.appointmentIdParamSchema),
  getMyQueueStatusController,
);

router.use(staffOnly);

router.post(
  '/check-in/:appointmentId',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(queueValidation.appointmentIdParamSchema),
  validateBody(queueValidation.checkInSchema),
  checkInController,
);

router.get(
  '/today/:doctorId',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateParams(queueValidation.doctorIdParamSchema),
  validateQuery(queueValidation.todayQueueQuerySchema),
  getTodayQueueController,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateParams(queueValidation.queueEntryIdParamSchema),
  getQueueEntryController,
);

router.post(
  '/:id/call',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(queueValidation.queueEntryIdParamSchema),
  callPatientController,
);

router.post(
  '/:id/start-consultation',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(queueValidation.queueEntryIdParamSchema),
  startConsultationController,
);

router.post(
  '/:id/complete',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(queueValidation.queueEntryIdParamSchema),
  completeConsultationController,
);

router.post(
  '/:id/no-show',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(queueValidation.queueEntryIdParamSchema),
  validateBody(queueValidation.noShowSchema),
  markNoShowController,
);

export default router;
