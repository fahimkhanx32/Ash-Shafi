import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const alertVariants = cva('relative w-full rounded-xl border p-4 text-sm flex items-start gap-3', {
  variants: {
    variant: {
      default: 'bg-accent text-accent-foreground border-border',
      destructive: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30',
      success:
        'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30',
    },
  },
  defaultVariants: { variant: 'default' },
});

export const Alert = forwardRef(({ className, variant, role = 'alert', ...props }, ref) => (
  <div ref={ref} role={role} className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

export const AlertTitle = forwardRef(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

