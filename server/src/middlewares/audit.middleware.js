import crypto from 'node:crypto';

import env from '../config/env.js';

export const auditMiddleware = (req, res, next) => {
  const requestId =
    req.headers['x-request-id'] ||
    crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader(
    'X-Request-ID',
    requestId,
  );

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs =
      Number(
        process.hrtime.bigint() - startedAt,
      ) / 1_000_000;

    if (env.app.nodeEnv !== 'test') {
      console.info(
        JSON.stringify({
          type: 'http_request',
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(
            durationMs.toFixed(2),
          ),
          userId: req.auth?.userId ?? null,
        }),
      );
    }
  });

  next();
};
