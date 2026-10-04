import { redirect } from 'next/navigation';
import { getPortalLoginUrl } from '@/lib/portalUrl';

/**
 * The Next.js website no longer has its own login form or auth logic
 * (removed 2026-08 — was a full duplicate of the Vite portal's real
 * auth system, fetching the backend directly and managing its own
 * localStorage token). `client/web` (port 5173) is the single
 * source of truth for authentication; any request for
 * `/login` — including old bookmarks/links — is forwarded there
 * server-side preserving the host (localhost or LAN IP).
 */
export default async function LoginRedirectPage() {
  const loginUrl = await getPortalLoginUrl();
  redirect(loginUrl);
}
