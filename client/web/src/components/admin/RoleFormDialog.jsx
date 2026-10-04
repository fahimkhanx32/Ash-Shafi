import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, ShieldCheck } from 'lucide-react';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Badge } from '../ui/badge.jsx';
import * as rolesService from '../../services/rolesService.js';
import { extractApiError } from '../../services/apiClient.js';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';

const inputClass =
  'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = { name: '', description: '', permissions: [] };

/**
 * FET-05 — "Custom role create/edit" + read-only system-role
 * viewer, in one dialog.
 */
export default function RoleFormDialog({ open, onOpenChange, role, permissionGroups, onSaved, onDeleted }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isSystem = Boolean(role?.isSystem);
  const isEdit = Boolean(role) && !isSystem;
  const readOnly = isSystem;

  useEffect(() => {
    if (!open) return;
    setForm({
      name: role?.name || '',
      description: role?.description || '',
      permissions: role?.permissions || [],
    });
    setError('');
  }, [open, role]);

  const togglePermission = (permission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving && !deleting) {
      setForm(emptyForm);
      setError('');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: form.permissions,
      };
      if (isEdit) {
        await rolesService.updateRole(role.id, payload);
      } else {
        await rolesService.createRole(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('roles.deleteConfirmTitle', 'Delete this custom role?'),
      description: t(
        'roles.deleteConfirmDescription',
        '"{{name}}" will be deactivated. Any staff currently assigned an RBAC role isn\'t affected — this only removes the role from future assignment.',
        { name: role.name }
      ),
      confirmLabel: t('roles.deleteRole', 'Delete role'),
      variant: 'destructive',
    });
    if (!ok) return;

    setDeleting(true);
    setError('');
    try {
      await rolesService.deleteRole(role.id);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      setError(extractApiError(err).message);
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-2xl">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {readOnly ? <ShieldCheck size={16} className="text-muted-foreground" /> : null}
              {isEdit || readOnly ? role.name : t('roles.createCustomRole', 'Create custom role')}
              {isSystem ? <Badge variant="info">{t('roles.typeSystem', 'System')}</Badge> : null}
            </DialogTitle>
            <DialogDescription>
              {readOnly
                ? t('roles.systemRoleDescription', 'System roles are fixed in the backend and shown here read-only — their grants can’t be edited through this screen.')
                : t('roles.customRoleDescription', 'Grant only the permissions this role actually needs.')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {!readOnly ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t('roles.colRole', 'Role name')}</label>
                  <input
                    required
                    minLength={2}
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('departments.colDescription', 'Description')}</label>
                  <input
                    className={inputClass}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
            ) : role?.description ? (
              <p className="text-sm text-muted-foreground">{role.description}</p>
            ) : null}

            <div>
              <p className={labelClass}>{t('roles.colPermissions', 'Permissions')}</p>
              <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {(permissionGroups || []).map((group) => (
                  <div key={group.key} className="p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{group.label}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission}
                          className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 hover:bg-accent/40"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={form.permissions.includes(permission)}
                            disabled={readOnly}
                            onChange={() => togglePermission(permission)}
                          />
                          <span className="font-mono text-xs">{permission}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className={isEdit ? 'sm:justify-between' : undefined}>
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="sm:mr-auto"
              >
                <Trash2 size={14} /> {deleting ? t('common.deleting', 'Deleting…') : t('roles.deleteRole', 'Delete role')}
              </Button>
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving || deleting}>
                {readOnly ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
              </Button>
              {!readOnly ? (
                <Button type="submit" size="sm" disabled={saving || deleting}>
                  {saving ? t('common.saving', 'Saving…') : isEdit ? t('common.saveChanges', 'Save changes') : t('roles.createRole', 'Create role')}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
