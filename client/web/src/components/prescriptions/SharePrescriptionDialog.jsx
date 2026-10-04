import { useState } from 'react';
import { Share2, Copy, Check, MessageCircle, Mail, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogCloseButton, DialogFooter } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

export default function SharePrescriptionDialog({ open, onOpenChange, prescription }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!prescription) return null;

  const prescriptionId = prescription.prescriptionId || prescription.id;
  const token = prescription.verificationToken || prescriptionId;
  const origin = window.location.origin;
  const shareUrl = `${origin}/verify/${token}`;
  const shareText = `Ash-Shāfī Prescription (${prescriptionId}) for ${prescription.patientSnapshot?.name || 'Patient'}. Verify at: ${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Prescription ${prescriptionId} - Ash-Shāfī`);
    const body = encodeURIComponent(`Hello,\n\nPlease find the prescription details.\n\nPrescription ID: ${prescriptionId}\nVerification Link: ${shareUrl}\n\nThank you,\nAsh-Shāfī Medical Care`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Prescription ${prescriptionId}`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Share2 size={18} />
          </div>
          <div>
            <DialogTitle>{t('clinical.prescription.shareTitle', 'Share Prescription')}</DialogTitle>
            <DialogDescription>
              {t('clinical.prescription.shareDesc', 'Share secure verification link without exposing sensitive medical data publicly.')}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Secure Link Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t('clinical.prescription.secureLink', 'Secure Verification Link')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full h-9 px-3 rounded-lg border border-border bg-muted/50 text-xs font-mono select-all"
            />
            <Button type="button" size="sm" variant="outline" className="h-9 px-3 shrink-0" onClick={handleCopy}>
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
            </Button>
          </div>
        </div>

        {/* Sharing Options */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2 h-10 border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-xs"
            onClick={handleWhatsApp}
          >
            <MessageCircle size={16} className="text-emerald-600" />
            WhatsApp
          </Button>

          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2 h-10 border-blue-300 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-xs"
            onClick={handleEmail}
          >
            <Mail size={16} className="text-blue-600" />
            Email
          </Button>
        </div>

        {navigator.share ? (
          <Button
            type="button"
            className="w-full gap-2 text-xs"
            onClick={handleNativeShare}
          >
            <Globe size={15} /> {t('clinical.prescription.nativeShare', 'Share via Device Apps')}
          </Button>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {t('common.close', 'Close')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
