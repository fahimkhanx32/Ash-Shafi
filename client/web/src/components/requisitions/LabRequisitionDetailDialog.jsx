import { useEffect, useRef, useState } from 'react';
import { Printer, Download, X, AlertCircle } from 'lucide-react';
import * as labRequisitionsService from '../../services/labRequisitionsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Spinner } from '../ui/spinner.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { LabRequisitionDocument } from './LabRequisitionDocument.jsx';

export default function LabRequisitionDetailDialog({
  open,
  onOpenChange,
  requisitionId,
}) {
  const [loading, setLoading] = useState(false);
  const [requisition, setRequisition] = useState(null);
  const [error, setError] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    if (!open || !requisitionId) {
      setRequisition(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    labRequisitionsService
      .getRequisition(requisitionId)
      .then((data) => setRequisition(data))
      .catch((err) => setError(extractApiError(err).message))
      .finally(() => setLoading(false));
  }, [open, requisitionId]);

  if (!open) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              Lab Requisition Form: {requisition?.requisitionReference || '—'}
            </h2>
            {requisition?.status && (
              <Badge
                variant={
                  requisition.status === 'ISSUED'
                    ? 'success'
                    : requisition.status === 'CANCELLED'
                    ? 'destructive'
                    : 'warning'
                }
              >
                {requisition.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loading || !requisition}
              className="gap-1.5 text-xs h-8"
            >
              <Printer size={14} />
              <span>Print Form</span>
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-900/60 flex justify-center">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-xs text-muted-foreground">Loading requisition form...</p>
            </div>
          ) : error ? (
            <div className="w-full max-w-md py-10">
              <Alert variant="destructive">
                <AlertCircle size={16} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : requisition ? (
            <div className="w-full flex justify-center">
              <LabRequisitionDocument
                ref={printRef}
                requisition={requisition}
                scale={0.88}
                showCosts={true}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
