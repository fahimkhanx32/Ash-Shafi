import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Award, Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import CertificateFormDialog from './CertificateFormDialog.jsx';

/** Full CRUD + reorder + show/hide for the homepage certificates grid. */
export default function CertificatesTab() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [certificates, setCertificates] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCertificate, setActiveCertificate] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const all = await websiteService.listAllCertificates();
      setCertificates(all);
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
    setActiveCertificate(null);
    setDialogOpen(true);
  };
  const openEdit = (certificate) => {
    setActiveCertificate(certificate);
    setDialogOpen(true);
  };

  const toggleActive = async (certificate) => {
    setBusyId(certificate._id);
    try {
      await websiteService.updateCertificate(certificate._id, { isActive: !certificate.isActive });
      await load();
    } catch (error) {
      toast({ title: t('website.certificates.updateError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (certificate, direction) => {
    const index = certificates.findIndex((c) => c._id === certificate._id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= certificates.length) return;
    const reordered = [...certificates];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

    setBusyId(certificate._id);
    try {
      await websiteService.reorderCertificates(reordered.map((c) => c._id));
      await load();
    } catch (error) {
      toast({ title: t('website.certificates.reorderError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (certificate) => {
    const ok = await confirm({
      title: t('website.certificates.deleteConfirmTitle', { name: certificate.name }),
      description: t('website.certificates.deleteConfirmDescription'),
      confirmLabel: t('common.delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    setBusyId(certificate._id);
    try {
      await websiteService.deleteCertificate(certificate._id);
      await load();
    } catch (error) {
      toast({ title: t('website.certificates.deleteError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus size={15} /> {t('website.certificates.addCertificate')}
        </Button>
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={4} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : certificates.length === 0 ? (
        <EmptyState icon={Award} title={t('website.certificates.emptyTitle')} description={t('website.certificates.emptyDescription')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((certificate, index) => (
            <div key={certificate._id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex h-20 items-center justify-center rounded-md bg-muted p-2">
                {certificate.image?.url ? (
                  <img src={certificate.image.url} alt={certificate.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <Award size={20} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">{certificate.name}</p>
                <Badge variant={certificate.isActive ? 'success' : 'neutral'}>{certificate.isActive ? t('common.visible') : t('common.hidden')}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Button variant="ghost" size="icon" disabled={busyId === certificate._id || index === 0} onClick={() => move(certificate, -1)} title={t('common.moveUp')}>
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === certificate._id || index === certificates.length - 1}
                  onClick={() => move(certificate, 1)}
                  title={t('common.moveDown')}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === certificate._id} onClick={() => toggleActive(certificate)} title={certificate.isActive ? t('common.hide') : t('common.show')}>
                  {certificate.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === certificate._id} onClick={() => openEdit(certificate)} title={t('common.edit')}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === certificate._id} onClick={() => remove(certificate)} title={t('common.delete')}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CertificateFormDialog open={dialogOpen} onOpenChange={setDialogOpen} certificate={activeCertificate} onSaved={load} />
    </div>
  );
}
