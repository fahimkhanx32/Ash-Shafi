import { redirect } from 'next/navigation';
import { getPortalForgotPasswordUrl } from '@/lib/portalUrl';

/**
 * Same auth-dedup as `/login` and `/register`: this page duplicated
 * the portal's own `/forgot-password` (`ForgotPasswordPage.jsx`,
 * `client/web`) — same backend call, its own hardcoded dark-only
 * styling. Removed in favor of forwarding to the portal, the single
 * source of truth for every auth screen including password reset.
 */
export default async function ForgotPasswordRedirectPage() {
  const forgotUrl = await getPortalForgotPasswordUrl();
  redirect(forgotUrl);
}
