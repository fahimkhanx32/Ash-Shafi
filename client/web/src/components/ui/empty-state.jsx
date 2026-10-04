import { AlertTriangle, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from './button.jsx';

/** Generic "nothing here yet" state — replaces the one-off `<p className="text-sm text-muted-foreground">…</p>` empty messages scattered across modules with a consistent, slightly richer treatment. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-card/40 py-10 px-6 text-center animate-fade-in ${className}`}>
      <div className="p-3 rounded-full bg-muted/50 mb-1">
        <Icon size={28} className="text-muted-foreground" aria-hidden="true" />
      </div>
      {title ? <p className="font-semibold text-base tracking-tight">{title}</p> : null}
      {description ? <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Generic "something failed" state with an optional retry action — for failed fetches across modules. */
export function ErrorState({ title, description, onRetry, className = '' }) {
  const { t } = useTranslation();
  return (
    <div className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 py-10 px-6 text-center animate-fade-in ${className}`}>
      <div className="p-3 rounded-full bg-destructive/10 text-destructive mb-1">
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      <p className="font-semibold text-base text-foreground">{title || t('common.somethingWentWrong')}</p>
      {description ? <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {t('common.tryAgain')}
        </Button>
      ) : null}
    </div>
  );
}
