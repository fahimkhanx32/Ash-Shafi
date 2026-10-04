import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils.js';
import { NAV_SECTIONS } from './navConfig.js';

/**
 * Role-aware sidebar. `mobileOpen`/`onClose` drive the slide-over
 * behavior on narrow screens; on `md`+ it's always visible as a
 * static column (see `AppShell.jsx`).
 *
 * FET-22 — the drawer used to mount/unmount instantly (no transition
 * at all). It now stays mounted while closed and slides on a
 * `translate-x` transform, and the backdrop fades in/out, so opening
 * the nav on a phone feels like a drawer instead of a flash. Body
 * scroll is locked while open so the page underneath can't scroll
 * along with the drawer's own touch gestures.
 */
export default function Sidebar({ role, sidebarOpen = true, mobileOpen, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const content = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
            N
          </div>
          <span className="font-semibold">{t('common.brand')}</span>
        </div>
        <button
          type="button"
          aria-label={t('nav.closeNavigation', 'Close navigation')}
          title={t('nav.closeNavigation', 'Close navigation')}
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors"
        >
          <X size={19} />
        </button>
      </div>

      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.allowedRoles || item.allowedRoles.includes(role),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.heading || 'main'}>
            {section.headingKey ? (
              <p className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(section.headingKey)}
              </p>
            ) : null}
            <ul className="space-y-1">
              {visibleItems.map((item) => (
                <li key={item.label}>
                  {item.to ? (
                    <NavLink
                      to={item.to}
                      onClick={() => {
                        if (window.innerWidth < 768) {
                          onClose();
                        }
                      }}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                        )
                      }
                    >
                      {/* Icons were inheriting the dimmed label colour, which
                          read as faint on the dark background. A stronger
                          tint keeps them legible in both themes. */}
                      <item.icon size={18} strokeWidth={2} className="shrink-0 text-foreground/80" aria-hidden="true" />
                      {t(item.labelKey)}
                    </NavLink>
                  ) : (
                    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/60 cursor-not-allowed">
                      <span className="flex items-center gap-2.5">
                        <item.icon size={17} aria-hidden="true" />
                        {t(item.labelKey)}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-muted px-1.5 py-0.5">
                        {t('common.comingSoon')}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Collapsible column on md+ */}
      <div
        className={cn(
          'hidden md:block shrink-0 border-r border-border bg-card transition-all duration-300 ease-in-out overflow-hidden',
          sidebarOpen ? 'w-64 opacity-100' : 'w-0 border-r-0 opacity-0 pointer-events-none',
        )}
      >
        <div className="w-64 h-full">{content}</div>
      </div>

      {/* Mobile slide-over drawer */}
      <div
        className={cn('fixed inset-0 z-40 md:hidden transition-opacity duration-200 ease-out', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label={t('nav.closeNavigation', 'Close navigation')}
          tabIndex={mobileOpen ? 0 : -1}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-card shadow-one-ui-lg transition-transform duration-200 ease-out will-change-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {content}
        </div>
      </div>
    </>
  );
}
