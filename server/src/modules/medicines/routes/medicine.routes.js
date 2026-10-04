import express from 'express';
import multer from 'multer';

import {
  createMedicineController,
  getMedicineController,
  listMedicinesController,
  updateMedicineController,
  deactivateMedicineController,
  reactivateMedicineController,
  softDeleteMedicineController,
  hardDeleteMedicineController,
  restoreMedicineController,
  autocompleteMedicinesController,
  importMedicinesController,
} from '../controllers/medicine.controller.js';
import * as medicineValidation from '../validators/medicine.validation.js';
import { validateBody, validateParams, validateQuery } from '../../../middlewares/validation.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../../security/permissions.js';

// Bulk medicine-database imports are an admin-tier operation on
// clinical reference data — buffered to memory (never disk), same
// convention as `modules/messaging/routes/message-upload.middleware.js`
// and `modules/reports/routes/report.routes.js`. Actual role
// enforcement (SOFTWARE_OWNER/SUPER_ADMIN) happens in
// `medicine-import.service.js#assertCanImportMedicines` — this multer
// config only bounds file size/count, it is not the authorization
// check.
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

/**
 * BET-11 — Medicine database routes.
 *
 * Reused `PRESCRIPTIONS_READ`/`PRESCRIPTIONS_WRITE` rather than
 * introducing a separate `medicines:*` permission pair — the medicine
 * catalog exists specifically to support prescribing (master prompt
 * §24), the same reasoning `queue.routes.js` documented for reusing
 * `APPOINTMENTS_READ`/`WRITE` in BET-10. Every route requires
 * authentication; there is no public/unauthenticated read here (unlike
 * the CMS) since this is clinical reference data, not marketing
 * content — a `PATIENT` has no `PRESCRIPTIONS_*` grant in
 * `security/permissions.js`, so this catalog stays staff/doctor-only.
 *
 * Two-tier deletion:
 * - POST /:id/delete     → soft-delete (staff) — hidden from regular views, retained in DB for Owner/SuperAdmin
 * - DELETE /:id          → hard-delete (Owner/SuperAdmin only) — permanent DB removal
 * - POST /:id/restore    → restore soft-deleted record (Owner/SuperAdmin only)
 */
const router = express.Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.PRESCRIPTIONS_READ));

router.get('/', validateQuery(medicineValidation.listMedicinesQuerySchema), listMedicinesController);

router.get(
  '/autocomplete',
  validateQuery(medicineValidation.autocompleteMedicinesQuerySchema),
  autocompleteMedicinesController,
);

// Bulk import — JSON body ({ origin, sourceVersion, records: [...] })
// or a multipart `file` field (CSV or JSON). Registered before the
// `/:id` routes below is unnecessary here (literal path, no param
// collision) but placed alongside `/autocomplete` for discoverability.
// Body validation is intentionally NOT `validateBody(...)` here — a
// file-upload request's JSON fields arrive as multipart text fields,
// which the shared Joi body-validator middleware isn't set up to
// coerce; the controller/service validate row shape instead.
router.post(
  '/import',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  importUpload.single('file'),
  importMedicinesController,
);

router.get('/:id', validateParams(medicineValidation.medicineIdParamSchema), getMedicineController);

router.post(
  '/',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateBody(medicineValidation.createMedicineSchema),
  createMedicineController,
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(medicineValidation.medicineIdParamSchema),
  validateBody(medicineValidation.updateMedicineSchema),
  updateMedicineController,
);

router.post(
  '/:id/deactivate',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(medicineValidation.medicineIdParamSchema),
  deactivateMedicineController,
);

router.post(
  '/:id/reactivate',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(medicineValidation.medicineIdParamSchema),
  reactivateMedicineController,
);

// Soft-delete (transparent to regular staff, visible to Owner/SuperAdmin)
router.post(
  '/:id/delete',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(medicineValidation.medicineIdParamSchema),
  softDeleteMedicineController,
);

// Hard-delete (permanent, Owner/SuperAdmin only — enforced in service layer)
router.delete(
  '/:id',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(medicineValidation.medicineIdParamSchema),
  hardDeleteMedicineController,
);

// Restore soft-deleted (Owner/SuperAdmin only — enforced in service layer)
router.post(
  '/:id/restore',
  authorize(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validateParams(medicineValidation.medicineIdParamSchema),
  restoreMedicineController,
);

export default router;
