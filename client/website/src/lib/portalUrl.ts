/**
 * Base URL of the Vite authenticated portal (`client/web`), the
 * single source of truth for login/register/forgot-password and the
 * whole authenticated app. The public Next.js website (this app) no
 * longer has its own auth pages or logic — every auth entry point
 * here forwards here.
 *
 * Same fallback pattern as `NEXT_PUBLIC_API_URL` elsewhere in this
 * app (`lib/api.ts`, and the now-removed website auth pages):
 * `localhost:5173` is the Vite dev server default, overridable via
 * env for staging/production where the portal is deployed elsewhere.
 */
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:5173';

export const PORTAL_LOGIN_URL = `${PORTAL_URL}/login`;
export const PORTAL_REGISTER_URL = `${PORTAL_URL}/register`;
export const PORTAL_FORGOT_PASSWORD_URL = `${PORTAL_URL}/forgot-password`;

/**
 * Dynamically resolves the Vite authenticated portal URL on the client.
 */
export function getClientPortalUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_PORTAL_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      if (envUrl) {
        try {
          const parsed = new URL(envUrl);
          if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            parsed.hostname = hostname;
            return parsed.toString().replace(/\/$/, '');
          }
          return envUrl;
        } catch {
          return envUrl;
        }
      }
      const protocol = window.location.protocol || 'http:';
      return `${protocol}//${hostname}:5173`;
    }
  }
  return envUrl || 'http://localhost:5173';
}

/**
 * Dynamically resolves the Vite authenticated portal URL on the server (e.g. redirects).
 */
export async function getDynamicPortalUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_PORTAL_URL;

  // Server-side host header inspection
  if (typeof window === 'undefined') {
    try {
      const { headers } = await import('next/headers');
      const headerList = await headers();
      const hostHeader = headerList.get('x-forwarded-host') || headerList.get('host');
      if (hostHeader) {
        const reqHostname = hostHeader.split(':')[0];
        if (reqHostname && reqHostname !== 'localhost' && reqHostname !== '127.0.0.1') {
          if (envUrl) {
            try {
              const parsed = new URL(envUrl);
              if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                parsed.hostname = reqHostname;
                return parsed.toString().replace(/\/$/, '');
              }
              return envUrl;
            } catch {
              return envUrl;
            }
          }
          return `http://${reqHostname}:5173`;
        }
      }
    } catch {
      // Fall through to default
    }
  }

  return getClientPortalUrl();
}

export async function getPortalLoginUrl(): Promise<string> {
  const base = await getDynamicPortalUrl();
  return `${base}/login`;
}

export async function getPortalRegisterUrl(): Promise<string> {
  const base = await getDynamicPortalUrl();
  return `${base}/register`;
}

export async function getPortalForgotPasswordUrl(): Promise<string> {
  const base = await getDynamicPortalUrl();
  return `${base}/forgot-password`;
}
