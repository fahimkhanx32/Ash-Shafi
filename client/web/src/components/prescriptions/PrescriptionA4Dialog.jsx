import { useEffect, useRef, useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Spinner } from '../ui/spinner.jsx';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import { extractApiError } from '../../services/apiClient.js';

/**
 * FET-10 — "A4 prescription preview", "Print", "PDF generation",
 * "Download". Deliberately renders the real backend-generated PDF
 * (`prescription-pdf.service.js`, pdfkit, BET-11) in an `<iframe>`
 * rather than a second, client-side A4 layout — the backend is the
 * single source of truth for prescription formatting (clinic
 * letterhead, item table, signature line), so the preview a doctor
 * checks before printing is byte-for-byte the same PDF the patient
 * would receive, never a facsimile that could drift from it.
 * `getPrescriptionPdfBlobUrl` authenticates the request (the PDF route
 * needs the same `PRESCRIPTIONS_READ`-or-self check as the JSON
 * endpoint) and hands back an object URL this dialog owns and revokes
 * on close/unmount.
 */
export default function PrescriptionA4Dialog({ open, onOpenChange, prescriptionId }) {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = useState('');
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!open || !prescriptionId) return undefined;
    setState('loading');
    setErrorMessage('');
    let currentUrl = '';
    prescriptionsService
      .getPrescriptionPdfBlobUrl(prescriptionId)
      .then((url) => {
        currentUrl = url;
        setBlobUrl(url);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [open, prescriptionId]);

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-3xl">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('clinical.prescription.a4Title')}</DialogTitle>
        <DialogDescription>{t('clinical.prescription.a4Description')}</DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        {state === 'loading' ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Spinner />
          </div>
        ) : null}

        {state === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {state === 'ready' ? (
          <>
            <div className="flex justify-end gap-2 mb-3">
              <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                <Printer size={14} /> {t('clinical.prescription.print')}
              </Button>
              <Button type="button" size="sm" onClick={() => window.open(blobUrl, '_blank')}>
                <Download size={14} /> {t('clinical.prescription.openDownload')}
              </Button>
            </div>
            <iframe
              ref={iframeRef}
              title={t('clinical.prescription.a4Title')}
              src={blobUrl}
              className="w-full h-[65vh] rounded-lg border border-border bg-white"
            />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
