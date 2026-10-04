import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Stethoscope, Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import ServiceFormDialog from './ServiceFormDialog.jsx';

/**
 * Services CRUD (`server/src/modules/cms`'s `/cms/services`
 * endpoints already existed for BET-16; no admin UI existed for them
 * until now). Reordering reuses the same "recompute the whole
 * ordered array, PATCH it" approach `updateService`'s `order` field
 * supports one row at a time, so moving an item calls
 * `updateService` twice (swap two orders) rather than needing a
 * dedicated reorder endpoint like navbar/certificates/sections have.
 */
export default function ServicesTab() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [services, setServices] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeService, setActiveService] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const all = await websiteService.listAllServices();
      setServices(all.sort((a, b) => a.order - b.order));
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
    setActiveService(null);
    setDialogOpen(true);
  };
  const openEdit = (service) => {
    setActiveService(service);
    setDialogOpen(true);
  };

  const toggleActive = async (service) => {
    setBusyId(service._id);
    try {
      await websiteService.updateService(service._id, { isActive: !service.isActive });
      await load();
    } catch (error) {
      toast({ title: t('website.services.updateError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (service, direction) => {
    const index = services.findIndex((s) => s._id === service._id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= services.length) return;
    const other = services[swapIndex];

    setBusyId(service._id);
    try {
      await Promise.all([
        websiteService.updateService(service._id, { order: other.order }),
        websiteService.updateService(other._id, { order: service.order }),
      ]);
      await load();
    } catch (error) {
      toast({ title: t('website.services.reorderError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (service) => {
    const ok = await confirm({
      title: t('website.services.deleteConfirmTitle', { title: service.title }),
      description: t('website.services.deleteConfirmDescription'),
      confirmLabel: t('common.delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    setBusyId(service._id);
    try {
      await websiteService.deleteService(service._id);
      await load();
    } catch (error) {
      toast({ title: t('website.services.deleteError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus size={15} /> {t('website.services.addService')}
        </Button>
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={4} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : services.length === 0 ? (
        <EmptyState icon={Stethoscope} title={t('website.services.emptyTitle')} description={t('website.services.emptyDescription')} />
      ) : (
        <div className="space-y-2">
          {services.map((service, index) => (
            <div key={service._id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{service.title}</p>
                  <Badge variant={service.isActive ? 'success' : 'neutral'}>{service.isActive ? t('common.visible') : t('common.hidden')}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{service.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" disabled={busyId === service._id || index === 0} onClick={() => move(service, -1)} title={t('common.moveUp')}>
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === service._id || index === services.length - 1}
                  onClick={() => move(service, 1)}
                  title={t('common.moveDown')}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === service._id} onClick={() => toggleActive(service)} title={service.isActive ? t('common.hide') : t('common.show')}>
                  {service.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === service._id} onClick={() => openEdit(service)} title={t('common.edit')}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === service._id} onClick={() => remove(service)} title={t('common.delete')}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceFormDialog open={dialogOpen} onOpenChange={setDialogOpen} service={activeService} onSaved={load} />
    </div>
  );
}
