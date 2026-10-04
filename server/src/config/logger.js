import pino from 'pino';

import env from './env.js';

/**
 * Structured application logger (BET-02).
 *
 * - Uses pino for fast, structured JSON logging in all environments.
 * - Uses pino-pretty transport only in non-production environments,
 *   so production logs stay machine-parseable (e.g. for log
 *   aggregation, alerting).
 * - Redacts fields that must never be logged: passwords, tokens,
 *   secrets, authorization headers, and cookies. This is a hard
 *   requirement (see master prompt: never log passwords, access
 *   tokens, refresh tokens, API secrets).
 */

const REDACT_PATHS = [
  'password',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'passwordHash',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'token',
  'accessToken',
  'refreshToken',
  'tokenId',
  'apiKey',
  'apiSecret',
  'secret',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
];

const isProduction = env.app.nodeEnv === 'production';
const isTest = env.app.nodeEnv === 'test';

const transport =
  !isProduction && !isTest && env.logging.pretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

export const logger = pino({
  level: isTest ? 'silent' : env.logging.level,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  base: {
    app: env.app.name,
    env: env.app.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(transport ? { transport } : {}),
});

/**
 * Create a child logger scoped to a specific module/component.
 *
 * @param {string} component
 * @returns {import('pino').Logger}
 */
export const createLogger = (component) => {
  return logger.child({ component });
};

export default logger;
