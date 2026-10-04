import Joi from 'joi';

export const fhirIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});
