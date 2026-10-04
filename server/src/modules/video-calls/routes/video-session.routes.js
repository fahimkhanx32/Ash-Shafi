import express from 'express';

import {
  createOrGetSessionController,
  getSessionController,
  recordConsentController,
  joinSessionController,
  leaveSessionController,
  endSessionController,
} from '../controllers/video-session.controller.js';
import * as videoValidation from '../validators/video-session.validation.js';
import { validateBody, validateParams } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

/**
 * BET-14 — Video Consultation.
 *
 * Gated on `APPOINTMENTS_READ`/`WRITE` — the same pair
 * `appointment.routes.js` uses, since a video session is always
 * scoped to exactly one appointment and `PATIENT` already holds both
 * for self-service booking. Ownership/participation is enforced in
 * the *service* layer (`getAppointmentById`'s `assertCanAccessAppointment`
 * for creation; `assertCanAccessSession`/`isSessionParticipant` for
 * everything else) — 404, not 403, on a mismatch, so a session or
 * appointment id can never be used to enumerate another patient's
 * video consultation (master prompt §30/§80). No `staffOnly` gate is
 * needed here the way `appointment.routes.js` has one for
 * confirm/no-show — every mutating action here (`join`/`leave`/`end`/
 * `consent`) already carries its own stricter, service-layer
 * participant/role check.
 */

const router = express.Router();

router.use(authenticate);

router.post(
  '/appointments/:appointmentId/session',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(videoValidation.appointmentIdParamSchema),
  createOrGetSessionController,
);

router.get(
  '/sessions/:id',
  authorize(PERMISSIONS.APPOINTMENTS_READ),
  validateParams(videoValidation.sessionIdParamSchema),
  getSessionController,
);

router.post(
  '/sessions/:id/consent',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(videoValidation.sessionIdParamSchema),
  recordConsentController,
);

router.post(
  '/sessions/:id/join',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(videoValidation.sessionIdParamSchema),
  joinSessionController,
);

router.post(
  '/sessions/:id/leave',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(videoValidation.sessionIdParamSchema),
  leaveSessionController,
);

router.post(
  '/sessions/:id/end',
  authorize(PERMISSIONS.APPOINTMENTS_WRITE),
  validateParams(videoValidation.sessionIdParamSchema),
  validateBody(videoValidation.endSessionSchema),
  endSessionController,
);

export default router;
