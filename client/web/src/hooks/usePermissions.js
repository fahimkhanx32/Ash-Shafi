import { useEffect, useState } from 'react';

import { useAuth } from '../providers/AuthProvider.jsx';
import { getSystemRoleMatrix } from '../services/permissionsService.js';

/**
 * FET-05 — "Protected UI actions" / "role-aware navigation".
 *
 * Rather than hardcoding a second copy of
 * `server/src/security/permissions.js`'s role→permission map into
 * the frontend (which would drift the moment the backend map
 * changes), this fetches the real, live matrix from
 * `GET /permissions/role-matrix` and looks up the signed-in user's
 * own role in it. This is still UX-only — every mutation the UI
 * exposes is re-checked by `authorize()` on the backend regardless
 * of what this hook returns (master prompt section 80) — but it
 * means "hide the button the user can't use" reflects the real,
 * current server-side grants instead of a second, possibly-stale
 * source of truth.
 *
 * Only ever called for a signed-in user whose role already holds
 * `permissions:read` (SOFTWARE_OWNER/SUPER_ADMIN/DIRECTOR/ADMIN,
 * i.e. `ADMIN_TIER_ROLES`) — a request from any other role would
 * simply 403, so callers should gate on that first.
 */
export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState(null); // Set<string> | null
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    if (!user?.role) return undefined;
    let cancelled = false;

    getSystemRoleMatrix()
      .then((matrix) => {
        if (cancelled) return;
        const mine = matrix.find((entry) => entry.role === user.role);
        setPermissions(new Set(mine?.permissions || []));
        setState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        // Fail closed: an empty permission set hides every
        // protected action rather than showing one this user may
        // not actually have.
        setPermissions(new Set());
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  const has = (permission) => permissions?.has(permission) ?? false;

  return { has, state, isLoading: state === 'loading' };
}
