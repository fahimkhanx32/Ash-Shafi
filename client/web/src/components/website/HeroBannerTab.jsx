import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Video, Image as ImageIcon, Save } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { SkeletonList } from '../ui/skeleton.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = {
  eyebrow: '',
  heading: '',
  headingAccent: '',
  description: '',
  ctaPrimaryLabel: '',
  ctaPrimaryHref: '',
  ctaSecondaryLabel: '',
  ctaSecondaryHref: '',
  overlayOpacity: 30,
};

/**
 * Homepage hero/banner editor (FET-16: "can upload bg image or video
 * in banner"). Text fields save via `PUT /cms/hero-banner`; the
 * background media is a separate upload
 * (`POST /cms/hero-banner/media`, image OR video, replaces whatever
 * was there before) since it's a different kind of write (a file, not
 * form fields) with its own progress/loading state.
 */
export default function HeroBannerTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [backgroundMedia, setBackgroundMedia] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const banner = await websiteService.getHeroBanner();
      if (banner) {
        setForm({
          eyebrow: banner.eyebrow || '',
          heading: banner.heading || '',
          headingAccent: banner.headingAccent || '',
          description: banner.description || '',
          ctaPrimaryLabel: banner.ctaPrimaryLabel || '',
          ctaPrimaryHref: banner.ctaPrimaryHref || '',
          ctaSecondaryLabel: banner.ctaSecondaryLabel || '',
          ctaSecondaryHref: banner.ctaSecondaryHref || '',
          overlayOpacity: banner.overlayOpacity ?? 30,
        });
        setBackgroundMedia(banner.backgroundMedia?.url ? banner.backgroundMedia : null);
      }
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await websiteService.upsertHeroBanner(form);
      toast({ title: t('website.hero.saved'), variant: 'success' });
    } catch (error) {
      toast({ title: t('website.hero.saveError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const banner = await websiteService.uploadHeroBannerMedia(file, (progressEvent) => {
        if (progressEvent.total) {
          setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        }
      });
      setBackgroundMedia(banner.backgroundMedia);
      toast({ title: t('website.hero.backgroundUpdated'), variant: 'success' });
    } catch (error) {
      toast({ title: t('website.hero.uploadError'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (state === 'loading') return <SkeletonList rows={6} />;
  if (state === 'error') return <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('website.hero.eyebrow')}</label>
            <input
              maxLength={80}
              className={inputClass}
              value={form.eyebrow}
              onChange={(e) => setForm((p) => ({ ...p, eyebrow: e.target.value }))}
              placeholder="Women's Health Clinic"
            />
          </div>
          <div>
            <label className={labelClass}>{t('website.hero.accentWord')}</label>
            <input
              maxLength={60}
              className={inputClass}
              value={form.headingAccent}
              onChange={(e) => setForm((p) => ({ ...p, headingAccent: e.target.value }))}
              placeholder="Womanhood"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('website.hero.heading')}</label>
          <input
            required
            maxLength={200}
            className={inputClass}
            value={form.heading}
            onChange={(e) => setForm((p) => ({ ...p, heading: e.target.value }))}
            placeholder="Exceptional Care For Every Stage of"
          />
        </div>

        <div>
          <label className={labelClass}>{t('website.hero.description')}</label>
          <textarea
            rows={3}
            maxLength={400}
            className={textareaClass}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('website.hero.primaryLabel')}</label>
            <input
              maxLength={60}
              className={inputClass}
              value={form.ctaPrimaryLabel}
              onChange={(e) => setForm((p) => ({ ...p, ctaPrimaryLabel: e.target.value }))}
              placeholder="Book Appointment"
            />
          </div>
          <div>
            <label className={labelClass}>{t('website.hero.primaryLink')}</label>
            <input
              maxLength={300}
              className={inputClass}
              value={form.ctaPrimaryHref}
              onChange={(e) => setForm((p) => ({ ...p, ctaPrimaryHref: e.target.value }))}
              placeholder="/portal/register"
            />
          </div>
          <div>
            <label className={labelClass}>{t('website.hero.secondaryLabel')}</label>
            <input
              maxLength={60}
              className={inputClass}
              value={form.ctaSecondaryLabel}
              onChange={(e) => setForm((p) => ({ ...p, ctaSecondaryLabel: e.target.value }))}
              placeholder="Our Services"
            />
          </div>
          <div>
            <label className={labelClass}>{t('website.hero.secondaryLink')}</label>
            <input
              maxLength={300}
              className={inputClass}
              value={form.ctaSecondaryHref}
              onChange={(e) => setForm((p) => ({ ...p, ctaSecondaryHref: e.target.value }))}
              placeholder="/services"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            {t('website.hero.overlay', { percent: form.overlayOpacity })}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            className="w-full"
            value={form.overlayOpacity}
            onChange={(e) => setForm((p) => ({ ...p, overlayOpacity: Number(e.target.value) }))}
          />
        </div>

        <Button type="submit" size="sm" disabled={saving}>
          <Save size={14} /> {saving ? t('common.saving') : t('website.hero.saveText')}
        </Button>
      </form>

      <div>
        <label className={labelClass}>{t('website.hero.backgroundMedia')}</label>
        <div className="rounded-xl border border-dashed border-border bg-card p-4">
          {backgroundMedia?.url ? (
            <div className="mb-3 overflow-hidden rounded-lg border border-border">
              {backgroundMedia.resourceType === 'video' ? (
                <video src={backgroundMedia.url} className="aspect-video w-full object-cover" muted loop controls />
              ) : (
                <img src={backgroundMedia.url} alt={t('website.hero.backgroundAlt')} className="aspect-video w-full object-cover" />
              )}
            </div>
          ) : (
            <div className="mb-3 flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ImageIcon size={28} />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} /> {uploading ? t('website.hero.uploading', { percent: uploadProgress }) : t('website.hero.uploadButton')}
          </Button>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Video size={12} /> {t('website.hero.uploadHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
