import Joi from 'joi';

export const listBackupsQuerySchema = Joi.object({
  status: Joi.string().valid('RUNNING', 'COMPLETED', 'FAILED', 'PURGED').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const backupIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export const triggerBackupSchema = Joi.object({
  // No fields required — kept as an object (not empty) so an
  // accidental non-JSON body is still rejected by the body parser
  // rather than silently ignored.
}).unknown(false);

// Same confirmation-contract shape `data-lifecycle.validation.js`'s
// `purgeBodySchema` already established for
// `POST /data-lifecycle/purge` — reused deliberately, not
// reinvented, for this module's own irreversible operation.
export const restoreBodySchema = Joi.object({
  password: Joi.string().min(1).required(),
  confirm: Joi.boolean().valid(true).required().messages({
    'any.only': 'confirm must be explicitly set to true.',
  }),
  reason: Joi.string().trim().min(10).max(1000).required(),
});
