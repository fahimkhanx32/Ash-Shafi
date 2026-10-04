import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '../ui/badge.jsx';

/**
 * FET-20 checkpoint 2 — "Protected-account indicators".
 *
 * A single reusable badge for `user.isProtected` (Owner/Director,
 * per master prompt §9-§10) so every table on this page marks
 * protected accounts the same way, instead of each section inventing
 * its own label. Renders nothing for a non-protected/unknown user —
 * callers decide whether an empty slot matters for their layout.
 */
export default function ProtectedAccountBadge({ isProtected, className }) {
  const { t } = useTranslation();
  if (!isProtected) return null;

  return (
    <Badge variant="warning" className={`inline-flex items-center gap-1 ${className || ''}`}>
      <ShieldCheck size={11} aria-hidden="true" /> {t('security.protectedBadge')}
    </Badge>
  );
}
