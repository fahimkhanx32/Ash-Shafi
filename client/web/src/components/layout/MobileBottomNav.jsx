import { NavLink, useLocation } from 'react-router-dom';
import { Home, Users, HeartPulse, CalendarClock, MessagesSquare, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PATIENT_ACCESS_ROLES } from '../../constants/roles.js';
import { cn } from '../../lib/utils.js';

/**
 * Master prompt §8 — mobile bottom navigation: Home / Patients /
 * Appointments / Messages / Profile, with the active destination
 * visually obvious. Sits alongside (not instead of) the existing
 * `Sidebar` drawer — this bar surfaces the five primary destinations
 * a busy clinician needs one thumb-tap away; the drawer still covers
 * the full role-gated IA (Staff, Roles, Settings, etc.) for anything
 * beyond these five. Real routes only where a module exists —
 * Appointments and Messages render disabled with "Soon", mirroring
 * the exact `to: null` convention `navConfig.js` already established
 * for the sidebar (master prompt §79: no link that would 404, no
 * faked page). FET-09 gave Appointments a real route — Messages
 * stays disabled until its own module ships.
 */
function itemsFor(role, t) {
  const clinical = PATIENT_ACCESS_ROLES.includes(role)
    ? { label: t('nav.patients'), icon: Users, to: '/dashboard/patients' }
    : { label: t('nav.myRecords'), icon: HeartPulse, to: '/dashboard/my-records' };

  return [
    { label: t('nav.home'), icon: Home, to: '/dashboard' },
    clinical,
    { label: t('nav.appointments'), icon: CalendarClock, to: '/dashboard/appointments' },
    { label: t('nav.messages'), icon: MessagesSquare, to: '/dashboard/messages' },
    { label: t('nav.profile'), icon: UserRound, to: '/dashboard/settings' },
  ];
}

export default function MobileBottomNav({ role }) {
  const location = useLocation();
  const { t } = useTranslation();
  const items = itemsFor(role, t);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;

          if (!item.to) {
            return (
              <li key={item.label}>
                <div
                  className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] text-muted-foreground/45"
                  aria-disabled="true"
                  title={t('common.comingSoonTitle', { label: item.label })}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </div>
              </li>
            );
          }

          const active =
            location.pathname === item.to ||
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to));

          return (
            <li key={item.label}>
              <NavLink
                to={item.to}
                end={item.to === '/dashboard'}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors min-h-[44px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
