import { useTranslation } from 'react-i18next';
import { EmptyState } from '../ui/empty-state.jsx';

/**
 * FET-06 — honest placeholder for workspace tabs whose backend
 * module is still empty (`modules/prescriptions`, `investigations`,
 * `reports`, `billing`, `messaging`, `files` — all confirmed empty
 * folders, reserved for BET-11/12/13/15). Matches the "Coming soon"
 * convention `navConfig.js` (FET-02) already established for
 * unbuilt nav items — real information architecture without linking
 * to, or faking, functionality that doesn't exist yet (master prompt
 * §79).
 */
export default function ComingSoonTab({ icon, title, description }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description || t('common.comingSoonDescription', { defaultValue: "This module hasn't been built yet — it's on the backend roadmap." })}
    />
  );
}
