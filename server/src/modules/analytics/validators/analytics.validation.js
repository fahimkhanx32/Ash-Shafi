import Joi from 'joi';

import { ANALYTICS_DOMAINS, ANALYTICS_GRANULARITIES } from '../constants/analytics.constants.js';

/**
 * `GET /api/v1/analytics/:domain` — BET-20 "Reporting" / "Aggregation"
 * checkpoint. `from`/`to` are plain ISO dates (not datetimes) since
 * every domain here buckets by calendar day at the finest — matches
 * the `appointmentDate`/`queueDate`/`issuedDate` fields being
 * filtered. `doctorId` is optional and only meaningful for
 * appointments/queue/operational; a DOCTOR-role caller has it forced
 * to their own id regardless of what's passed here (see
 * `analytics.controller.js`), so this schema doesn't need to know
 * about that distinction — it just validates shape.
 */
export const analyticsParamsSchema = Joi.object({
  domain: Joi.string()
    .valid(...Object.values(ANALYTICS_DOMAINS))
    .required(),
});

export const analyticsQuerySchema = Joi.object({
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  granularity: Joi.string()
    .valid(...ANALYTICS_GRANULARITIES)
    .optional(),
  doctorId: Joi.string().hex().length(24).optional(),
});
