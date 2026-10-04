/**
 * FET-20 — Security Administration, checkpoint 2 (Security events,
 * Authentication events, Protected-account indicators, Security
 * alerts).
 *
 * The backend has exactly one event log/endpoint for both
 * "Security events" and "Authentication events"
 * (`SecurityEvent` / `GET /security-admin/events` —
 * `server/src/auth/security-event.model.js`) — there is no separate
 * "authentication events" collection to call. Rather than invent a
 * second fake endpoint to match the checklist's two bullet points,
 * this file categorizes the real, already-recorded event *types*
 * into the two groups the checklist names, so the same real data can
 * be filtered either way from one screen. This mirrors the project's
 * standing rule (master prompt §102) against fabricating workflows
 * that don't correspond to real backend functionality.
 */

export const SECURITY_EVENT_CATEGORY = Object.freeze({
  AUTHENTICATION: 'AUTHENTICATION',
  SECURITY: 'SECURITY',
});

/**
 * type -> { category, label, tone }
 * `tone` follows the shared `Badge` variant palette (master prompt
 * §5 — colors must communicate meaning consistently): failures/
 * lockouts/reuse-detection are `destructive`, successes are
 * `success`, routine lifecycle events are `neutral`/`info`,
 * password/session-lifecycle changes are `warning`.
 */
export const SECURITY_EVENT_META = Object.freeze({
  REGISTERED: { category: 'AUTHENTICATION', label: 'Account registered', tone: 'info' },
  LOGIN_SUCCESS: { category: 'AUTHENTICATION', label: 'Login succeeded', tone: 'success' },
  LOGIN_FAILED: { category: 'AUTHENTICATION', label: 'Login failed', tone: 'destructive' },
  LOGOUT: { category: 'AUTHENTICATION', label: 'Logged out', tone: 'neutral' },
  LOGOUT_ALL: { category: 'AUTHENTICATION', label: 'Logged out (all sessions)', tone: 'neutral' },
  EMAIL_VERIFICATION_REQUESTED: { category: 'AUTHENTICATION', label: 'Email verification requested', tone: 'info' },
  EMAIL_VERIFIED: { category: 'AUTHENTICATION', label: 'Email verified', tone: 'success' },
  PASSWORD_CHANGED: { category: 'AUTHENTICATION', label: 'Password changed', tone: 'warning' },
  PASSWORD_RESET_REQUESTED: { category: 'AUTHENTICATION', label: 'Password reset requested', tone: 'warning' },
  PASSWORD_RESET_COMPLETED: { category: 'AUTHENTICATION', label: 'Password reset completed', tone: 'warning' },

  ACCOUNT_LOCKED: { category: 'SECURITY', label: 'Account locked', tone: 'destructive' },
  SESSION_REVOKED: { category: 'SECURITY', label: 'Session revoked (self)', tone: 'neutral' },
  REFRESH_TOKEN_ROTATED: { category: 'SECURITY', label: 'Refresh token rotated', tone: 'neutral' },
  REFRESH_TOKEN_REUSE_DETECTED: { category: 'SECURITY', label: 'Refresh-token reuse detected', tone: 'destructive' },
  SESSION_REVOKED_BY_ADMIN: { category: 'SECURITY', label: 'Session revoked by admin', tone: 'warning' },
  ACCOUNT_UNLOCKED_BY_ADMIN: { category: 'SECURITY', label: 'Account unlocked by admin', tone: 'success' },
});

export const SECURITY_EVENT_TYPES = Object.keys(SECURITY_EVENT_META);

export const eventTypeLabel = (type, t) =>
  typeof t === 'function'
    ? t(`security.events.${type}`, SECURITY_EVENT_META[type]?.label || type || 'Unknown event')
    : SECURITY_EVENT_META[type]?.label || type || 'Unknown event';

export const eventTypeTone = (type) => SECURITY_EVENT_META[type]?.tone || 'neutral';

export const eventTypeCategory = (type) => SECURITY_EVENT_META[type]?.category || null;

export const eventTypesForCategory = (category) =>
  SECURITY_EVENT_TYPES.filter((type) => SECURITY_EVENT_META[type].category === category);

/**
 * Alert severity -> Badge tone. Alerts come from
 * `GET /security-admin/alerts` (`security-admin.service.js#listSecurityAlerts`)
 * with `severity` already one of these four real values — not
 * relabeled or invented here.
 */
export const ALERT_SEVERITY_TONE = Object.freeze({
  critical: 'destructive',
  high: 'destructive',
  medium: 'warning',
  low: 'info',
});

export const alertSeverityTone = (severity) => ALERT_SEVERITY_TONE[severity] || 'neutral';
