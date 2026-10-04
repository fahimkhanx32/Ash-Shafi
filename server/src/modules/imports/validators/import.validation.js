import Joi from 'joi';

import { IMPORT_ENTITY_TYPES } from '../constants/import.constants.js';

export const importPatientsQuerySchema = Joi.object({
  entityType: Joi.string()
    .valid(...Object.values(IMPORT_ENTITY_TYPES))
    .default(IMPORT_ENTITY_TYPES.PATIENTS),
});
