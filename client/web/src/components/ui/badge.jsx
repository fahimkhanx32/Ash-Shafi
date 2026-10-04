import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils.js';

/**
 * Status badge. Consolidates the ad hoc status-color classNames that
 * were previously written inline per-component (e.g. `STATUS_STYLES`
 * in `PregnancyRecordCard.jsx`) into one primitive, per frontend rule
 * #4 ("shared components should be created once"). Color psychology
 * follows master prompt §5: success/warning/danger/info/neutral map
 * consistently, never ad hoc.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/25',
        info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25',
        success:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25',
        warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25',
        destructive: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25',
        primary: 'bg-accent text-accent-foreground border-transparent',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export const Badge = forwardRef(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = 'Badge';

export { badgeVariants };
