import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, LayoutTemplate, Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Trash2, Lock } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import SectionFormDialog from './SectionFormDialog.jsx';

const BUILT_IN_LABEL_KEYS = {
  HERO: 'website.sections.type.hero',
  SERVICES: 'website.sections.type.services',
  CERTIFICATES: 'website.sections.type.certificates',
  STATS: 'website.sections.type.stats',
  ABOUT: 'website.sections.type.about',
  WOMEN_HEALTH: 'website.sections.type.womenHealth',
  OFFICE: 'website.sections.type.office',
  SUPPORT: 'website.sections.type.support',
  VIDEO: 'website.sections.type.video',
  TESTIMONIALS: 'website.sections.type.testimonials',
  CUSTOM: 'website.sections.type.custom',
};

/**
 * The homepage layout registry (FET-16: "can create new section as
 * per user's wish ... CRUD operation ... in any section"). Reorders
 * and hides/shows every section — built-in or admin-created — in one
 * place, and is where a brand-new CUSTOM section gets created. A
 * built-in section (hero/services/certificates/stats/about) can be
 * reordered/hidden/renamed here but not deleted (`isDeletable: false`
 * on the backend); its actual content is still edited from that
 * section's own tab.
 */
export default function SectionsTab() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [sections, setSections] = useState([]);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const all = await websiteService.listAllSections();
      setSections(all.sort((a, b) => a.order - b.order));
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
    setActiveSection(null);
    setDialogOpen(true);
  };
  const openEdit = (section) => {
    setActiveSection(section);
    setDialogOpen(true);
  };

  const toggleActive = async (section) => {
    setBusyId(section._id);
    try {
      await websiteService.updateSection(section._id, { isActive: !section.isActive });
      await load();
    } catch (error) {
      toast({ title: t('website.sections.updateError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (section, direction) => {
    const index = sections.findIndex((s) => s._id === section._id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

    setBusyId(section._id);
    try {
      await websiteService.reorderSections(reordered.map((s) => s._id));
      await load();
    } catch (error) {
      toast({ title: t('website.sections.reorderError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (section) => {
    const ok = await confirm({
      title: t('website.sections.deleteConfirmTitle', { title: section.title || section.key }),
      description: t('website.sections.deleteConfirmDescription'),
      confirmLabel: t('common.delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    setBusyId(section._id);
    try {
      await websiteService.deleteSection(section._id);
      await load();
    } catch (error) {
      toast({ title: t('website.sections.deleteError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('website.sections.intro')}
      </p>

      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus size={15} /> {t('website.sections.createNew')}
        </Button>
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={5} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : sections.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title={t('website.sections.emptyTitle')} description={t('website.sections.emptyDescription')} />
      ) : (
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div key={section._id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{section.title || section.key}</p>
                  <p className="truncate text-xs text-muted-foreground">{section.key}</p>
                </div>
                <Badge variant="neutral">{BUILT_IN_LABEL_KEYS[section.type] ? t(BUILT_IN_LABEL_KEYS[section.type]) : section.type}</Badge>
                <Badge variant={section.isActive ? 'success' : 'neutral'}>{section.isActive ? t('common.visible') : t('common.hidden')}</Badge>
                {!section.isDeletable ? (
                  <span title={t('website.sections.builtInLocked')}>
                    <Lock size={12} className="text-muted-foreground" />
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" disabled={busyId === section._id || index === 0} onClick={() => move(section, -1)} title={t('common.moveUp')}>
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === section._id || index === sections.length - 1}
                  onClick={() => move(section, 1)}
                  title={t('common.moveDown')}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === section._id} onClick={() => toggleActive(section)} title={section.isActive ? t('common.hide') : t('common.show')}>
                  {section.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>
                <Button variant="ghost" size="icon" disabled={busyId === section._id} onClick={() => openEdit(section)} title={t('common.edit')}>
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busyId === section._id || !section.isDeletable}
                  onClick={() => remove(section)}
                  title={section.isDeletable ? t('common.delete') : t('website.sections.builtInCannotDelete')}
                >
                  <Trash2 size={14} className={section.isDeletable ? 'text-destructive' : 'text-muted-foreground/40'} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionFormDialog open={dialogOpen} onOpenChange={setDialogOpen} section={activeSection} onSaved={load} />
    </div>
  );
}
