import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, LockOpen, ShieldAlert } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Skeleton } from '../ui/skeleton.jsx';
import { ErrorState } from '../ui/empty-state.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import * as securityAdminService from '../../services/securityAdminService.js';
import { extractApiError } from '../../services/apiClient.js';
import { formatDateTime } from '../../lib/dateFormat.js';
import ReasonPromptDialog from './ReasonPromptDialog.jsx';

export default function AccountSecurityDialog({ open, onOpenChange, userId, onChanged }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { has } = usePermissions();
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [unlockOpen, setUnlockOpen] = useState(false);

  const load = async () => {
    if (!userId) return;
    setState('loading');
    try {
      const data = await securityAdminService.getAccountSecurity(userId);
      setProfile(data);
      setState('ready');
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
      setState('error');
    }
  };

  useEffect(() => {
    if (open && userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const canUnlock = has('system:admin');

  const handleUnlock = async (reason) => {
    await securityAdminService.unlockAccount(userId, reason);
    toast({ title: t('security.alertsSection.unlockedSuccess', 'Account unlocked successfully.'), variant: 'success' });
    await load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldAlert size={16} /> {t('security.accountSecurityTitle', 'Account security')}
        </DialogTitle>
        {profile?.user ? (
          <DialogDescription>
            {profile.user.name} · {profile.user.email}
          </DialogDescription>
        ) : null}
      </DialogHeader>

      <div className="mt-4 space-y-3">
        {state === 'loading' ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : state === 'error' ? (
          <ErrorState description={errorMessage} onRetry={load} />
        ) : profile ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={profile.isCurrentlyLocked ? 'destructive' : 'success'} className="flex items-center gap-1">
                {profile.isCurrentlyLocked ? <Lock size={12} /> : <LockOpen size={12} />}
                {profile.isCurrentlyLocked ? t('security.locked', 'Locked') : t('security.notLocked', 'Not locked')}
              </Badge>
              <Badge variant={profile.user?.isProtected ? 'warning' : 'neutral'}>
                {profile.user?.isProtected ? t('security.protectedBadge', 'Protected account') : t('security.standardAccount', 'Standard account')}
              </Badge>
              <Badge variant="neutral">{profile.user?.role}</Badge>
              <Badge variant={profile.user?.status === 'ACTIVE' ? 'success' : 'neutral'}>{profile.user?.status}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('security.failedAttempts', 'Failed login attempts')}</dt>
              <dd className="text-right font-medium">{profile.failedLoginAttempts}</dd>

              <dt className="text-muted-foreground">{t('security.lockedUntil', 'Locked until')}</dt>
              <dd className="text-right font-medium">{profile.lockedUntil ? formatDateTime(profile.lockedUntil) : '—'}</dd>

              <dt className="text-muted-foreground">{t('security.lastLogin', 'Last login')}</dt>
              <dd className="text-right font-medium">{profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : t('common.never', 'Never')}</dd>

              <dt className="text-muted-foreground">{t('security.passwordChangedAt', 'Password last changed')}</dt>
              <dd className="text-right font-medium">
                {profile.passwordChangedAt ? formatDateTime(profile.passwordChangedAt) : '—'}
              </dd>

              <dt className="text-muted-foreground">{t('security.activeSessionsCount', 'Active sessions')}</dt>
              <dd className="text-right font-medium">{profile.activeSessionCount}</dd>

              <dt className="text-muted-foreground">{t('security.securityEvents30d', 'Security events (30d)')}</dt>
              <dd className="text-right font-medium">{profile.recentSecurityEventsCount30d}</dd>

              <dt className="text-muted-foreground">{t('security.accountCreated', 'Account created')}</dt>
              <dd className="text-right font-medium">{formatDateTime(profile.accountCreatedAt)}</dd>
            </dl>
          </>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.close', 'Close')}
        </Button>
        {profile?.isCurrentlyLocked && canUnlock ? (
          <Button type="button" variant="default" onClick={() => setUnlockOpen(true)}>
            <LockOpen size={14} /> {t('security.alertsSection.unlockAccount', 'Unlock account')}
          </Button>
        ) : null}
      </DialogFooter>

      <ReasonPromptDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        title={t('security.alertsSection.reasonPromptTitle', 'Unlock this account?')}
        description={t('security.alertsSection.reasonPromptDesc', 'This clears the failed-login lockout immediately. Every unlock is recorded as a security event and an administrative-action audit log entry.')}
        confirmLabel={t('security.alertsSection.unlockAccount', 'Unlock account')}
        onConfirm={handleUnlock}
      />
    </Dialog>
  );
}
