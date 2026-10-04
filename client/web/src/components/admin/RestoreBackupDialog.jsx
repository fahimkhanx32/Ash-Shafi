import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ShieldAlert } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import PasswordField from '../auth/PasswordField.jsx';
import { muiFormTheme } from '../../themes/muiFormTheme.js';
import { extractApiError } from '../../services/apiClient.js';

const REASON_MIN_LENGTH = 10;

export default function RestoreBackupDialog({ open, onOpenChange, backup, onConfirm }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setPassword('');
    setConfirmed(false);
    setReason('');
    setError('');
  };

  const handleClose = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!password) {
      setError(t('validation.auth.currentPasswordRequired', 'Enter your current password to confirm.'));
      return;
    }
    if (!confirmed) {
      setError(t('backups.mustConfirm', 'You must explicitly confirm this restore.'));
      return;
    }
    if (reason.trim().length < REASON_MIN_LENGTH) {
      setError(t('security.reasonMinLength', 'Please enter at least {{min}} characters explaining why.', { min: REASON_MIN_LENGTH }));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirm({ password, reason: reason.trim() });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogCloseButton onClose={() => handleClose(false)} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert size={16} aria-hidden="true" /> {t('backups.restoreTitle', 'Restore Database Backup')}
        </DialogTitle>
        <DialogDescription>
          {t('backups.restoreWarning', 'Restoring a backup will replace current system data. Proceed with caution.')}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {t('backups.restoreWarningDetail', 'Every currently-stored record not present in this backup will be permanently lost. Only proceed if you understand the consequences.')}
          </AlertDescription>
        </Alert>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <MuiThemeProvider theme={muiFormTheme}>
          <PasswordField
            label={t('auth.changePassword.currentPasswordLabel', 'Your current password')}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            disabled={submitting}
          />
        </MuiThemeProvider>

        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="restore-reason-textarea">
            {t('security.reasonRequiredLabel', 'Reason (required)')}
          </label>
          <textarea
            id="restore-reason-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder={t('security.alertsSection.reasonPlaceholder', 'Why is this restore necessary?')}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={submitting}
            className="mt-0.5"
          />
          {t('backups.checkboxConfirm', 'I understand this will overwrite production data and cannot be undone.')}
        </label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button type="button" variant="destructive" onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('backups.restoring', 'Restoring database…') : t('backups.confirmRestore', 'Confirm Restore')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
