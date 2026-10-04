import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ArrowUp, ArrowDown, Upload } from 'lucide-react';

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

const PAGE_TYPES = [
  'HOME', 'ABOUT', 'DOCTOR', 'SERVICES', 'APPOINTMENT', 'SCHEDULE',
  'LOCATION', 'FAQ', 'BLOG', 'CONTACT', 'PRIVACY', 'TERMS', 'CUSTOM',
];
const BLOCK_TYPES = ['HEADING', 'PARAGRAPH', 'IMAGE', 'CTA', 'QUOTE'];

const newBlock = (type) => ({ type, body: '', imageUrl: '', imageAlt: '', ctaLabel: '', ctaHref: '' });

const emptyForm = {
  title: '',
  slug: '',
  pageType: 'CUSTOM',
  excerpt: '',
  blocks: [],
  seoTitle: '',
  seoDescription: '',
  showInNav: false,
  navOrder: 0,
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Create/edit dialog for a CMS `Page` (Home/About/Doctor/Services/
 * Appointment/Schedule/Location/FAQ/Blog/Contact/Privacy/Terms/
 * Custom). The content-block editor here is a page-scoped copy of
 * `SectionFormDialog.jsx`'s — same HEADING/PARAGRAPH/IMAGE/CTA/QUOTE
 * primitives (`page.model.js`'s `contentBlockSchema` and
 * `homepage-section.model.js`'s `sectionBlockSchema` are identical
 * shapes) — kept as a separate copy rather than a shared extraction
 * since a Page also carries slug/pageType/SEO/nav-placement fields a
 * Section doesn't, and forcing both through one generic form would
 * make either harder to read than two focused ones.
 */
export default function PageFormDialog({ open, onOpenChange, page, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(page);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: page?.title || '',
      slug: page?.slug || '',
      pageType: page?.pageType || 'CUSTOM',
      excerpt: page?.excerpt || '',
      blocks: page?.blocks?.length ? page.blocks.map((b) => ({ ...b })) : [],
      seoTitle: page?.seo?.title || '',
      seoDescription: page?.seo?.description || '',
      showInNav: page?.showInNav || false,
      navOrder: page?.navOrder || 0,
    });
    setSlugTouched(Boolean(page));
    setError('');
  }, [open, page]);

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving) setError('');
    onOpenChange(nextOpen);
  };

  const handleTitleChange = (value) => {
    setForm((p) => ({
      ...p,
      title: value,
      slug: slugTouched ? p.slug : slugify(value),
    }));
  };

  const addBlock = (type) => setForm((p) => ({ ...p, blocks: [...p.blocks, newBlock(type)] }));
  const updateBlock = (index, patch) =>
    setForm((p) => ({ ...p, blocks: p.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) }));
  const removeBlock = (index) => setForm((p) => ({ ...p, blocks: p.blocks.filter((_, i) => i !== index) }));
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
      const uploaded = await websiteService.uploadMedia(file);
      updateBlock(index, { imageUrl: uploaded.url });
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        pageType: form.pageType,
        excerpt: form.excerpt.trim(),
        blocks: form.blocks.map((b, i) => ({
          type: b.type,
          body: b.body || '',
          imageUrl: b.imageUrl || '',
          imageAlt: b.imageAlt || '',
          ctaLabel: b.ctaLabel || '',
          ctaHref: b.ctaHref || '',
          order: i,
        })),
        seo: { title: form.seoTitle.trim(), description: form.seoDescription.trim() },
        showInNav: form.showInNav,
        navOrder: Number(form.navOrder) || 0,
      };
      if (isEdit) {
        await websiteService.updatePage(page._id, payload);
      } else {
        await websiteService.createPage(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} className="max-w-2xl">
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{isEdit ? t('website.pageDialog.editTitle', 'Edit page') : t('website.pageDialog.addTitle', 'New page')}</DialogTitle>
            <DialogDescription>{t('website.pageDialog.description', 'Pages are saved as a draft first — publish when ready from the list.')}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('website.pageDialog.titleField', 'Title')}</label>
                <input required maxLength={150} className={inputClass} value={form.title} onChange={(e) => handleTitleChange(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t('website.pageDialog.slug', 'Slug')}</label>
                <input
                  required
                  maxLength={160}
                  className={inputClass}
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((p) => ({ ...p, slug: e.target.value }));
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>{t('website.pageDialog.pageType', 'Page type')}</label>
                <select className={inputClass} value={form.pageType} onChange={(e) => setForm((p) => ({ ...p, pageType: e.target.value }))}>
                  {PAGE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.showInNav} onChange={(e) => setForm((p) => ({ ...p, showInNav: e.target.checked }))} />
                  {t('website.pageDialog.showInNav', 'Show in navbar')}
                </label>
                {form.showInNav ? (
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} w-24`}
                    value={form.navOrder}
                    onChange={(e) => setForm((p) => ({ ...p, navOrder: e.target.value }))}
                    title={t('website.pageDialog.navOrder', 'Nav order')}
                  />
                ) : null}
              </div>
            </div>

            <div>
              <label className={labelClass}>{t('website.pageDialog.excerpt', 'Excerpt')}</label>
              <textarea rows={2} maxLength={300} className={textareaClass} value={form.excerpt} onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('website.pageDialog.seoTitle', 'SEO title (optional)')}</label>
                <input maxLength={70} className={inputClass} value={form.seoTitle} onChange={(e) => setForm((p) => ({ ...p, seoTitle: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>{t('website.pageDialog.seoDescription', 'SEO description (optional)')}</label>
                <input maxLength={200} className={inputClass} value={form.seoDescription} onChange={(e) => setForm((p) => ({ ...p, seoDescription: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass}>{t('website.pageDialog.contentBlocks', 'Content blocks')}</label>
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
                  {t('website.pageDialog.noBlocksYet', 'No content blocks yet — add one above.')}
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
                          <Button type="button" variant="ghost" size="icon" disabled={index === form.blocks.length - 1} onClick={() => moveBlock(index, 1)}>
                            <ArrowDown size={13} />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(index)}>
                            <Trash2 size={13} className="text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {block.type === 'IMAGE' ? (
                        <div className="space-y-2">
                          {block.imageUrl ? <img src={block.imageUrl} alt={block.imageAlt} className="h-28 w-full rounded-md object-cover" /> : null}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            id={`page-block-image-${index}`}
                            onChange={(e) => e.target.files?.[0] && handleBlockImageUpload(index, e.target.files[0])}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`page-block-image-${index}`)?.click()}>
                            <Upload size={12} /> {block.imageUrl ? t('website.pageDialog.replaceImage', 'Replace image') : t('website.pageDialog.uploadImage', 'Upload image')}
                          </Button>
                          <input
                            className={inputClass}
                            placeholder={t('website.pageDialog.altText', 'Alt text')}
                            value={block.imageAlt}
                            onChange={(e) => updateBlock(index, { imageAlt: e.target.value })}
                          />
                        </div>
                      ) : block.type === 'CTA' ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className={inputClass}
                            placeholder={t('website.pageDialog.buttonLabel', 'Button label')}
                            value={block.ctaLabel}
                            onChange={(e) => updateBlock(index, { ctaLabel: e.target.value })}
                          />
                          <input
                            className={inputClass}
                            placeholder={t('website.pageDialog.buttonLink', 'Button link')}
                            value={block.ctaHref}
                            onChange={(e) => updateBlock(index, { ctaHref: e.target.value })}
                          />
                        </div>
                      ) : (
                        <textarea
                          rows={block.type === 'HEADING' ? 1 : 3}
                          className={textareaClass}
                          placeholder={block.type === 'HEADING' ? t('website.pageDialog.headingText', 'Heading text') : t('website.pageDialog.bodyText', 'Text')}
                          value={block.body}
                          onChange={(e) => updateBlock(index, { body: e.target.value })}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('common.saveChanges') : t('website.pages.addPage', 'New page')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
