import { Search } from 'lucide-react';

/**
 * Generic filter row: a search input plus a slot for module-specific
 * filter controls (selects, date ranges, etc.). Not wired to any
 * backend search endpoint itself — the roadmap's "global search
 * foundation" is a shell that real modules plug a real query into,
 * not a working search feature on its own (BET-63/FET-05's global
 * search still needs its own backend work).
 */
export function FilterBar({ searchValue, onSearchChange, searchPlaceholder = 'Search…', children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      {onSearchChange ? (
        <div className="relative flex-1 min-w-0">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-10 rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
      ) : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
