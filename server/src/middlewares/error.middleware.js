import { logger } from '../config/logger.js';

const isProduction = process.env.NODE_ENV === 'production';

export class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundMiddleware = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
    requestId: req.requestId,
  });
};

export const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // BET-23 — Error handling. `err.statusCode` was the only field ever
  // consulted here, but several error sources this app already
  // depends on (body-parser/http-errors, e.g. malformed JSON) only
  // ever set `err.status`, not `err.statusCode` — meaning those cases
  // silently fell through to a generic 500 instead of the 400 the
  // library itself intended. Checking both closes that gap without
  // changing behavior for anything that already worked.
  let statusCode = err.statusCode ?? err.status ?? 500;
  let code = err.code ?? 'INTERNAL_ERROR';
  let message = err.message ?? 'Internal server error.';
  let details = err.details;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = 'Invalid resource identifier.';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Authentication token is invalid.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired.';
  }

  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'A resource with the same unique value already exists.';
  }

  // BET-23 — malformed request bodies. `express.json()`/
  // `express.urlencoded()` (mounted globally in `app.js`) throw a
  // body-parser `SyntaxError`/`entity.too.large` error for invalid
  // JSON or an oversized payload. Both already carry a correct
  // `status`/`statusCode` (400 / 413) via the fallback above, but
  // without this branch they'd report the generic `INTERNAL_ERROR`
  // code and a raw parser message instead of a stable, client-facing
  // error code — the same reason every other `err.name`/`err.code`
  // case here gets a dedicated branch instead of relying on the raw
  // library message.
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON.';
  }

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  }

  // BET-23 — file-upload errors. `middlewares/upload.middleware.js`
  // is reused across several routes; some of those routes (e.g.
  // `modules/reports`, `modules/messaging`'s dedicated upload
  // middleware) already catch `MulterError` locally with a friendlier
  // message, but others (`modules/cms`, `modules/imports`) do not —
  // any that don't would otherwise let a `MulterError` fall through
  // to a generic 500 here. This is a safety net, not a replacement
  // for route-specific handling: routes that already catch it locally
  // never reach this branch at all.
  if (err.name === 'MulterError') {
    statusCode = 400;
    code =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'FILE_TOO_LARGE'
        : 'FILE_UPLOAD_ERROR';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file exceeds the maximum allowed size.'
        : `File upload failed: ${err.message}`;
  }

  // BET-23 — database-dependency errors. A `MongoNetworkError`/
  // `MongooseServerSelectionError` (the cluster is unreachable, a
  // failover is in progress, etc.) is not a bug in this application's
  // code — it's an upstream dependency being unavailable, exactly
  // like `GET /health/ready` reporting the same condition. Reporting
  // it as a generic `500 INTERNAL_ERROR` conflates "our code broke"
  // with "a dependency is down"; `503 DATABASE_UNAVAILABLE` lets a
  // client (or an on-call engineer skimming logs) tell the two apart
  // at a glance, and is the correct status for a caller to safely
  // retry against.
  if (
    err.name === 'MongoNetworkError' ||
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoServerSelectionError'
  ) {
    statusCode = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'A required database dependency is temporarily unavailable.';
  }

  // BET-23 — Reliability / monitoring gap fix. Previously this
  // middleware never wrote to the structured application logger at
  // all — a 500 was only visible via the generic per-request
  // completion line `middlewares/audit.middleware.js` and pino-http
  // already emit (status code + duration, no stack, no error code).
  // That's enough to notice *that* something failed, not enough to
  // diagnose *what* failed without reproducing it. Every 5xx is now
  // logged with full structured context (error name, code, stack,
  // method, path, requestId, actor) at `error` level so it's
  // actionable from log aggregation/alerting alone. 4xx (client/
  // validation errors — expected, high-volume, not actionable
  // incidents) are logged at `warn` level with less detail, so they
  // don't drown out real incidents in the same log stream.
  if (statusCode >= 500) {
    logger.error(
      {
        err,
        code,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        userId: req.auth?.userId ?? req.user?._id ?? null,
      },
      'Unhandled server error.',
    );
  } else {
    logger.warn(
      {
        code,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode,
      },
      'Request failed.',
    );
  }

  const response = {
    success: false,
    error: {
      code,
      message,
    },
    requestId: req.requestId,
  };

  if (details !== undefined) {
    response.error.details = details;
  }

  if (!isProduction && err.stack) {
    response.error.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};