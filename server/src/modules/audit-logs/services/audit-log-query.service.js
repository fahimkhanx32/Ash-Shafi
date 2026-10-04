import { AuditLog } from '../../../audit/audit.model.js';
import { SensitiveRecordAccessLog } from '../../gynecology/models/sensitive-record-access-log.model.js';
import { ReportAccessLog } from '../../reports/models/report-access-log.model.js';

/**
 * FET-20 (minimal slice, pulled forward for FET-21) — reads from the
 * `AuditLog` collection every export/import controller already
 * writes to (`recordExport`/`recordCreation`, `src/audit/audit.service.js`)
 * — no new writer, this is a read-only addition.
 *
 * Self-scoped: matches entries where the caller is the recorded
 * `actor`, OR — for the one case where that's not enough —
 * `metadata.requestedBy` equals the caller. That second clause
 * matters specifically for `CONTROLLED_EXPORT_DOWNLOADED`/
 * `CONTROLLED_EXPORT_DOWNLOAD_FAILED` events: the controlled-export
 * download route is deliberately unauthenticated (the token is the
 * credential, not a session — see `export.controller.js`'s own
 * docstring), so those two audit entries are written with
 * `actor: null` and the original requester's id only in
 * `metadata.requestedBy` (stored as a string — see
 * `controlled-export.service.js`). Without this second clause, a
 * caller's own "download completed" confirmation would silently
 * vanish from their own history.
 */
export const listMyAuditLogs = async (userId, { category, action, from, to, page, limit }) => {
  const match = {
    $or: [{ actor: userId }, { 'metadata.requestedBy': String(userId) }],
  };

  if (category) match.category = category;
  if (action) match.action = action;

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    AuditLog.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('category action resourceType resourceId patientId outcome reason metadata createdAt')
      .lean(),
    AuditLog.countDocuments(match),
  ]);

  return { items, total };
};

/**
 * FET-20 prerequisite backend — the actual admin audit-log viewer
 * this module's README described as still-missing (`AUDIT_READ`-
 * gated cross-user browsing). Reads the same `AuditLog` collection
 * `listMyAuditLogs` above already reads — no new writer, no
 * duplicated model — just a wider, permission-gated query shape.
 *
 * "Audit data must respect backend permissions" (the client's own
 * FET-20 wording) is enforced at the route layer via
 * `authorize(PERMISSIONS.AUDIT_READ)`, not here — this function
 * itself does not re-check the caller's role, the same division of
 * responsibility every other admin-tier list endpoint in this
 * project already uses (e.g. `modules/backups`). `patientId` is
 * accepted as a filter (so an authorized admin can pull every
 * logged action against one patient's record for an investigation)
 * but this route deliberately does NOT return clinical field
 * contents — `oldValue`/`newValue` are excluded from the projection
 * below, same as every other value in this collection already
 * being metadata-only by convention (see `audit.model.js`'s own
 * docstring on `metadata` never carrying record contents).
 */
export const listAuditLogsAdmin = async ({
  actor,
  actorRole,
  category,
  action,
  resourceType,
  resourceId,
  patientId,
  outcome,
  search,
  from,
  to,
  page,
  limit,
}) => {
  const match = {};

  if (actor) match.actor = actor;
  if (actorRole) match.actorRole = actorRole;
  if (category) match.category = category;
  if (action) match.action = action;
  if (resourceType) match.resourceType = resourceType;
  if (resourceId) match.resourceId = resourceId;
  if (patientId) match.patientId = patientId;
  if (outcome) match.outcome = outcome;

  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(safe, 'i');
    match.$or = [{ action: pattern }, { resourceType: pattern }];
  }

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    AuditLog.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'actor actorRole category action resourceType resourceId patientId outcome reason ipAddress userAgent metadata createdAt',
      )
      .populate('actor', 'name email username role isProtected')
      .lean(),
    AuditLog.countDocuments(match),
  ]);

  return { items, total };
};

/**
 * FET-20 prerequisite backend — "Audit details" (single-entry drill-
 * down from the admin viewer's list). Same `AUDIT_READ` gate as
 * `listAuditLogsAdmin`, enforced at the route layer.
 */
export const getAuditLogById = async (id) => {
  return AuditLog.findById(id)
    .select(
      'actor actorRole category action resourceType resourceId patientId outcome reason ipAddress userAgent metadata createdAt',
    )
    .populate('actor', 'name email username role isProtected')
    .lean();
};

/**
 * FET-20 — Audit Administration, checkpoint 2: "Sensitive-record
 * access". Reads `SensitiveRecordAccessLog` (BET-07,
 * `modules/gynecology/models/sensitive-record-access-log.model.js`)
 * — the purpose-built log `enforceSensitiveRecordAccess` already
 * writes both ALLOWED and DENIED attempts to for every
 * gynecology/obstetrics/investigation/report read or write that goes
 * through it. No new writer: this is a read-only admin viewer over
 * an existing, already-complete collection, the same shape
 * `listAuditLogsAdmin` above already established for the general
 * trail. `AUDIT_READ` is enforced at the route layer, not here.
 */
export const listSensitiveRecordAccessAdmin = async ({
  actor,
  actorRole,
  patientId,
  action,
  outcome,
  from,
  to,
  page,
  limit,
}) => {
  const match = {};

  if (actor) match.actor = actor;
  if (actorRole) match.actorRole = actorRole;
  if (patientId) match.patientProfile = patientId;
  if (action) match.action = action;
  if (outcome) match.outcome = outcome;

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    SensitiveRecordAccessLog.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'name email username role isProtected')
      .populate('patientProfile', 'patientId firstName lastName')
      .lean(),
    SensitiveRecordAccessLog.countDocuments(match),
  ]);

  return { items, total };
};

/**
 * FET-20 — Audit Administration, checkpoint 2: "File access". Reads
 * `ReportAccessLog` (BET-12.24, literally named "File Access Audit"
 * in its own model docstring —
 * `modules/reports/models/report-access-log.model.js`) — the
 * purpose-built log every report UPLOAD/VIEW/DOWNLOAD/OCR/review/
 * finalize/cancel action already writes to, ALLOWED and DENIED alike.
 * Same read-only-viewer-over-an-existing-collection shape as
 * `listSensitiveRecordAccessAdmin` above; no new writer.
 */
export const listReportAccessAdmin = async ({
  actor,
  actorRole,
  patientId,
  reportId,
  action,
  outcome,
  from,
  to,
  page,
  limit,
}) => {
  const match = {};

  if (actor) match.actor = actor;
  if (actorRole) match.actorRole = actorRole;
  if (patientId) match.patientProfile = patientId;
  if (reportId) match.report = reportId;
  if (action) match.action = action;
  if (outcome) match.outcome = outcome;

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ReportAccessLog.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'name email username role isProtected')
      .populate('patientProfile', 'patientId firstName lastName')
      .lean(),
    ReportAccessLog.countDocuments(match),
  ]);

  return { items, total };
};
