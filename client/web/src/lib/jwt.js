/**
 * Decodes the payload of a JWT WITHOUT verifying its signature.
 *
 * This is only ever used client-side for UX purposes — e.g. reading
 * the (non-secret) `tokenId` claim out of the refresh token the
 * browser already holds, so `GET /auth/sessions` can be told which
 * row in the list is "this device". The backend never trusts
 * anything decoded here: `security-event`/session authority always
 * comes from re-verifying the real token server-side.
 *
 * No dependency added for this — see the same "dependency-free
 * primitive" rationale already used for `components/ui/dialog.jsx`.
 */
export function decodeJwtPayload(token) {
  if (typeof token !== 'string' || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
