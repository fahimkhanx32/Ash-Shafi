import Joi from 'joi';

import { AUDIT_CATEGORIES } from '../../../audit/audit.model.js';
import {
  SENSITIVE_RECORD_ACCESS_ACTIONS,
  SENSITIVE_RECORD_ACCESS_OUTCOMES,
} from '../../gynecology/models/sensitive-record-access-log.model.js';
import { REPORT_ACCESS_ACTIONS } from '../../reports/models/report-access-log.model.js';

/**
 * FET-20 (minimal slice, pulled forward for FET-21's "Export
 * history") — `GET /api/v1/audit-logs/me` query schema.
 *
 * Deliberately narrow: this is not the full future audit-log viewer
 * (`modules/audit-logs/README.md` still describes that as reserved,
 * unbuilt scaffolding) — just enough filtering for a caller to see
 * their own recent activity, optionally narrowed to one category
 * (e.g. `DATA_EXPORT`) or a date range. No actor/patientId/ipAddress
 * filter here — those are cross-user admin-viewer concerns that
 * belong to the real FET-20 task, not this slice.
 */
export const myAuditLogQuerySchema = Joi.object({
  category: Joi.string()
    .valid(...Object.values(AUDIT_CATEGORIES))
    .optional(),
  action: Joi.string().trim().max(100).optional(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * FET-20 prerequisite backend — admin cross-user audit-log viewer
 * query schema, `GET /api/v1/audit-logs` (`AUDIT_READ`-gated — see
 * the route file). Deliberately wider than `myAuditLogQuerySchema`
 * above: an admin viewer needs to filter by actor, resource, patient,
 * and outcome, none of which the self-service `/me` route exposes
 * (a caller never needs to filter their own history by "which user
 * did this" since the answer is always "me").
 *
 * `search` is a free-text filter matched against `action` and
 * `resourceType` only (never against `metadata`, which may contain
 * data that shouldn't be exposed to a wider substring search than
 * the explicit filters above already allow).
 */
export const adminAuditLogQuerySchema = Joi.object({
  actor: Joi.string().hex().length(24).optional(),
  actorRole: Joi.string().trim().max(50).optional(),
  category: Joi.string()
    .valid(...Object.values(AUDIT_CATEGORIES))
    .optional(),
  action: Joi.string().trim().max(100).optional(),
  resourceType: Joi.string().trim().max(100).optional(),
  resourceId: Joi.string().hex().length(24).optional(),
  patientId: Joi.string().hex().length(24).optional(),
  outcome: Joi.string().valid('SUCCESS', 'FAILURE', 'DENIED').optional(),
  search: Joi.string().trim().max(200).optional(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const auditLogIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

/**
 * FET-20 — Audit Administration, checkpoint 2: "Sensitive-record
 * access" query schema, `GET /api/v1/audit-logs/sensitive-record-access`
 * (`AUDIT_READ`-gated — see the route file). `action`/`outcome` are
 * validated against the real `SensitiveRecordAccessLog` enums rather
 * than left as free-text, since that collection's action/outcome
 * sets are small and fixed (unlike the general audit trail's
 * free-text `action` field).
 */
export const sensitiveRecordAccessQuerySchema = Joi.object({
  actor: Joi.string().hex().length(24).optional(),
  actorRole: Joi.string().trim().max(50).optional(),
  patientId: Joi.string().hex().length(24).optional(),
  action: Joi.string()
    .valid(...SENSITIVE_RECORD_ACCESS_ACTIONS)
    .optional(),
  outcome: Joi.string()
    .valid(...SENSITIVE_RECORD_ACCESS_OUTCOMES)
    .optional(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

/**
 * FET-20 — Audit Administration, checkpoint 2: "File access" query
 * schema, `GET /api/v1/audit-logs/file-access` (`AUDIT_READ`-gated —
 * see the route file). `outcome` here is `ReportAccessLog`'s own
 * ALLOWED/DENIED pair — distinct from the general audit trail's
 * SUCCESS/FAILURE/DENIED set, so it is not shared with
 * `adminAuditLogQuerySchema` above.
 */
export const fileAccessQuerySchema = Joi.object({
  actor: Joi.string().hex().length(24).optional(),
  actorRole: Joi.string().trim().max(50).optional(),
  patientId: Joi.string().hex().length(24).optional(),
  reportId: Joi.string().hex().length(24).optional(),
  action: Joi.string()
    .valid(...REPORT_ACCESS_ACTIONS)
    .optional(),
  outcome: Joi.string().valid('ALLOWED', 'DENIED').optional(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
