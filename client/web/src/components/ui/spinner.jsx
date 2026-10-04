import { cn } from '../../lib/utils.js';

/** Inline loading spinner — same visual used ad hoc in ProtectedRoute; centralized here so every module reuses one implementation (frontend rule #4). */
export function Spinner({ className, size = 20 }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('rounded-full border-2 border-primary border-t-transparent animate-spin', className)}
      style={{ height: size, width: size }}
    />
  );
}

/** Full-viewport loading state, for route-level suspense-style waits. */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen grid place-items-center gap-3">
      <Spinner size={32} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
