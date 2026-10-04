import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils.js';

const toastVariants = cva(
  'pointer-events-auto flex items-start gap-3 w-full max-w-sm rounded-xl border p-4 shadow-one-ui-lg animate-slide-in-bottom',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-border',
        success: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:border-emerald-500/30',
        destructive: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-500/10 dark:text-red-100 dark:border-red-500/30',
        info: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:border-sky-500/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const ICONS = { default: Info, success: CheckCircle2, destructive: AlertTriangle, info: Info };

export function Toast({ title, description, variant = 'default', onDismiss }) {
  const Icon = ICONS[variant] || Info;
  return (
    <div role="status" className={cn(toastVariants({ variant }))}>
      <Icon size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        {description ? <p className="text-sm opacity-90 mt-0.5">{description}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}
