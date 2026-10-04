import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { extractApiError } from '../../services/apiClient.js';

const REASON_MIN_LENGTH = 10;

export default function ReasonPromptDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (reason.trim().length < REASON_MIN_LENGTH) {
      setError(t('security.reasonMinLength', 'Please enter at least {{min}} characters explaining why.', { min: REASON_MIN_LENGTH }));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>

      <div className="mt-4 space-y-2">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <label className="text-xs font-medium text-muted-foreground" htmlFor="reason-prompt-textarea">
          {t('security.reasonRequiredLabel', 'Reason (required)')}
        </label>
        <textarea
          id="reason-prompt-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
          rows={3}
          placeholder={t('security.alertsSection.reasonPlaceholder', 'Why is this action necessary?')}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button type="button" variant="destructive" onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('common.saving', 'Submitting…') : (confirmLabel || t('security.alertsSection.confirmAction', 'Confirm'))}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
