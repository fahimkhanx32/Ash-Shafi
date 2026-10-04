import { hasPermission, hasAnyPermission } from '../../../security/permissions.js';
import { recordAuditEvent } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';
import { AUDIT_CATEGORIES } from '../../../audit/audit.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';
import { VOICE_TOOL_REGISTRY, RISK_LEVELS } from '../tools/tool-registry.js';
import { validateToolArgs } from '../validators/voice.validation.js';
import { buildIdempotencyKey, runOnce } from './voice-idempotency.js';

/**
 * Runs one ElevenLabs tool call end-to-end.
 *
 * This is the ONLY place in the voice module that:
 *   - looks up whether a tool exists,
 *   - checks the caller's RBAC permission for it,
 *   - enforces the HIGH-risk confirmation gate,
 *   - calls the handler,
 *   - writes the audit trail entry,
 *   - and turns any thrown `AppError`/validation failure into the
 *     structured, human-readable failure shape the agent is expected
 *     to relay by voice (master prompt §31/§32) instead of a raw
 *     stack trace or HTTP status code.
 *
 * `actor` is always `req.user` from the real, JWT-authenticated
 * request — see `routes/voice.routes.js` for how that JWT gets there
 * (master prompt §8: never a second authentication system).
 */
export const executeVoiceTool = async ({ toolName, args, actor, requestMeta = {} }) => {
  const entry = VOICE_TOOL_REGISTRY[toolName];

  if (!entry) {
    return {
      success: false,
      action: toolName,
      message: `"${toolName}" is not a tool this assistant has.`,
    };
  }

  const allowed = Array.isArray(entry.permission)
    ? hasAnyPermission(actor.role, entry.permission) // any-of, like `authorizeAny` on the REST route
    : !entry.permission || hasPermission(actor.role, entry.permission);

  if (!allowed) {
    await recordAuditEvent({
      actor: actor._id,
      actorRole: actor.role,
      category: AUDIT_CATEGORIES.USER_ACTION,
      action: AUDIT_ACTIONS.AI_VOICE_TOOL_DENIED,
      resourceType: 'VoiceTool',
      metadata: { toolName, requiredPermission: entry.permission },
      outcome: 'FAILURE',
      ipAddress: requestMeta.ipAddress ?? null,
      userAgent: requestMeta.userAgent ?? null,
    });
    return {
      success: false,
      action: toolName,
      message: "You don't have permission to do that.",
    };
  }

  const { error, value: validatedArgs } = validateToolArgs(toolName, args);
  if (error) {
    return { success: false, action: toolName, message: error };
  }

  // Optional per-tool guard (e.g. "this prescription belongs to the open
  // patient"). Runs before the preview/confirmation so a mismatch is
  // refused up front. `patientProfileId` exists only for the guard, so it
  // is not passed on to the handler.
  let handlerArgs = validatedArgs;
  if (entry.guard) {
    try {
      await entry.guard(validatedArgs, actor);
    } catch (err) {
      if (err instanceof AppError) return { success: false, action: toolName, message: err.message };
      logger.error({ err, toolName }, 'Unhandled error in voice tool guard.');
      return { success: false, action: toolName, message: "I couldn't check that, so I haven't done anything." };
    }
    const { patientProfileId: _guardOnly, ...rest } = validatedArgs;
    handlerArgs = rest;
  }

  if (entry.risk === RISK_LEVELS.HIGH && !validatedArgs.confirmed) {
    // Some HIGH tools (invoices, payments) can describe exactly what
    // they are about to do — real totals from the real catalog — so the
    // doctor confirms actual numbers rather than a generic "are you
    // sure?" (master prompt §20). `preview` is strictly read-only.
    if (entry.preview) {
      try {
        const preview = await entry.preview(handlerArgs, actor);
        return { success: false, action: toolName, requiresConfirmation: true, ...preview };
      } catch (err) {
        if (err instanceof AppError) return { success: false, action: toolName, message: err.message };
        logger.error({ err, toolName }, 'Unhandled error building voice tool preview.');
        return { success: false, action: toolName, message: "I couldn't prepare that, so I haven't done anything." };
      }
    }
    return {
      success: false,
      action: toolName,
      requiresConfirmation: true,
      message: 'This needs your explicit confirmation before I do it. Should I go ahead?',
    };
  }

  try {
    let raw;
    if (entry.idempotent) {
      const key = buildIdempotencyKey(actor._id, toolName, handlerArgs);
      const { result, duplicate } = await runOnce(key, () => entry.handler(handlerArgs, actor));
      if (duplicate) {
        // Already executed (or executing) for this exact call: report the
        // original outcome, do not repeat it and do not audit a second time.
        const { auditMetadata: _a, ...original } = result ?? {};
        return {
          ...original,
          duplicate: true,
          message: `That was already done a moment ago, so I did not repeat it. ${original.message ?? ''}`.trim(),
        };
      }
      raw = result;
    } else {
      raw = await entry.handler(handlerArgs, actor);
    }
    const { auditMetadata, ...result } = raw ?? {};

    if (entry.audit) {
      await recordAuditEvent({
        actor: actor._id,
        actorRole: actor.role,
        category: entry.audit.category,
        action: entry.audit.action,
        resourceType: 'VoiceTool',
        resourceId: result?.prescription?.prescriptionId ?? result?.patient?.patientProfileId ?? null,
        outcome: 'SUCCESS',
        metadata: { toolName, viaVoiceAgent: true, ...(auditMetadata ?? {}) },
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
      });
    }

    return result;
  } catch (err) {
    if (entry.audit) {
      await recordAuditEvent({
        actor: actor._id,
        actorRole: actor.role,
        category: entry.audit.category,
        action: entry.audit.action,
        resourceType: 'VoiceTool',
        outcome: 'FAILURE',
        reason: err instanceof AppError ? err.message : 'Unhandled error',
        metadata: { toolName, viaVoiceAgent: true },
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
      });
    }

    if (err instanceof AppError) {
      // Human-friendly, never the raw code/status (master prompt §31).
      return { success: false, action: toolName, message: err.message };
    }

    logger.error({ err, toolName }, 'Unhandled error executing voice tool.');
    return {
      success: false,
      action: toolName,
      message: "Something went wrong on my end and I couldn't complete that.",
    };
  }
};

export const listVoiceTools = () =>
  Object.entries(VOICE_TOOL_REGISTRY).map(([name, entry]) => ({
    name,
    permission: entry.permission,
    risk: entry.risk,
  }));
