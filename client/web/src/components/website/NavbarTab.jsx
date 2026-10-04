import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Menu as MenuIcon, Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Trash2, CornerDownRight } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import NavbarItemFormDialog from './NavbarItemFormDialog.jsx';

/**
 * Full CRUD + reorder + show/hide for the public site's navbar
 * (FET-16: "create new items in navbar or can hide item in navbar,
 * can perform crud operation in navbar items"). Flat list from the
 * backend, grouped here into top-level items with their dropdown
 * children indented beneath — reordering moves an item within its
 * own level (top-level order and each parent's children order are
 * independent), which is all `reorderNavbarItems` needs since order
 * is just a number per document, not a nested array.
 */
export default function NavbarTab() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const all = await websiteService.listAllNavbarItems();
      setItems(all);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topLevel = items.filter((i) => !i.parentId).sort((a, b) => a.order - b.order);
  const childrenOf = (parentId) =>
    items.filter((i) => i.parentId === parentId).sort((a, b) => a.order - b.order);

  const openCreate = () => {
    setActiveItem(null);
    setDialogOpen(true);
  };
  const openEdit = (item) => {
    setActiveItem(item);
    setDialogOpen(true);
  };

  const toggleActive = async (item) => {
    setBusyId(item._id);
    try {
      await websiteService.updateNavbarItem(item._id, { isActive: !item.isActive });
      await load();
    } catch (error) {
      toast({ title: t('website.navbar.updateError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (item, direction) => {
    const siblings = item.parentId ? childrenOf(item.parentId) : topLevel;
    const index = siblings.findIndex((s) => s._id === item._id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

    setBusyId(item._id);
    try {
      await websiteService.reorderNavbarItems(reordered.map((s) => s._id));
      await load();
    } catch (error) {
      toast({ title: t('website.navbar.reorderError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: t('website.navbar.deleteConfirmTitle', { label: item.label }),
      description: item.parentId
        ? t('website.navbar.deleteConfirmChildDescription')
        : t('website.navbar.deleteConfirmParentDescription'),
      confirmLabel: t('common.delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    setBusyId(item._id);
    try {
      await websiteService.deleteNavbarItem(item._id);
      await load();
    } catch (error) {
      toast({ title: t('website.navbar.deleteError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (item, siblingCount, index, depth = 0) => (
    <div
      key={item._id}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
      style={{ marginLeft: depth * 28 }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {depth > 0 ? <CornerDownRight size={14} className="shrink-0 text-muted-foreground" /> : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.label}</p>
          <p className="truncate text-xs text-muted-foreground">{item.href}</p>
        </div>
        <Badge variant={item.isActive ? 'success' : 'neutral'}>{item.isActive ? t('common.visible') : t('common.hidden')}</Badge>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" disabled={busyId === item._id || index === 0} onClick={() => move(item, -1)} title={t('common.moveUp')}>
          <ArrowUp size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={busyId === item._id || index === siblingCount - 1}
          onClick={() => move(item, 1)}
          title={t('common.moveDown')}
        >
          <ArrowDown size={14} />
        </Button>
        <Button variant="ghost" size="icon" disabled={busyId === item._id} onClick={() => toggleActive(item)} title={item.isActive ? t('common.hide') : t('common.show')}>
          {item.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
        </Button>
        <Button variant="ghost" size="icon" disabled={busyId === item._id} onClick={() => openEdit(item)} title={t('common.edit')}>
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" size="icon" disabled={busyId === item._id} onClick={() => remove(item)} title={t('common.delete')}>
          <Trash2 size={14} className="text-destructive" />
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus size={15} /> {t('website.navbar.addItem')}
        </Button>
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={5} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : topLevel.length === 0 ? (
        <EmptyState icon={MenuIcon} title={t('website.navbar.emptyTitle')} description={t('website.navbar.emptyDescription')} />
      ) : (
        <div className="space-y-2">
          {topLevel.map((item, index) => (
            <div key={item._id} className="space-y-2">
              {renderRow(item, topLevel.length, index)}
              {childrenOf(item._id).map((child, childIndex) =>
                renderRow(child, childrenOf(item._id).length, childIndex, 1),
              )}
            </div>
          ))}
        </div>
      )}

      <NavbarItemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={activeItem}
        topLevelItems={topLevel}
        onSaved={load}
      />
    </div>
  );
}
