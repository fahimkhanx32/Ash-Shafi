import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Trash2, Copy, Image as ImageIcon } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { SkeletonCards } from '../ui/skeleton.jsx';
import { Pagination } from '../ui/pagination.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

/**
 * FET-16 completion pass — the public-website media library
 * (`server/src/modules/cms`'s `GET/POST /cms/media`,
 * `DELETE /cms/media/:id`, backed by `Media`/`media-storage.service.js`
 * — Cloudinary, plain public delivery). No admin browser/uploader
 * existed for this at all before this pass — every other tab
 * (Hero/Sections/Certificates) uploads its own file directly through
 * its own entity's upload endpoint, but the shared library itself
 * (browse everything already uploaded, grab a URL to reuse, delete
 * unused assets) had no UI. Real server-side pagination — this
 * deliberately does not fetch every asset into the browser to fake a
 * full-library view (same page-size discipline `OutstandingBalancesPanel.jsx`
 * documents for invoices).
 */
export default function MediaTab() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await websiteService.listMedia({ page, limit: 24 });
      setItems(result.items);
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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      await websiteService.uploadMedia(file);
      toast({ title: t('website.media.uploadSuccess', 'Uploaded.'), variant: 'success' });
      setPage(1);
      await load();
    } catch (error) {
      toast({ title: t('website.media.uploadError', 'Upload failed'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t('website.media.urlCopied', 'URL copied.'), variant: 'success' });
    } catch {
      // Clipboard permission can be denied — not worth surfacing as an error state.
    }
  };

  const remove = async (media) => {
    const ok = await confirm({
      title: t('website.media.deleteConfirmTitle', 'Delete this file?'),
      description: t('website.media.deleteConfirmDescription', 'This removes it from the media library. Anything on the site still referencing it will show a broken image.'),
      confirmLabel: t('common.delete'),
      variant: 'destructive',
    });
    if (!ok) return;

    setBusyId(media._id);
    try {
      await websiteService.deleteMedia(media._id);
      await load();
    } catch (error) {
      toast({ title: t('website.media.deleteError', 'Could not delete'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={15} /> {uploading ? t('common.uploading', 'Uploading...') : t('website.media.upload', 'Upload file')}
        </Button>
      </div>

      {state === 'loading' ? (
        <SkeletonCards count={8} />
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={t('website.media.emptyTitle', 'No media yet')}
          description={t('website.media.emptyDescription', 'Uploaded images and videos will show up here for reuse across the site.')}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((media) => (
              <div key={media._id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
                <div className="aspect-video w-full bg-muted flex items-center justify-center overflow-hidden">
                  {media.cloudinaryResourceType === 'video' ? (
                    <video src={media.url} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={media.url} alt={media.altText || media.filename} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium" title={media.filename}>{media.filename}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(media.size)}</p>
                </div>
                <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => copyUrl(media.url)} title={t('website.media.copyUrl', 'Copy URL')}>
                    <Copy size={13} />
                  </Button>
                  <Button variant="secondary" size="icon" className="h-7 w-7" disabled={busyId === media._id} onClick={() => remove(media)} title={t('common.delete')}>
                    <Trash2 size={13} className="text-destructive" />
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
    </div>
  );
}
