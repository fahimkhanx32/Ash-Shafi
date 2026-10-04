import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Master prompt §16 / §85 — reproductive & sexual-health data gets a
 * visible, plain-language notice wherever it's rendered, reinforcing
 * that access here is restricted and logged. Purely informational;
 * the actual restriction is enforced server-side.
 */
export default function SensitiveDataNotice() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-accent/40 p-3 text-xs text-muted-foreground">
      <ShieldCheck size={16} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
      <p>{t('clinical.sensitiveDataNotice')}</p>
    </div>
  );
}
