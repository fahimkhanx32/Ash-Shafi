import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, Image as ImageIcon } from 'lucide-react';

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
import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const BLOCK_TYPES = ['HEADING', 'PARAGRAPH', 'IMAGE', 'CTA', 'QUOTE'];

const newBlock = (type) => ({ type, body: '', imageUrl: '', imageAlt: '', ctaLabel: '', ctaHref: '' });

const emptyForm = { key: '', title: '', blocks: [] };

/**
 * Create/edit dialog for a homepage section. Two modes:
 *  - CUSTOM section (create, or edit an existing custom one): title,
 *    a block-based content editor (reusing the same HEADING/
 *    PARAGRAPH/IMAGE/CTA/QUOTE primitives as CMS pages), and — once
 *    it has an id (i.e. after the first save) — an optional
 *    background image/video upload.
 *  - Built-in section (hero/services/certificates/stats/about): this
 *    dialog only offers the title override here; its real content is
 *    edited from that section's own tab.
 */
export default function SectionFormDialog({ open, onOpenChange, section, onSaved }) {
  const { t } = useTranslation();
  const bgFileInputRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [backgroundMedia, setBackgroundMedia] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [error, setError] = useState('');
  const [savedSectionId, setSavedSectionId] = useState(null);

  const isEdit = Boolean(section);
  const isBuiltIn = section && section.type !== 'CUSTOM';
  // True once a CUSTOM section exists in the DB for this dialog
  // session — either because we opened it in edit mode, or because
  // the first "Create section" submit already succeeded. Later
  // submits in the same session must PATCH that id, not create a
  // second section.
  const hasPersistedSection = isEdit || Boolean(savedSectionId);

  useEffect(() => {
    if (!open) return;
    setForm({
      key: section?.key || '',
      title: section?.title || '',
      blocks: section?.blocks?.length ? section.blocks : [],
    });
    setBackgroundMedia(section?.backgroundMedia?.url ? section.backgroundMedia : null);
    setSavedSectionId(section?._id || null);
    setError('');
  }, [open, section]);

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving) setError('');
    onOpenChange(nextOpen);
  };

  const addBlock = (type) => {
    setForm((p) => ({ ...p, blocks: [...p.blocks, newBlock(type)] }));
  };
  const updateBlock = (index, patch) => {
    setForm((p) => ({ ...p, blocks: p.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) }));
  };
  const removeBlock = (index) => {
    setForm((p) => ({ ...p, blocks: p.blocks.filter((_, i) => i !== index) }));
  };
  const moveBlock = (index, direction) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= form.blocks.length) return;
    setForm((p) => {
      const blocks = [...p.blocks];
      [blocks[index], blocks[swapIndex]] = [blocks[swapIndex], blocks[index]];
      return { ...p, blocks };
    });
  };

  const handleBlockImageUpload = async (index, file) => {
    try {
      const uploaded = await websiteService.uploadCertificateImage(file);
      updateBlock(index, { imageUrl: uploaded.url });
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  const handleBackgroundUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !savedSectionId) return;
    setUploadingBg(true);
    setError('');
    try {
      const updated = await websiteService.uploadSectionMedia(savedSectionId, file);
      setBackgroundMedia(updated.backgroundMedia);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setUploadingBg(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isBuiltIn) {
        await websiteService.updateSection(section._id, { title: form.title.trim() });
      } else if (hasPersistedSection) {
        await websiteService.updateSection(section?._id || savedSectionId, {
          title: form.title.trim(),
          blocks: form.blocks.map((b, i) => ({ ...b, order: i })),
        });
      } else {
        const created = await websiteService.createSection({
          key: form.key.trim() || undefined,
          title: form.title.trim(),
          blocks: form.blocks.map((b, i) => ({ ...b, order: i })),
        });
        setSavedSectionId(created._id);
      }
      onSaved?.();
      if (!hasPersistedSection) {
        // Keep the dialog open right after the very first save so the
        // admin can immediately upload a background — `uploadSectionMedia`
        // needs the id this create just produced. Every save after
        // this one takes the update branch above and closes normally.
        return;
      }
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-2xl">
      {open ? (
        <form onSubmit={handleSubmit} className="relative max-h-[80vh] overflow-y-auto">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>
              {isBuiltIn ? t('website.sectionDialog.renameTitle', { title: section.title || section.key }) : isEdit ? t('website.sectionDialog.editTitle') : t('website.sectionDialog.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {isBuiltIn
                ? t('website.sectionDialog.builtInDescription')
                : t('website.sectionDialog.customDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {!hasPersistedSection ? (
              <div>
                <label className={labelClass}>{t('website.sectionDialog.sectionKey')}</label>
                <input
                  maxLength={80}
                  className={inputClass}
                  placeholder={t('website.sectionDialog.sectionKeyPlaceholder')}
                  value={form.key}
                  onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                />
              </div>
            ) : null}

            <div>
              <label className={labelClass}>{t('website.sectionDialog.titleField')}</label>
              <input
                required
                maxLength={150}
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            {!isBuiltIn ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className={labelClass}>{t('website.sectionDialog.contentBlocks')}</label>
                  <div className="flex flex-wrap gap-1">
                    {BLOCK_TYPES.map((type) => (
                      <Button key={type} type="button" variant="outline" size="sm" onClick={() => addBlock(type)}>
                        <Plus size={12} /> {type}
                      </Button>
                    ))}
                  </div>
                </div>

                {form.blocks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {t('website.sectionDialog.noBlocksYet')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.blocks.map((block, index) => (
                      <div key={index} className="rounded-lg border border-border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.type}</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                              <ArrowUp size={13} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === form.blocks.length - 1}
                              onClick={() => moveBlock(index, 1)}
                            >
                              <ArrowDown size={13} />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(index)}>
                              <Trash2 size={13} className="text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {block.type === 'IMAGE' ? (
                          <div className="space-y-2">
                            {block.imageUrl ? (
                              <img src={block.imageUrl} alt={block.imageAlt} className="h-28 w-full rounded-md object-cover" />
                            ) : null}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              id={`block-image-${index}`}
                              onChange={(e) => e.target.files?.[0] && handleBlockImageUpload(index, e.target.files[0])}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById(`block-image-${index}`)?.click()}
                            >
                              <Upload size={12} /> {block.imageUrl ? t('website.sectionDialog.replaceImage') : t('website.sectionDialog.uploadImage')}
                            </Button>
                            <input
                              className={inputClass}
                              placeholder={t('website.sectionDialog.altText')}
                              value={block.imageAlt}
                              onChange={(e) => updateBlock(index, { imageAlt: e.target.value })}
                            />
                          </div>
                        ) : block.type === 'CTA' ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              placeholder={t('website.sectionDialog.buttonLabel')}
                              value={block.ctaLabel}
                              onChange={(e) => updateBlock(index, { ctaLabel: e.target.value })}
                            />
                            <input
                              className={inputClass}
                              placeholder={t('website.sectionDialog.buttonLink')}
                              value={block.ctaHref}
                              onChange={(e) => updateBlock(index, { ctaHref: e.target.value })}
                            />
                          </div>
                        ) : (
                          <textarea
                            rows={block.type === 'HEADING' ? 1 : 3}
                            className={textareaClass}
                            placeholder={block.type === 'HEADING' ? t('website.sectionDialog.headingText') : t('website.sectionDialog.bodyText')}
                            value={block.body}
                            onChange={(e) => updateBlock(index, { body: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {!isBuiltIn && savedSectionId ? (
              <div>
                <label className={labelClass}>{t('website.sectionDialog.backgroundOptional')}</label>
                <div className="rounded-lg border border-dashed border-border p-3">
                  {backgroundMedia?.url ? (
                    <div className="mb-2 overflow-hidden rounded-md">
                      {backgroundMedia.resourceType === 'video' ? (
                        <video src={backgroundMedia.url} className="aspect-video w-full object-cover" muted loop controls />
                      ) : (
                        <img src={backgroundMedia.url} alt={t('website.sectionDialog.backgroundAlt')} className="aspect-video w-full object-cover" />
                      )}
                    </div>
                  ) : (
                    <div className="mb-2 flex aspect-video w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ImageIcon size={22} />
                    </div>
                  )}
                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    className="hidden"
                    onChange={handleBackgroundUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={uploadingBg}
                    onClick={() => bgFileInputRef.current?.click()}
                  >
                    <Upload size={13} /> {uploadingBg ? t('website.sectionDialog.uploading') : t('website.hero.uploadButton')}
                  </Button>
                </div>
              </div>
            ) : !isBuiltIn && !isEdit ? (
              <p className="text-xs text-muted-foreground">
                {t('website.sectionDialog.saveFirstHint')}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {savedSectionId && !isEdit ? t('common.done') : t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('common.saving') : savedSectionId && !isEdit ? t('website.sectionDialog.saveAgain') : isEdit ? t('common.saveChanges') : t('website.sectionDialog.createSection')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
