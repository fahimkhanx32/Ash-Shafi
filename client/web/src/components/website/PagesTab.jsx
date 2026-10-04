import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, FileText, Pencil, Trash2, UploadCloud, Archive, EyeOff } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import PageFormDialog from './PageFormDialog.jsx';

const STATUS_VARIANT = { DRAFT: 'neutral', PUBLISHED: 'success', ARCHIVED: 'warning' };

/**
 * FET-16 completion pass — CMS pages admin
 * (`server/src/modules/cms`'s `/cms/pages*` — Home/About/Doctor/
 * Services/Appointment/Schedule/Location/FAQ/Blog/Contact/Privacy/
 * Terms/Custom, DRAFT→PUBLISHED→ARCHIVED). This existed since BET-16
 * with no admin caller at all — the exact "no admin UI for Pages" gap
 * this pass closes. Lifecycle actions (publish/unpublish/archive) are
 * their own dedicated endpoints/permission (`WEBSITE_PUBLISH`, not
 * `WEBSITE_MANAGE`) on the backend, but this UI doesn't yet split
 * that into a separate role check client-side — same "route/backend
 * is the real boundary, UI gating is just ergonomics" precedent this
 * project already follows elsewhere (`PatientWorkspacePage.jsx`'s
 * `canWrite`, etc.): if the signed-in user actually lacks
 * `WEBSITE_PUBLISH`, the button click 403s from the server, same
 * outcome as if the button were hidden, just one API round-trip
 * later.
 */
export default function PagesTab() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [pages, setPages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activePage, setActivePage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await websiteService.listPages({ page, limit: 20 });
      setPages(result.items);
      setPagination(result.pagination);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setActivePage(null);
    setDialogOpen(true);
  };
  const openEdit = (p) => {
    setActivePage(p);
    setDialogOpen(true);
  };

  const withBusy = async (id, fn, errorTitle) => {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (error) {
      toast({ title: errorTitle, description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: t('website.pages.deleteConfirmTitle', 'Delete "{{title}}"?', { title: p.title }),
      description: t('website.pages.deleteConfirmDescription', 'This permanently removes the page.'),
      confirmLabel: t('common.delete'),
      variant: 'destructive',
    });
    if (!ok) return;
    await withBusy(p._id, () => websiteService.deletePage(p._id), t('website.pages.deleteError', 'Could not delete'));
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus size={15} /> {t('website.pages.addPage', 'New page')}
        </Button>
      </div>

      {state === 'loading' ? (
        <SkeletonList rows={5} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : pages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('website.pages.emptyTitle', 'No pages yet')}
          description={t('website.pages.emptyDescription', 'Create a Home, About, Services, FAQ, Blog, or custom page for the public site.')}
        />
      ) : (
        <>
          <div className="space-y-2">
            {pages.map((p) => (
              <div key={p._id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <Badge variant={STATUS_VARIANT[p.status] || 'neutral'}>{p.status}</Badge>
                    <Badge variant="neutral">{p.pageType}</Badge>
                    {p.showInNav ? <Badge variant="neutral">{t('website.pages.inNav', 'In nav')}</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {p.status !== 'PUBLISHED' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busyId === p._id}
                      onClick={() => withBusy(p._id, () => websiteService.publishPage(p._id), t('website.pages.publishError', 'Could not publish'))}
                      title={t('website.pages.publish', 'Publish')}
                    >
                      <UploadCloud size={14} />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busyId === p._id}
                      onClick={() => withBusy(p._id, () => websiteService.unpublishPage(p._id), t('website.pages.unpublishError', 'Could not unpublish'))}
                      title={t('website.pages.unpublish', 'Unpublish')}
                    >
                      <EyeOff size={14} />
                    </Button>
                  )}
                  {p.status !== 'ARCHIVED' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busyId === p._id}
                      onClick={() => withBusy(p._id, () => websiteService.archivePage(p._id), t('website.pages.archiveError', 'Could not archive'))}
                      title={t('website.pages.archive', 'Archive')}
                    >
                      <Archive size={14} />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" disabled={busyId === p._id} onClick={() => openEdit(p)} title={t('common.edit')}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={busyId === p._id} onClick={() => remove(p)} title={t('common.delete')}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {pagination && pagination.totalPages > 1 ? (
            <div className="mt-4">
              <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}

      <PageFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        page={activePage}
        onSaved={load}
      />
    </div>
  );
}
