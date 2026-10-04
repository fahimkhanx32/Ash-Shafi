import { forwardRef } from 'react';
import { cn } from '../../lib/utils.js';

/**
 * Shared table primitives so every module (patients, appointments,
 * prescriptions, staff, audit logs…) renders tabular data the same
 * way instead of each hand-rolling `<table>` markup — frontend rule
 * #4. Responsive by convention: wrap in `<TableContainer>` for
 * horizontal scroll on narrow screens rather than squeezing columns.
 *
 * FET-22 — `overscroll-x-contain` stops a horizontal swipe inside the
 * table from also dragging the whole page (a common mobile-table
 * papercut), and the two `mask-image` gradients give a soft fade at
 * the scrollable edges so it's visually obvious there's more content
 * off-screen instead of the content just hard-clipping.
 */
export function TableContainer({ className, children }) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border',
        '[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] sm:[mask-image:none]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * FET-22 — progressive column disclosure. Pass `hideBelow="sm"|"md"|"lg"`
 * on a `TableHead`/`TableCell` pair to drop a lower-priority column on
 * narrow screens instead of relying on horizontal scroll alone; the
 * remaining columns then have room to breathe on a phone. Opt-in and
 * backward compatible — existing call sites without the prop are
 * unaffected.
 */
const HIDE_BELOW_CLASS = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

export const Table = forwardRef(({ className, ...props }, ref) => (
  <table ref={ref} className={cn('w-full text-sm', className)} {...props} />
));
Table.displayName = 'Table';

export const TableHeader = forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('bg-accent/40 text-left text-xs uppercase tracking-wide text-muted-foreground', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('divide-y divide-border', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn('hover:bg-accent/30 transition-colors', className)} {...props} />
));
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef(({ className, hideBelow, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn('px-4 py-3 font-semibold whitespace-nowrap', hideBelow && HIDE_BELOW_CLASS[hideBelow], className)}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef(({ className, hideBelow, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3 align-middle', hideBelow && HIDE_BELOW_CLASS[hideBelow], className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';
