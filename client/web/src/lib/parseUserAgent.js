/**
 * Turns a raw `User-Agent` string (as stored on `Session.userAgent`
 * by the backend at login/refresh time — see
 * `server/src/auth/auth.service.js`) into a short, human-readable
 * label for the "Active sessions" list, e.g. "Chrome on Windows",
 * "Safari on iPhone".
 *
 * Deliberately a small heuristic, not a full UA-parsing dependency —
 * this project has no `ua-parser-js` in `package.json` and this
 * sandbox has no network access to add one (master prompt §3: don't
 * introduce unnecessary dependencies). Good enough for a friendly
 * device label; never used for any security decision.
 */
export function describeUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'Unknown device';
  }

  const ua = userAgent;

  let browser = 'A browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/CriOS\//.test(ua)) browser = 'Chrome';
  else if (/FxiOS\//.test(ua)) browser = 'Firefox';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';

  let os = null;
  if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}
