import { usePermissions } from '../../hooks/usePermissions.js';
import { useAuth } from '../../providers/AuthProvider.jsx';

/**
 * Declarative permission and role authorization wrapper component for UI elements.
 * Provides UX-level hiding of controls based on live backend permissions or user roles.
 * (Note: Backend authorization middleware remains authoritative for all API endpoints).
 *
 * Usage:
 * <Can permission="patients:write">
 *   <Button onClick={handleCreate}>New Patient</Button>
 * </Can>
 *
 * <Can role="DOCTOR">
 *   <DoctorSummaryCard />
 * </Can>
 *
 * <Can roles={['SUPER_ADMIN', 'SOFTWARE_OWNER']}>
 *   <SystemAdminControls />
 * </Can>
 */
export function Can({ permission, role, roles, children, fallback = null }) {
  const { user } = useAuth();
  const { has } = usePermissions();

  if (permission && !has(permission)) {
    return fallback;
  }

  if (role && user?.role !== role) {
    return fallback;
  }

  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    return fallback;
  }

  return children;
}

export default Can;
