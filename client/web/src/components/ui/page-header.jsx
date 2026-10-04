import { Breadcrumbs } from './breadcrumb.jsx';

/** Standard page-top block: breadcrumb trail, title, description, and a right-aligned action slot — reused by every module page instead of each hand-rolling its own header row. */
export function PageHeader({ breadcrumbs, title, description, actions }) {
  return (
    <div className="space-y-2 mb-6">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
