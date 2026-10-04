import { Menu, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import UserMenu from './UserMenu.jsx';
import NotificationsBell from './NotificationsBell.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import ModeToggle from './ModeToggle.jsx';
import ReadPageButton from '../accessibility/ReadPageButton.jsx';

export default function Topbar({ onToggleSidebar }) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        <button
          type="button"
          aria-label={t('nav.toggleNavigation', 'Toggle navigation')}
          title={t('nav.toggleNavigation', 'Toggle navigation')}
          onClick={onToggleSidebar}
          className="-ml-2 grid min-h-[40px] min-w-[40px] place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 active:bg-accent transition-colors"
        >
          <Menu size={22} />
        </button>

        {/* Global search foundation — no search backend exists yet, so this stays
            disabled rather than faking results (see components/ui/filter-bar.jsx). */}
        <div className="relative hidden sm:block flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            disabled
            placeholder={t('topbar.searchPlaceholder')}
            title={t('topbar.searchDisabledTitle')}
            className="w-full h-10 rounded-lg border border-border bg-muted/40 pl-9 pr-3 text-sm text-muted-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ReadPageButton />
          <ModeToggle />
          <LanguageSwitcher />
          <NotificationsBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
