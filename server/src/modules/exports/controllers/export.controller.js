import { exportEntityAsTabular } from '../services/tabular-export.service.js';
import {
  buildMedicalRecordBundle,
  bundleToJsonBuffer,
  bundleToPdfBuffer,
} from '../services/medical-record-export.service.js';
import {
  createControlledExport,
  consumeControlledExport,
} from '../services/controlled-export.service.js';
import { EXPORT_ENTITY_PERMISSION } from '../constants/export.constants.js';
import { hasPermission, PERMISSIONS } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { recordExport, recordAuditEvent } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';
import { AUDIT_OUTCOMES, AUDIT_CATEGORIES } from '../../../audit/audit.model.js';

/**
 * BET-19 checkpoint 1 — `GET /api/v1/exports/:entityType`
 *
 * The permission required varies by `entityType` (patients vs.
 * encounters vs. prescriptions vs. investigations each have their
 * own native read permission — see `export.constants.js`'s
 * `EXPORT_ENTITY_PERMISSION`), so this is checked here rather than
 * as a single fixed `authorize(...)` on the route — the route can't
 * know which permission applies until it sees the `:entityType`
 * param. Every entity type's actual row-visibility scoping still
 * happens one layer down, inside the reused domain list function
 * (`entity-export.service.js`'s docstring) — this check is only the
 * "may this caller use the export feature for this entity type at
 * all" gate, same two-layer shape `fhir.routes.js` already uses.
 *
 * "Export authorization" is a *second*, narrower gate on top of the
 * per-entity permission above: `DATA_EXPORT` (security/permissions.js)
 * is the "may this caller use the bulk-export feature at all"
 * check — a role can hold `patients:read` (ordinary one-at-a-time
 * viewing) without also holding `data:export` (bulk file extraction).
 * Both must pass. Every attempt — allowed or denied — is recorded
 * ("Export audit logging") via `recordExport`, mirroring the
 * fail-safe, never-block-the-request contract every other audit
 * writer in this project already follows.
 */
export const tabularExportController = async (req, res, next) => {
  const { entityType } = req.params;
  const { format, ...filters } = req.query;

  try {
    const requiredPermission = EXPORT_ENTITY_PERMISSION[entityType];
    const entityPermissionOk =
      requiredPermission && hasPermission(req.user.role, requiredPermission);
    const bulkExportPermissionOk = hasPermission(req.user.role, PERMISSIONS.DATA_EXPORT);

    if (!entityPermissionOk || !bulkExportPermissionOk) {
      await recordExport(req, {
        action: AUDIT_ACTIONS.TABULAR_EXPORT_DENIED,
        resourceType: entityType,
        outcome: AUDIT_OUTCOMES.DENIED,
        reason: !entityPermissionOk ? 'MISSING_ENTITY_PERMISSION' : 'MISSING_DATA_EXPORT_PERMISSION',
        metadata: { format },
      });

      throw new AppError('You do not have permission to export this data.', 403, {
        code: 'EXPORT_FORBIDDEN',
      });
    }

    const { buffer, filename, mimeType, recordCount } = await exportEntityAsTabular(
      entityType,
      format,
      filters,
      req.user,
    );

    await recordExport(req, {
      action: AUDIT_ACTIONS.TABULAR_EXPORT,
      resourceType: entityType,
      metadata: { format, filename, recordCount },
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Record-Count', String(recordCount));

    return res.status(200).send(buffer);
  } catch (error) {
    return next(error);
  }
};

/**
 * BET-19 checkpoint 2 — "Medical-record export" + "Controlled
 * export" combined: `POST /api/v1/exports/patients/:patientProfileId/medical-record`
 *
 * Deliberately does not return the file itself. It assembles the
 * package (`buildMedicalRecordBundle` — scoped to exactly what this
 * caller's own permissions already allow, see that function's own
 * docstring), renders it in the requested format, then hands the
 * resulting buffer to `createControlledExport` and returns only a
 * single-use, time-limited download token — never the medical
 * record bytes on this response. This is the "controlled" half of
 * the checkpoint: a caller who can request the package still cannot
 * pull the bytes without a second, separate, expiring-token
 * download step (`downloadControlledExportController` below).
 */
export const requestMedicalRecordExportController = async (req, res, next) => {
  try {
    const { patientProfileId } = req.params;
    const format = req.body?.format || 'PDF';

    const bundle = await buildMedicalRecordBundle(patientProfileId, req.user);

    const buffer =
      format === 'JSON' ? bundleToJsonBuffer(bundle) : await bundleToPdfBuffer(bundle);

    const extension = format === 'JSON' ? 'json' : 'pdf';
    const mimeType = format === 'JSON' ? 'application/json' : 'application/pdf';
    const filename = `medical-record-${bundle.patient.patientId || patientProfileId}-${Date.now()}.${extension}`;

    const { token, expiresAt, sizeBytes } = await createControlledExport({
      requestedBy: req.user._id,
      patientProfileId,
      exportType: 'MEDICAL_RECORD_PACKAGE',
      format,
      filename,
      mimeType,
      buffer,
    });

    await recordExport(req, {
      action: AUDIT_ACTIONS.MEDICAL_RECORD_EXPORT_REQUESTED,
      resourceType: 'MEDICAL_RECORD_PACKAGE',
      resourceId: patientProfileId,
      patientId: patientProfileId,
      metadata: { format, filename, sizeBytes, expiresAt },
    });

    return res.status(202).json({
      success: true,
      message:
        'Medical record package generated. Use the download token below to retrieve it — the link is single-use and expires shortly.',
      data: {
        downloadToken: token,
        downloadUrl: `/api/v1/exports/download/${token}`,
        format,
        filename,
        sizeBytes,
        expiresAt,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * BET-19 checkpoint 2 — "Controlled export": `GET /api/v1/exports/download/:token`
 *
 * Deliberately unauthenticated at the route level (see
 * `export.routes.js`'s own note on this route) — the token itself,
 * not a session, is the credential here, the same "possession of
 * the opaque token is what grants access, for a short window, once"
 * shape a password-reset link already uses elsewhere in this
 * project. `consumeControlledExport` is what actually enforces
 * expiry + single-use; this controller only streams whatever it
 * returns.
 *
 * This route is unauthenticated (no `req.user`), so it cannot use
 * the `recordExport`/`recordAuditEventFromRequest` wrapper the other
 * two controllers above use — it calls `recordAuditEvent` directly
 * instead, with `actor: null` (the redeemer's identity isn't known;
 * only the original requester, captured in `metadata`, is) and the
 * caller's own IP/user-agent so a download can still be traced to a
 * client even without a session.
 */
export const downloadControlledExportController = async (req, res, next) => {
  const { token } = req.params;
  const ipAddress = req.ip ?? req.socket?.remoteAddress ?? null;
  const userAgent = req.get?.('user-agent') ?? null;

  try {
    const { buffer, filename, mimeType, requestedBy, patientProfileId } =
      await consumeControlledExport(token);

    await recordAuditEvent({
      category: AUDIT_CATEGORIES.DATA_EXPORT,
      action: AUDIT_ACTIONS.CONTROLLED_EXPORT_DOWNLOADED,
      resourceType: 'MEDICAL_RECORD_PACKAGE',
      resourceId: patientProfileId,
      patientId: patientProfileId,
      ipAddress,
      userAgent,
      metadata: { filename, requestedBy },
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(buffer);
  } catch (error) {
    await recordAuditEvent({
      category: AUDIT_CATEGORIES.DATA_EXPORT,
      action: AUDIT_ACTIONS.CONTROLLED_EXPORT_DOWNLOAD_FAILED,
      outcome: AUDIT_OUTCOMES.FAILURE,
      reason: error?.code || error?.message || 'UNKNOWN',
      ipAddress,
      userAgent,
    });

    return next(error);
  }
};
