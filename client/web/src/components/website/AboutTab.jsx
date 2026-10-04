import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Plus, Trash2 } from 'lucide-react';

import * as websiteService from '../../services/websiteService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { ErrorState } from '../ui/empty-state.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyHighlight = () => ({ key: crypto.randomUUID(), title: '', description: '', icon: '' });

/**
 * FET-16 completion pass — the homepage "About the clinic" block
 * (`AboutContent`, a singleton — `server/src/modules/cms`'s
 * `GET/PUT /cms/about`). No admin UI existed for this at all before
 * this pass (an explicitly named gap). `highlights` is a small
 * embedded array (title/description/icon cards under the About copy)
 * edited as plain component state and sent whole on save, the same
 * "PUT the whole singleton" shape `HeroBannerTab.jsx` already
 * established for `HeroBanner` — there's no per-highlight sub-route
 * to call individually.
 */
export default function AboutTab() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState({
    heading: '',
    body: '',
    ctaLabel: '',
    ctaHref: '',
    highlights: [],
  });

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const data = await websiteService.getAboutContent();
      setForm({
        heading: data?.heading || '',
        body: data?.body || '',
        ctaLabel: data?.ctaLabel || '',
        ctaHref: data?.ctaHref || '',
        highlights: (data?.highlights || []).map((h) => ({ key: h._id || crypto.randomUUID(), title: h.title, description: h.description, icon: h.icon || '' })),
      });
      setState('ready');
    } catch (error) {
      // A fresh install has no About document yet — treat 404 as an
      // empty form to fill in, not a load failure.
      if (error?.response?.status === 404) {
        setState('ready');
      } else {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateHighlight = (key, field, value) => {
    setForm((f) => ({
      ...f,
      highlights: f.highlights.map((h) => (h.key === key ? { ...h, [field]: value } : h)),
    }));
  };

  const addHighlight = () => {
    setForm((f) => ({ ...f, highlights: [...f.highlights, emptyHighlight()] }));
  };

  const removeHighlight = (key) => {
    setForm((f) => ({ ...f, highlights: f.highlights.filter((h) => h.key !== key) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        heading: form.heading.trim(),
        body: form.body.trim(),
        ctaLabel: form.ctaLabel.trim(),
        ctaHref: form.ctaHref.trim(),
        highlights: form.highlights.map((h) => ({ title: h.title.trim(), description: h.description.trim(), icon: h.icon.trim() })),
      };
      await websiteService.upsertAboutContent(payload);
      toast({ title: t('website.about.saveSuccess', 'About section saved.'), variant: 'success' });
    } catch (error) {
      setSaveError(extractApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (state === 'error') return <ErrorState description={errorMessage} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? t('common.saving') : t('common.saveChanges')}
        </Button>
      </div>

      {saveError ? (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <label className={labelClass}>{t('website.about.heading', 'Heading')}</label>
          <input
            maxLength={150}
            className={inputClass}
            value={form.heading}
            onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelClass}>{t('website.about.body', 'Body')}</label>
          <textarea
            rows={4}
            maxLength={1000}
            className={textareaClass}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('website.about.ctaLabel', 'Button label (optional)')}</label>
            <input
              maxLength={60}
              className={inputClass}
              value={form.ctaLabel}
              onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{t('website.about.ctaHref', 'Button link (optional)')}</label>
            <input
              maxLength={200}
              className={inputClass}
              placeholder="/about"
              value={form.ctaHref}
              onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">{t('website.about.highlights', 'Highlight cards')}</p>
          <Button size="sm" variant="outline" onClick={addHighlight}>
            <Plus size={14} /> {t('website.about.addHighlight', 'Add highlight')}
          </Button>
        </div>
        <div className="space-y-2">
          {form.highlights.map((h) => (
            <div key={h.key} className="rounded-lg border border-border bg-card p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto] items-start">
                <input
                  className={inputClass}
                  placeholder={t('website.about.highlightTitle', 'Title')}
                  maxLength={100}
                  value={h.title}
                  onChange={(e) => updateHighlight(h.key, 'title', e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder={t('website.about.highlightDescription', 'Description')}
                  maxLength={300}
                  value={h.description}
                  onChange={(e) => updateHighlight(h.key, 'description', e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder={t('website.about.highlightIcon', 'Icon')}
                  maxLength={50}
                  value={h.icon}
                  onChange={(e) => updateHighlight(h.key, 'icon', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => removeHighlight(h.key)} title={t('common.delete')}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {form.highlights.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('website.about.noHighlights', 'No highlight cards yet.')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
