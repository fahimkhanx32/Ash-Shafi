import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Stethoscope, CheckCircle2, AlertCircle } from 'lucide-react';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Spinner } from '../ui/spinner.jsx';
import * as reportsService from '../../services/reportsService.js';
import * as staffService from '../../services/staffService.js';
import { extractApiError } from '../../services/apiClient.js';
import { reportTypeLabel } from '../../constants/reports.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';
const labelClass = 'text-xs font-semibold text-muted-foreground mb-1 block';

export default function ShareReportDialog({ open, onOpenChange, report, onShared }) {
  const { t } = useTranslation();

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setError('');
      setConfirmed(false);
      setNote('');
      setLoadingDoctors(true);
      staffService
        .listDoctors({ limit: 50 })
        .then((res) => {
          const activeDocs = (res.items || []).filter(
            (d) => d.user?.status === 'ACTIVE' || d.employmentStatus === 'ACTIVE',
          );
          setDoctors(activeDocs);
          if (activeDocs.length > 0) {
            setTargetDoctorId(activeDocs[0].user?.id || activeDocs[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDoctors(false));
    }
  }, [open]);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!report?.id && !report?._id) return;
    if (!targetDoctorId) {
      setError('Please select a doctor to share this report with.');
      return;
    }

    setSharing(true);
    setError('');
    const reportId = report.id || report._id;

    try {
      const result = await reportsService.shareReport(reportId, {
        targetDoctorId,
        note: note.trim(),
      });
      setConfirmed(true);
      onShared?.(result);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSharing(false);
    }
  };

  const targetDocObj = doctors.find((d) => (d.user?.id || d.id) === targetDoctorId);
  const targetDocName =
    targetDocObj?.user?.name ||
    [targetDocObj?.firstName, targetDocObj?.lastName].filter(Boolean).join(' ') ||
    'Selected Doctor';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !sharing && onOpenChange(next)}
      className="max-w-md"
    >
      <DialogCloseButton onClose={() => !sharing && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base font-bold">
          <Share2 className="text-primary" size={18} />
          Share Report with Doctor
        </DialogTitle>
        <DialogDescription>
          Share this document with another doctor without having to re-upload the file.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {confirmed ? (
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Report Shared Successfully</h3>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">"{report?.title}"</span> has been
              shared with <span className="font-semibold text-foreground">Dr. {targetDocName}</span>.
              The doctor can now access the original document and extracted results.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={handleShare} className="mt-3 space-y-3.5">
          {/* Report Summary Card */}
          <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1">
            <div className="font-bold text-foreground text-sm truncate">{report?.title}</div>
            <div className="text-muted-foreground flex items-center justify-between">
              <span>Type: {report?.reportType ? reportTypeLabel(report.reportType, t) : 'Report'}</span>
              <span>Ref: {report?.reportReference || '—'}</span>
            </div>
          </div>

          {/* Doctor Selector */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <Stethoscope size={13} className="text-primary" />
                Select Doctor to Share With *
              </span>
            </label>
            {loadingDoctors ? (
              <div className="h-10 rounded-lg border border-border bg-muted/40 px-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner size={14} /> Loading available doctors...
              </div>
            ) : (
              <select
                className={inputClass}
                value={targetDoctorId}
                disabled={sharing}
                onChange={(e) => setTargetDoctorId(e.target.value)}
                required
              >
                <option value="">-- Choose doctor --</option>
                {doctors.map((d) => {
                  const docId = d.user?.id || d.id;
                  const name =
                    d.user?.name || [d.firstName, d.lastName].filter(Boolean).join(' ');
                  const dept = d.department?.name ? ` (${d.department.name})` : '';
                  return (
                    <option key={docId} value={docId}>
                      Dr. {name}
                      {dept}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Optional Note */}
          <div>
            <label className={labelClass}>Note / Reason for Sharing (Optional)</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
              value={note}
              disabled={sharing}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. For second opinion on hemoglobin count"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={sharing}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sharing || !targetDoctorId} className="gap-1.5">
              {sharing ? (
                <>
                  <Spinner size={14} /> Sharing...
                </>
              ) : (
                <>
                  <Share2 size={14} /> Share Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
