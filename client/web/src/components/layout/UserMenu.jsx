import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Palette, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../providers/AuthProvider.jsx';

export default function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const initials = (user?.name || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-2 rounded-full pl-1 pr-2.5 hover:bg-accent/60 transition-colors"
      >
        {user?.profileImage ? (
          <img src={user.profileImage} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
            {initials}
          </span>
        )}
        <span className="hidden sm:block text-sm font-medium max-w-[10rem] truncate">
          {user?.name}
        </span>
        <ChevronDown size={15} className="text-muted-foreground" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-one-ui-lg z-50 animate-fade-in"
        >
          <div className="px-2.5 py-2">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <span className="inline-block mt-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
              {user?.role}
            </span>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            to="/dashboard/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium rounded-lg hover:bg-accent/60"
          >
            <Palette size={16} /> {t('userMenu.appearance')}
          </Link>
          <Link
            to="/dashboard/security"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-sm font-medium rounded-lg hover:bg-accent/60"
          >
            <ShieldCheck size={16} /> {t('userMenu.accountSecurity')}
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium rounded-lg hover:bg-accent/60 text-left"
          >
            <LogOut size={16} /> {t('userMenu.signOut')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
