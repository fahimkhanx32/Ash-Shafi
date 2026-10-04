import { AppError } from './error.middleware.js';

const getRequestData = (req, source) => {
  switch (source) {
    case 'body':
      return req.body;

    case 'query':
      return req.query;

    case 'params':
      return req.params;

    case 'headers':
      return req.headers;

    default:
      throw new Error(`Unsupported validation source: ${source}`);
  }
};

const isJoiSchema = (schema) => {
  return (
    schema &&
    typeof schema.validate === 'function'
  );
};

const isZodSchema = (schema) => {
  return (
    schema &&
    typeof schema.safeParse === 'function'
  );
};

export const validate = (
  schema,
  source = 'body',
) => {
  return (req, res, next) => {
    try {
      const data = getRequestData(req, source);

      if (isJoiSchema(schema)) {
        const result = schema.validate(data, {
          abortEarly: false,
          stripUnknown: true,
          convert: true,
        });

        if (result.error) {
          return next(
            new AppError(
              'Request validation failed.',
              400,
              {
                code: 'VALIDATION_ERROR',
                details: result.error.details.map(
                  (detail) => ({
                    message: detail.message,
                    path: detail.path,
                  }),
                ),
              },
            ),
          );
        }

        req[source] = result.value;

        return next();
      }

      if (isZodSchema(schema)) {
        const result = schema.safeParse(data);

        if (!result.success) {
          return next(
            new AppError(
              'Request validation failed.',
              400,
              {
                code: 'VALIDATION_ERROR',
                details: result.error.issues,
              },
            ),
          );
        }

        req[source] = result.data;

        return next();
      }

      return next(
        new AppError(
          'Invalid validation schema.',
          500,
          {
            code: 'INVALID_VALIDATION_SCHEMA',
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  };
};

export const validateBody = (schema) =>
  validate(schema, 'body');

export const validateQuery = (schema) =>
  validate(schema, 'query');

export const validateParams = (schema) =>
  validate(schema, 'params');