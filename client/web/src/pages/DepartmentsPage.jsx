import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Building2, User } from 'lucide-react';

import * as departmentsService from '../services/departmentsService.js';
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
import DepartmentFormDialog from '../components/admin/DepartmentFormDialog.jsx';

/**
 * Departments administration — closes the gap flagged in FET-04/05:
 * the master prompt's §19 Administration section lists Doctors /
 * Staff / Departments as three screens, but until now there was no
 * real `Department` entity to manage (only free-text on a staff
 * profile). Real backend data only (`GET /departments`,
 * `users:read`) — no mock content.
 */
export default function DepartmentsPage() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDepartment, setActiveDepartment] = useState(null); // null = create

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await departmentsService.listDepartments({ limit: 100 });
      setDepartments(result.items || []);
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
    setActiveDepartment(null);
    setDialogOpen(true);
  };

  const openDepartment = (department) => {
    setActiveDepartment(department);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' }, { label: t('departments.title', 'Departments') }]}
        title={t('departments.title', 'Departments')}
        description={t('departments.pageDescription', 'The department catalog staff profiles are organized under.')}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={15} /> {t('departments.addDepartment', 'Add department')}
          </Button>
        }
      />

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('departments.colDepartment', 'Department')}</TableHead>
                <TableHead>{t('departments.colDescription', 'Description')}</TableHead>
                <TableHead>{t('departments.colHead', 'Head of department')}</TableHead>
                <TableHead>{t('departments.colStatus', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={4} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('departments.emptyTitle', 'No departments yet')}
          description={t('departments.emptyDescription', 'Add a department to start organizing staff profiles under it.')}
        />
      ) : (
        <>
          {/* Master prompt §12/§30/§31 — cards on mobile, matching the
              convention `RolesPermissionsPage` established. */}
          <div className="grid gap-3 lg:hidden">
            {departments.map((department) => (
              <button
                key={department.id}
                type="button"
                onClick={() => openDepartment(department)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      <Building2 size={14} className="shrink-0 text-muted-foreground" />
                      {department.name}
                    </p>
                    {department.description ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {department.description}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={department.isActive ? 'success' : 'destructive'}>
                    {department.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                  </Badge>
                </div>
                {department.headOfDepartment ? (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User size={12} /> {t('departments.head', 'Head')}: {department.headOfDepartment.employeeId}
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('departments.colDepartment', 'Department')}</TableHead>
                    <TableHead>{t('departments.colDescription', 'Description')}</TableHead>
                    <TableHead>{t('departments.colHead', 'Head of department')}</TableHead>
                    <TableHead>{t('departments.colStatus', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((department) => (
                    <TableRow
                      key={department.id}
                      className="cursor-pointer"
                      onClick={() => openDepartment(department)}
                    >
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          <Building2 size={14} className="text-muted-foreground" />
                          {department.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {department.description || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {department.headOfDepartment?.employeeId || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={department.isActive ? 'success' : 'destructive'}>
                          {department.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
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

      <DepartmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={activeDepartment}
        onSaved={load}
      />
    </div>
  );
}
