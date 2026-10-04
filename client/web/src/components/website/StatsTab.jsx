import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, BarChart3, Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import StatFormDialog from './StatFormDialog.jsx';

/**
 * FET-16 completion pass — homepage stats strip ("15+ Years of
 * Excellence", "18,500+ Happy Patients"). `server/src/modules/cms`'s
 * `/cms/stats` endpoints existed since BET-16 with no admin UI for
 * them (the exact gap this pass closes) — built as a straight copy of
 * `ServicesTab.jsx`'s already-established list/reorder/toggle/dialog
 * pattern, since `HomepageStat` is the same shape of collection
 * (title-ish/order/isActive) as `Service`.
 */
export default function StatsTab() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [stats, setStats] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStat, setActiveStat] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const all = await websiteService.listAllStats();
      setStats(all.sort((a, b) => a.order - b.order));
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
    setActiveStat(null);
    setDialogOpen(true);
  };
  const openEdit = (stat) => {
    setActiveStat(stat);
    setDialogOpen(true);
  };

  const toggleActive = async (stat) => {
    setBusyId(stat._id);
    try {
      await websiteService.updateStat(stat._id, { isActive: !stat.isActive });
      await load();
    } catch (error) {
      toast({ title: t('website.stats.updateError', 'Could not update stat'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (stat, direction) => {
    const index = stats.findIndex((s) => s._id === stat._id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= stats.length) return;
    const other = stats[swapIndex];

    setBusyId(stat._id);
    try {
      await Promise.all([
        websiteService.updateStat(stat._id, { order: other.order }),
        websiteService.updateStat(other._id, { order: stat.order }),
      ]);
      await load();
    } catch (error) {
      toast({ title: t('website.stats.reorderError', 'Could not reorder'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (stat) => {
    const ok = await confirm({
      title: t('website.stats.deleteConfirmTitle', 'Delete "{{label}}"?', { label: stat.label }),
      description: t('website.stats.deleteConfirmDescription', 'This removes it from the homepage stats strip.'),
      confirmLabel: t('common.delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    setBusyId(stat._id);
    try {
      await websiteService.deleteStat(stat._id);
      await load();
    } catch (error) {
      toast({ title: t('website.stats.deleteError', 'Could not delete'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus size={15} /> {t('website.stats.addStat', 'Add stat')}
        </Button>
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={4} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : stats.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={t('website.stats.emptyTitle', 'No stats yet')}
          description={t('website.stats.emptyDescription', 'Add a figure like "15+ Years of Excellence" to show on the homepage.')}
        />
      ) : (
        <div className="space-y-2">
          {stats.map((stat, index) => (
            <div key={stat._id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{stat.value} — {stat.label}</p>
                  <Badge variant={stat.isActive ? 'success' : 'neutral'}>{stat.isActive ? t('common.visible') : t('common.hidden')}</Badge>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" disabled={busyId === stat._id || index === 0} onClick={() => move(stat, -1)} title={t('common.moveUp')}>
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === stat._id || index === stats.length - 1}
                  onClick={() => move(stat, 1)}
                  title={t('common.moveDown')}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === stat._id} onClick={() => toggleActive(stat)} title={stat.isActive ? t('common.hide') : t('common.show')}>
                  {stat.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === stat._id} onClick={() => openEdit(stat)} title={t('common.edit')}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === stat._id} onClick={() => remove(stat)} title={t('common.delete')}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <StatFormDialog open={dialogOpen} onOpenChange={setDialogOpen} stat={activeStat} onSaved={load} />
    </div>
  );
}
