import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * `items`: [{ label, to? }] — the last item (or any item without
 * `to`) renders as plain text (current page), the rest as links.
 */
export function Breadcrumbs({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-foreground hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-foreground font-medium' : ''}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
