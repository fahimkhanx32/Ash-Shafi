import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from './button.jsx';
import { formatNumber } from '../../lib/numberFormat.js';

/**
 * Server-side pagination control (master prompt §64 — large datasets
 * must paginate server-side, never load everything into the
 * browser). Purely presentational; the caller owns the actual page
 * state and the query that fetches each page.
 *
 * FET-17 — localized using useTranslation and formatNumber.
 */
export function Pagination({ page, totalPages, onPageChange, className }) {
  const { t } = useTranslation();

  if (!totalPages || totalPages <= 1) return null;

  const pageStr = formatNumber(page);
  const totalStr = formatNumber(totalPages);

  return (
    <div className={`flex items-center justify-between gap-3 ${className || ''}`}>
      <p className="text-xs text-muted-foreground">
        {t('common.pagination.pageOf', { page: pageStr, total: totalStr, defaultValue: `Page ${pageStr} of ${totalStr}` })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} /> {t('common.pagination.previous', { defaultValue: 'Previous' })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('common.pagination.next', { defaultValue: 'Next' })} <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
