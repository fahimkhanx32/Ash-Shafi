import { cn } from '../../lib/utils.js';

/**
 * Shared tab-strip primitive (frontend rule #4 — "shared components
 * should be created once"). `PatientClinicalPage` (FET-07) hand-rolled
 * two tab buttons inline before this existed; this component
 * generalizes that same visual treatment for `PatientWorkspacePage`'s
 * larger tab set (FET-06) so later modules don't each reinvent it.
 *
 * `tabs`: [{ value, label, icon? }]. Purely presentational/controlled
 * — the caller owns `value`/`onChange` and what renders below.
 */
/**
 * Shared tab-strip primitive (frontend rule #4 — "shared components
 * should be created once"). `PatientClinicalPage` (FET-07) hand-rolled
 * two tab buttons inline before this existed; this component
 * generalizes that same visual treatment for `PatientWorkspacePage`'s
 * larger tab set (FET-06) so later modules don't each reinvent it.
 *
 * `tabs`: [{ value, label, icon?, badge? }]. `badge` (a number) shows
 * a small pending-count pill next to the label — added for
 * `BillingPage.jsx`'s "Suggested charges" tab, optional everywhere
 * else. Purely presentational/controlled — the caller owns
 * `value`/`onChange` and what renders below.
 */
export function TabList({ tabs, value, onChange, className }) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-1 overflow-x-auto border-b border-border pb-0 mb-5 -mx-1 px-1', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-primary text-foreground bg-accent/50'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30',
            )}
          >
            {Icon ? <Icon size={15} aria-hidden="true" /> : null}
            {tab.label}
            {tab.badge ? (
              <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
