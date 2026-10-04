import { cn } from '../../lib/utils.js';

/** Loading placeholder block. Compose with width/height utility classes at the call site. */
export function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} {...props} />;
}

/** A few stacked skeleton rows — the common "list is loading" shape. */
export function SkeletonList({ rows = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/**
 * FET-22 — table-shaped loading placeholder. Modules that render a
 * `Table` while data is loading previously fell back to a generic
 * `SkeletonList` (a stack of bars that doesn't resemble the table
 * about to appear) or nothing at all. Drop this inside `TableBody`
 * for a loading state that mirrors the real row/column layout, so
 * there's no layout jump once data arrives.
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        // eslint-disable-next-line react/no-array-index-key
        <tr key={rowIndex} className="border-b border-border last:border-0">
          {Array.from({ length: columns }).map((__, colIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <td key={colIndex} className="px-4 py-3">
              <Skeleton className={cn('h-4', colIndex === 0 ? 'w-32' : 'w-16')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A grid of card-shaped placeholders — for dashboard stat/summary cards while data loads. */
export function SkeletonCards({ count = 4, className }) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Form fields skeleton placeholder — for modal dialogs and form pages while data loads. */
export function FormSkeleton({ fields = 4, className }) {
  return (
    <div className={cn('space-y-4 py-2', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** Detail / Profile page skeleton placeholder — for patient workspace, staff details, clinical records loading. */
export function ProfileSkeleton({ className }) {
  return (
    <div className={cn('space-y-6 animate-fade-in', className)}>
      <div className="rounded-2xl border border-border p-6 space-y-4 bg-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}

