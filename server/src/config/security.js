import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

/**
 * Centralized security middleware configuration (BET-02).
 *
 * This module exists so `app.js` does not have to hand-roll security
 * middleware inline, and so every hardening decision lives in one
 * reviewable place (see master prompt sections 46 and 47).
 *
 * Covers:
 * - helmet: standard secure HTTP headers (HSTS, no-sniff, frameguard,
 *   referrer policy, etc.). CSP is left disabled here because the API
 *   serves JSON only (no HTML/script content); a public-website
 *   frontend serving HTML should apply its own CSP.
 * - express-mongo-sanitize: strips any `$` / dotted-path operator
 *   keys from req.body/req.query/req.params to prevent NoSQL
 *   operator injection.
 * - hpp: prevents HTTP parameter pollution (duplicate query keys
 *   silently overriding validation expectations).
 */

export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
});

export const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ key }) => {
    // Intentionally no-op in production logs; sanitization events
    // are high-volume and low-signal. Left as an extension point.
    void key;
  },
});

export const hppMiddleware = hpp();

/**
 * Ordered list of security middleware to be applied early in the
 * request pipeline, before body parsing where order matters and
 * after body parsing for sanitize/hpp (which need a parsed body).
 */
export const securityHeaders = [helmetMiddleware];
export const securitySanitizers = [mongoSanitizeMiddleware, hppMiddleware];

export default {
  helmetMiddleware,
  mongoSanitizeMiddleware,
  hppMiddleware,
  securityHeaders,
  securitySanitizers,
};
