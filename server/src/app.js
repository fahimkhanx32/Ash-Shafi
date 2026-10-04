import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import authRoutes from './auth/auth.routes.js';
import healthRoutes from './health/health.routes.js';
import roleRoutes from './modules/roles/routes/role.routes.js';
import permissionRoutes from './modules/permissions/routes/permission.routes.js';
import staffRoutes from './modules/staff/routes/staff.routes.js';
import departmentRoutes from './modules/departments/routes/department.routes.js';
import userRoutes from './modules/users/routes/user.routes.js';
import patientRoutes from './modules/patients/routes/patient.routes.js';
import gynecologyRoutes from './modules/gynecology/routes/gynecology.routes.js';
import pregnancyRoutes from './modules/obstetrics/routes/pregnancy.routes.js';
import cmsRoutes from './modules/cms/routes/cms.routes.js';
import dynamicSiteRoutes from './modules/cms/routes/dynamic-site.routes.js';
import contactRoutes from './modules/cms/routes/contact.routes.js';
import integrationRoutes from './modules/integrations/routes/integration.routes.js';
import encounterRoutes from './modules/encounters/routes/encounter.routes.js';
import scheduleRoutes from './modules/appointments/routes/schedule.routes.js';
import appointmentRoutes from './modules/appointments/routes/appointment.routes.js';
import queueRoutes from './modules/queue/routes/queue.routes.js';
import medicineRoutes from './modules/medicines/routes/medicine.routes.js';
import prescriptionRoutes from './modules/prescriptions/routes/prescription.routes.js';
import investigationRoutes, { labRequisitionRouter } from './modules/investigations/routes/investigation.routes.js';
import voiceRoutes from './modules/voice/routes/voice.routes.js';
import reportRoutes from './modules/reports/routes/report.routes.js';
import conversationRoutes from './modules/messaging/routes/conversation.routes.js';
import messageRoutes from './modules/messaging/routes/message.routes.js';
import notificationRoutes from './modules/notifications/routes/notification.routes.js';
import billingRoutes from './modules/billing/routes/billing.routes.js';
import paymentRoutes from './modules/payments/routes/payment.routes.js';
import videoCallRoutes from './modules/video-calls/routes/video-session.routes.js';
import dataLifecycleRoutes from './modules/data-lifecycle/routes/data-lifecycle.routes.js';
import backupRoutes from './modules/backups/routes/backup.routes.js';
import fhirRoutes from './modules/fhir/routes/fhir.routes.js';
import exportRoutes from './modules/exports/routes/export.routes.js';
import importRoutes from './modules/imports/routes/import.routes.js';
import analyticsRoutes from './modules/analytics/routes/analytics.routes.js';
import auditLogRoutes from './modules/audit-logs/routes/audit-log.routes.js';
import securityAdminRoutes from './modules/security-admin/routes/security-admin.routes.js';

import env from './config/env.js';
import { logger } from './config/logger.js';
import { corsOptions } from './config/cors.js';
import corsLib from 'cors';
import {
  securityHeaders,
  securitySanitizers,
} from './config/security.js';

import {
  generalRateLimiter,
} from './middlewares/rate-limit.middleware.js';

import {
  auditMiddleware,
} from './middlewares/audit.middleware.js';

import { metricsMiddleware } from './middlewares/metrics.middleware.js';

import {
  notFoundMiddleware,
  errorMiddleware,
} from './middlewares/error.middleware.js';

const app = express();

app.disable('x-powered-by');

app.set('trust proxy', 1);

// Secure HTTP headers (helmet).
securityHeaders.forEach((middleware) => app.use(middleware));

// CORS, sourced from the validated CORS_ORIGINS allow-list.
app.use(corsLib(corsOptions));

app.use(compression());

app.use(
  express.json({
    limit: '10mb',
    // BET-15.2 — payment-gateway webhooks must be signature-verified
    // against the exact raw bytes that were sent, not a re-serialized
    // copy of the parsed object (whitespace/key-order differences
    // would break an HMAC check). This preserves the raw buffer
    // alongside the normal parsed `req.body` for every request —
    // cheap, and the only place a webhook route can reach it, since
    // `express.json()` is mounted globally before any router.
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  }),
);

app.use(cookieParser());

// NoSQL-injection and HTTP-parameter-pollution protection. Must run
// after body/query parsing so there is something to sanitize.
securitySanitizers.forEach((middleware) => app.use(middleware));

// Assigns req.requestId and logs one structured line per request.
app.use(auditMiddleware);

// BET-23 — aggregate in-process request/error/latency counters,
// exposed via the admin-gated GET /health/metrics route below.
app.use(metricsMiddleware);

// Structured request/response logging via pino, correlated by the
// same X-Request-ID set in auditMiddleware.
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
    autoLogging: env.app.nodeEnv !== 'test',
  }),
);

app.use(generalRateLimiter);

app.use(healthRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Ash-Shāfī API',
    version: env.app.version,
    requestId: req.requestId,
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/gynecology', gynecologyRoutes);
app.use('/api/v1/obstetrics', pregnancyRoutes);
app.use('/api/v1/cms', cmsRoutes);
// FET-16 — navbar/certificates/hero-banner/homepage-sections, mounted
// at the same '/api/v1/cms' prefix as cms.routes.js (no path overlap:
// distinct sub-paths /navbar, /certificates, /hero-banner, /sections).
app.use('/api/v1/cms', dynamicSiteRoutes);
// FET-16 completion pass — public "Contact" form + admin inbox,
// distinct sub-path '/contact', no overlap with the routers above.
app.use('/api/v1/cms', contactRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/encounters', encounterRoutes);
// Mounted at a distinct top-level path from '/api/v1/appointments' —
// schedule.routes.js's '/:doctorId' would otherwise collide with
// appointment.routes.js's '/:id' if nested under the same prefix
// (e.g. GET '/api/v1/appointments/schedules' would wrongly match
// appointmentRoutes' '/:id' with id="schedules" before ever reaching
// scheduleRoutes, regardless of app.use() registration order).
app.use('/api/v1/schedules', scheduleRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/medicines', medicineRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/investigations', investigationRoutes);
app.use('/api/v1/voice', voiceRoutes);
app.use('/api/v1/lab-requisitions', labRequisitionRouter);
app.use('/api/v1/reports', reportRoutes);
// BET-13 — '/messages' mounted at a distinct top-level path from
// '/conversations' for the same reason '/schedules' is split from
// '/appointments' above: message-level actions (delete, attachment
// download) are addressed by message id alone, not nested under a
// conversation id, so they need their own prefix rather than
// colliding with conversationRoutes' own '/:id' patterns.
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/notifications', notificationRoutes);
// BET-15 — both routers were already built (fees/invoices under
// billing, payments/refunds/webhook under payments) and already
// imported above, but neither was ever actually mounted here, so
// none of BET-15's HTTP surface was reachable despite the
// service/controller/route-file layers being complete. Same
// "logic done, mounting missing" shape BET-10 had.
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/payments', paymentRoutes);
// BET-14 — Video Consultation. New this task: `modules/video-calls`
// previously had only its model/access-control layer built (see
// PROJECT_PROGRESS.md); the controller/routes/validators and this
// mount point are new.
app.use('/api/v1/video-calls', videoCallRoutes);
app.use('/api/v1/data-lifecycle', dataLifecycleRoutes);
// BET-18 — Backup, Recovery & Data Protection. Every route here is
// owner-tier (SYSTEM_ADMIN) — see modules/backups/routes/
// backup.routes.js's own docstring for why this module has no
// lower-tier read-only role the way data-lifecycle's /policy does.
app.use('/api/v1/backups', backupRoutes);
// BET-19 checkpoint 1 — FHIR-ready architecture, Patient mapping,
// Practitioner mapping. `GET /fhir/metadata` is intentionally the
// one unauthenticated route in this module — see
// modules/fhir/routes/fhir.routes.js's own docstring.
app.use('/api/v1/fhir', fhirRoutes);

// BET-19 — Data Interoperability: bulk import/export.
app.use('/api/v1/exports', exportRoutes);
app.use('/api/v1/imports', importRoutes);

// BET-20 — Secure Analytics.
app.use('/api/v1/analytics', analyticsRoutes);

// FET-20 — Audit Administration. Self-scoped `GET /audit-logs/me`
// (pulled forward for FET-21) plus, as of the FET-20 prerequisite-
// backend checkpoint, the `AUDIT_READ`-gated admin viewer
// (`GET /audit-logs`, `GET /audit-logs/:id`) — see
// `modules/audit-logs/README.md`.
app.use('/api/v1/audit-logs', auditLogRoutes);

// FET-20 — Security Administration (prerequisite backend
// checkpoint). Dashboard, cross-user active sessions, account
// security, security/authentication events, and derived alerts —
// see `modules/security-admin/README.md`.
app.use('/api/v1/security-admin', securityAdminRoutes);

app.use(notFoundMiddleware);

app.use(errorMiddleware);

export default app;
