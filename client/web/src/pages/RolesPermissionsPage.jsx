import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShieldCheck, ShieldPlus } from 'lucide-react';

import * as rolesService from '../services/rolesService.js';
import * as permissionsService from '../services/permissionsService.js';
import { extractApiError } from '../services/apiClient.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { TableSkeleton } from '../components/ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.jsx';
import RoleFormDialog from '../components/admin/RoleFormDialog.jsx';

/**
 * FET-05 — Roles & permissions administration. `GET /roles` returns
 * system + custom roles together (real backend data, not a
 * hardcoded mirror of `ROLES`); `GET /permissions` supplies the
 * grouped catalog the create/edit dialog renders as a checkbox
 * matrix. System roles open read-only (their grants are fixed in
 * `server/src/security/permissions.js` and can't be mutated through
 * this screen); only a custom role can be created, edited, or
 * deleted here.
 */
export default function RolesPermissionsPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeRole, setActiveRole] = useState(null); // null = create

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const [roleList, catalog] = await Promise.all([
        rolesService.listRoles({ includeInactive: true }),
        permissionsService.getPermissionCatalog(),
      ]);
      setRoles(roleList);
      setPermissionGroups(catalog.groups || []);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setActiveRole(null);
    setDialogOpen(true);
  };

  const openRole = (role) => {
    setActiveRole(role);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' }, { label: t('roles.title', 'Roles & permissions') }]}
        title={t('roles.title', 'Roles & permissions')}
        description={t('roles.pageDescription', 'System roles are fixed and shown read-only. Custom roles can be created for finer-grained access.')}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={15} /> {t('roles.createCustomRole', 'Create custom role')}
          </Button>
        }
      />

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('roles.colRole', 'Role')}</TableHead>
                <TableHead>{t('roles.colType', 'Type')}</TableHead>
                <TableHead>{t('roles.colPermissions', 'Permissions')}</TableHead>
                <TableHead>{t('roles.colStatus', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={4} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : roles.length === 0 ? (
        <EmptyState
          icon={ShieldPlus}
          title={t('roles.emptyTitle', 'No roles found')}
          description={t('roles.emptyDescription', 'Create a custom role to get started.')}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards on mobile, matching the
              convention `PatientsListPage`/`StaffListPage` (FET-06)
              established. */}
          <div className="grid gap-3 lg:hidden">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => openRole(role)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {role.isSystem ? <ShieldCheck size={14} className="shrink-0 text-muted-foreground" /> : null}
                      {role.name}
                    </p>
                    {role.description ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{role.description}</p>
                    ) : null}
                  </div>
                  <Badge variant={role.isActive ? 'success' : 'destructive'}>
                    {role.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={role.isSystem ? 'info' : 'primary'}>
                    {role.isSystem ? t('roles.typeSystem', 'System') : t('roles.typeCustom', 'Custom')}
                  </Badge>
                  <span className="text-muted-foreground">
                    {t('roles.permissionsGranted', '{{count}} permissions granted', { count: role.permissions?.length || 0 })}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('roles.colRole', 'Role')}</TableHead>
                    <TableHead>{t('roles.colType', 'Type')}</TableHead>
                    <TableHead>{t('roles.colPermissions', 'Permissions')}</TableHead>
                    <TableHead>{t('roles.colStatus', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id} className="cursor-pointer" onClick={() => openRole(role)}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          {role.isSystem ? <ShieldCheck size={14} className="text-muted-foreground" /> : null}
                          {role.name}
                        </div>
                        {role.description ? (
                          <div className="text-xs text-muted-foreground truncate max-w-md">{role.description}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.isSystem ? 'info' : 'primary'}>
                          {role.isSystem ? t('roles.typeSystem', 'System') : t('roles.typeCustom', 'Custom')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t('roles.grantedCount', '{{count}} granted', { count: role.permissions?.length || 0 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.isActive ? 'success' : 'destructive'}>
                          {role.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </>
      )}

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={activeRole}
        permissionGroups={permissionGroups}
        onSaved={load}
        onDeleted={load}
      />
    </div>
  );
}
